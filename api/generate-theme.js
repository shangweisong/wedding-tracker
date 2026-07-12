// AI theme generation (#60). The Wedding Setup "Generate theme from image" button
// POSTs an uploaded image here; a vision LLM returns a color-only palette applied
// to the public page as a `custom` theme. Server-only endpoint:
//   - THEME_AI_PROVIDER selects anthropic | openai | nvidia (default anthropic)
//   - the couple's API key lives in a server-only env var (never VITE_-prefixed)
//   - only the authenticated helper account may call it (Supabase token verified
//     AND its email matched against the configured helper), so the paid vision
//     API can't be abused by anonymous or other signed-up accounts
//   - a best-effort per-helper throttle bounds runaway retries / replayed tokens
import { generateThemeTokens } from "./_lib/themeProvider.js";
import { authorizedHelperEmail, isAllowedHelperEmail, makeRateLimiter } from "./_lib/requireCoupleAuth.js";

// Re-export for existing consumers/tests; the implementation moved to
// _lib/requireCoupleAuth.js so translate.js can share the same gate.
export { isAllowedHelperEmail };

const MAX_BASE64_CHARS = 3_300_000; // ~3.3 MB base64 ≈ 4.4 MB body, just under Vercel's 4.5 MB limit.
const ALLOWED_MIME = /^image\/(jpeg|png|gif|webp)$/;

// Best-effort per-warm-instance throttle; a per-wedding daily cap in Postgres
// is a sensible follow-up for the metered vision API.
const rateLimited = makeRateLimiter({ windowMs: 60_000, max: 8 });

function providerKey(provider) {
  return {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    nvidia: process.env.NVIDIA_API_KEY,
  }[provider];
}

// Resolve which model to request. NVIDIA NIM hosts many models and won't route a
// request without a valid `model`; a couple can pin it with NVIDIA_MODEL (#66)
// without a code change. THEME_AI_MODEL stays the provider-agnostic override, and
// an unset value falls through to the provider's built-in default.
export function resolveThemeModel(provider) {
  if (provider === "nvidia" && process.env.NVIDIA_MODEL) return process.env.NVIDIA_MODEL;
  return process.env.THEME_AI_MODEL || undefined;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const helperEmail = await authorizedHelperEmail(req);
  if (!helperEmail) return res.status(401).json({ error: "unauthorized" });
  if (rateLimited(helperEmail)) {
    return res.status(429).json({ error: "too many requests — please wait a minute and try again" });
  }

  const provider = (process.env.THEME_AI_PROVIDER || "anthropic").toLowerCase();
  const apiKey = providerKey(provider);
  if (!apiKey) {
    return res.status(501).json({ error: `theme generation not configured for provider "${provider}"` });
  }

  const { imageBase64, mimeType = "image/png" } = req.body ?? {};
  if (typeof imageBase64 !== "string" || !imageBase64) {
    return res.status(400).json({ error: "expected { imageBase64, mimeType }" });
  }
  if (imageBase64.length > MAX_BASE64_CHARS) {
    return res.status(413).json({ error: "image too large (max ~2.4MB)" });
  }
  if (!ALLOWED_MIME.test(mimeType)) {
    return res.status(400).json({ error: "mimeType must be image/jpeg, image/png, image/gif, or image/webp" });
  }

  try {
    const tokens = await generateThemeTokens({
      imageBase64,
      mimeType,
      provider,
      apiKey,
      model: resolveThemeModel(provider),
    });
    return res.status(200).json({ tokens });
  } catch (err) {
    console.error("[generate-theme] error:", err?.message || err);
    return res.status(502).json({ error: "theme generation failed — please try another image" });
  }
}
