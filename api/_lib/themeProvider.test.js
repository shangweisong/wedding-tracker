import { describe, it, expect, vi } from "vitest";
import { generateThemeTokens } from "./themeProvider.js";

const PALETTE = {
  background: "#faf7f2",
  surface: "#f5f0e8",
  accent: "#c9a84c",
  accentLight: "#e8d5a3",
  accentDark: "#a07830",
  heading: "#2c2416",
  text: "#5c4a2a",
};
const jsonText = JSON.stringify(PALETTE);

function anthropicFetch(text) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: "text", text }] }),
  }));
}
function openaiFetch(text) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: text } }] }),
  }));
}

const img = { imageBase64: "AAAA", mimeType: "image/png" };

describe("generateThemeTokens", () => {
  it("parses an Anthropic vision response into a sanitized palette", async () => {
    const fetchImpl = anthropicFetch(jsonText);
    const tokens = await generateThemeTokens({ ...img, provider: "anthropic", apiKey: "k", fetchImpl });
    expect(tokens).toEqual(PALETTE);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("anthropic");
    expect(init.headers["x-api-key"]).toBe("k");
  });

  it("parses an OpenAI vision response and strips markdown fences", async () => {
    const fetchImpl = openaiFetch("```json\n" + jsonText + "\n```");
    const tokens = await generateThemeTokens({ ...img, provider: "openai", apiKey: "k", fetchImpl });
    expect(tokens).toEqual(PALETTE);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("openai");
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe("Bearer k");
  });

  it("uses NVIDIA's OpenAI-compatible endpoint", async () => {
    const fetchImpl = openaiFetch(jsonText);
    const tokens = await generateThemeTokens({ ...img, provider: "nvidia", apiKey: "k", fetchImpl });
    expect(tokens).toEqual(PALETTE);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("nvidia");
  });

  it("sends the image as a data URL to OpenAI-compatible providers", async () => {
    const fetchImpl = openaiFetch(jsonText);
    await generateThemeTokens({ ...img, provider: "openai", apiKey: "k", fetchImpl });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    const imgPart = body.messages[0].content.find((p) => p.type === "image_url");
    expect(imgPart.image_url.url).toBe("data:image/png;base64,AAAA");
  });

  it("throws when the model returns an incomplete palette", async () => {
    const bad = { ...PALETTE };
    delete bad.text;
    const fetchImpl = openaiFetch(JSON.stringify(bad));
    await expect(
      generateThemeTokens({ ...img, provider: "openai", apiKey: "k", fetchImpl }),
    ).rejects.toThrow();
  });

  it("throws on a non-ok upstream response", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    await expect(
      generateThemeTokens({ ...img, provider: "anthropic", apiKey: "k", fetchImpl }),
    ).rejects.toThrow();
  });

  it("throws on an unknown provider or missing inputs", async () => {
    const fetchImpl = openaiFetch(jsonText);
    await expect(generateThemeTokens({ ...img, provider: "bogus", apiKey: "k", fetchImpl })).rejects.toThrow();
    await expect(generateThemeTokens({ ...img, provider: "openai", apiKey: "", fetchImpl })).rejects.toThrow();
    await expect(generateThemeTokens({ imageBase64: "", provider: "openai", apiKey: "k", fetchImpl })).rejects.toThrow();
  });
});
