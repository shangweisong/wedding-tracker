// Same-origin translation proxy (#53 Phase 2). The public CSP blocks a direct
// browser fetch to an external translation host, so the Wedding Setup
// "Auto-translate" button POSTs here and we proxy MyMemory (free, no API key).
// Optional MYMEMORY_EMAIL env raises the anonymous daily quota.
const MAX_ITEMS = 80;
const MAX_TEXT = 2000;
const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

async function translateOne(text, source, target, email) {
  const params = new URLSearchParams({ q: text, langpair: `${source}|${target}` });
  if (email) params.set("de", email);
  const resp = await fetch(`${MYMEMORY_URL}?${params.toString()}`);
  if (!resp.ok) throw new Error(`translate upstream ${resp.status}`);
  const data = await resp.json();
  const out = data?.responseData?.translatedText;
  if (typeof out !== "string" || !out.trim()) throw new Error("no translation");
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { items, source = "en", target } = req.body ?? {};
  if (!target || !Array.isArray(items)) {
    return res.status(400).json({ error: "expected { items: [{ key, text }], target }" });
  }
  if (items.length > MAX_ITEMS) {
    return res.status(400).json({ error: `too many items (max ${MAX_ITEMS})` });
  }

  const email = process.env.MYMEMORY_EMAIL || undefined;
  const results = [];
  // Sequential to stay within MyMemory's per-IP rate limits.
  for (const item of items) {
    const key = item?.key;
    const text = typeof item?.text === "string" ? item.text.slice(0, MAX_TEXT) : "";
    if (!key || !text.trim()) {
      results.push({ key, text: "" });
      continue;
    }
    try {
      results.push({ key, text: await translateOne(text, source, target, email) });
    } catch {
      // Graceful: leave blank so the couple fills it in manually rather than erroring.
      results.push({ key, text: "" });
    }
  }

  return res.status(200).json({ results });
}
