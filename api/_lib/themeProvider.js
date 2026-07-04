// Vision-LLM theme generator (#60). Given an uploaded image, ask a vision model
// for a color-only wedding palette and return sanitized theme tokens. Provider is
// switchable (like the email layer) via THEME_AI_PROVIDER: anthropic | openai |
// nvidia. The couple's API key is a server-only env var — never in the bundle.
import {
  sanitizeThemeTokens,
  isCompleteThemeTokens,
  THEME_TOKEN_KEYS,
} from "../../src/lib/themeTokens.js";

const ENDPOINTS = {
  anthropic: "https://api.anthropic.com/v1/messages",
  openai: "https://api.openai.com/v1/chat/completions",
  nvidia: "https://integrate.api.nvidia.com/v1/chat/completions", // OpenAI-compatible
};

const DEFAULT_MODELS = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-4o",
  nvidia: "meta/llama-3.2-90b-vision-instruct",
};

const MAX_TOKENS = 400;
const TIMEOUT_MS = 30000;

const PROMPT =
  "You are a wedding-website theme designer. Study the image and derive a tasteful, " +
  "cohesive color palette for a wedding web page. Respond with ONLY a JSON object — no " +
  "prose, no markdown — with exactly these keys, each a hex color string like \"#rrggbb\": " +
  `${THEME_TOKEN_KEYS.map((k) => `"${k}"`).join(", ")}. ` +
  "Guidance: `background` and `surface` are light, neutral page colors; `accent`, " +
  "`accentLight`, `accentDark` are the dominant decorative color in three shades; " +
  "`heading` and `text` are dark, highly readable ink colors with strong contrast on the " +
  "background. Return only the JSON object.";

async function withTimeout(fetchImpl, url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function buildRequest({ provider, model, apiKey, imageBase64, mimeType }) {
  if (provider === "anthropic") {
    return {
      url: ENDPOINTS.anthropic,
      init: {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mimeType, data: imageBase64 } },
                { type: "text", text: PROMPT },
              ],
            },
          ],
        }),
      },
    };
  }
  // openai + nvidia share the OpenAI chat-completions shape.
  return {
    url: ENDPOINTS[provider],
    init: {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            ],
          },
        ],
      }),
    },
  };
}

function extractText(provider, data) {
  if (provider === "anthropic") {
    const part = Array.isArray(data?.content)
      ? data.content.find((c) => c?.type === "text") || data.content[0]
      : null;
    return part?.text;
  }
  return data?.choices?.[0]?.message?.content;
}

// Pull the JSON object out of a model reply, tolerating ```json fences or prose.
function extractJson(text) {
  if (typeof text !== "string") throw new Error("no text in model response");
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const brace = s.match(/\{[\s\S]*\}/);
  if (brace) s = brace[0];
  return JSON.parse(s);
}

export async function generateThemeTokens({
  imageBase64,
  mimeType = "image/png",
  provider,
  apiKey,
  model,
  fetchImpl = fetch,
}) {
  if (!imageBase64) throw new Error("missing image");
  if (!ENDPOINTS[provider]) throw new Error(`unknown theme provider: ${provider}`);
  if (!apiKey) throw new Error("missing api key");

  const resolvedModel = model || DEFAULT_MODELS[provider];
  const { url, init } = buildRequest({
    provider,
    model: resolvedModel,
    apiKey,
    imageBase64,
    mimeType,
  });

  const resp = await withTimeout(fetchImpl, url, init);
  // Name the model in the error: a 401/403 from NVIDIA is often model-entitlement,
  // not a bad key, so the resolved model is the key clue for #68 diagnosis.
  if (!resp.ok) {
    throw new Error(`theme provider ${provider} (${resolvedModel}) responded ${resp.status}`);
  }
  const data = await resp.json();

  const tokens = sanitizeThemeTokens(extractJson(extractText(provider, data)));
  if (!isCompleteThemeTokens(tokens)) throw new Error("model returned an incomplete palette");
  return tokens;
}
