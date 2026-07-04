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
import { supabaseAdmin } from "./_lib/supabaseAdmin.js";

const MAX_BASE64_CHARS = 7_000_000; // ~5 MB image; Vercel body limit is ~4.5 MB.
const ALLOWED_MIME = /^image\/(jpeg|png|gif|webp)$/;

// Best-effort in-memory rate limit (per warm instance). Not a durable quota — a
// per-wedding daily cap in Postgres is a sensible follow-up — but it caps runaway
// client retry loops / replayed tokens against the metered vision API.
const RATE = { windowMs: 60_000, max: 8 };
const hits = new Map();
function rateLimited(key) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < RATE.windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > RATE.max;
}

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

// The endpoint spends real API budget per call, so require not just a valid
// Supabase JWT but that it belongs to the configured helper account. If no helper
// email is configured, fall back to "any authenticated user" (back-compat).
export function isAllowedHelperEmail(email) {
  const allowed = (process.env.HELPER_EMAIL || process.env.VITE_HELPER_EMAIL || "").trim().toLowerCase();
  if (!allowed) return true;
  return typeof email === "string" && email.trim().toLowerCase() === allowed;
}

// Returns the authenticated helper's email, or null if the caller isn't an
// authorized helper. Fails closed on any error.
async function authorizedHelperEmail(req) {
  const auth = req.headers?.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin().auth.getUser(token);
    const email = data?.user?.email;
    if (error || !email || !isAllowedHelperEmail(email)) return null;
    return email;
  } catch {
    return null;
  }
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
    return res.status(413).json({ error: "image too large (max ~5MB)" });
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
