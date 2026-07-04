// Translation provider layer (#59). Prefers DeepL Free for higher-quality,
// more natural output and falls back to MyMemory for languages DeepL does not
// support (e.g. Malay) or when no DeepL key is configured. The caller contract
// is unchanged: { items: [{ key, text }], source, target } -> [{ key, text }].
export const MAX_ITEMS = 80;
export const MAX_TEXT = 2000;

const MYMEMORY_URL = "https://api.mymemory.translated.net/get";
// DeepL Free by default. Pro/paid keys (no `:fx` suffix) live on api.deepl.com —
// point DEEPL_API_URL there so a Pro key isn't rejected (403) by the Free host.
const DEFAULT_DEEPL_URL = "https://api-free.deepl.com/v2/translate";
const DEEPL_BATCH = 50; // DeepL accepts up to 50 `text` params per request.
const FETCH_TIMEOUT_MS = 8000; // Abort a stalled upstream instead of blocking.
const MYMEMORY_MAX_BYTES = 450; // MyMemory caps a single `q` at ~500 bytes.

// Our app locale codes → DeepL target_lang codes. Absence ⇒ DeepL unsupported.
const DEEPL_TARGET = {
  "zh-TW": "ZH-HANT",
  "zh-CN": "ZH-HANS",
  ja: "JA",
  ko: "KO",
};
// DeepL source_lang codes (variant-agnostic). Optional — DeepL auto-detects.
const DEEPL_SOURCE = { en: "EN", "zh-TW": "ZH", "zh-CN": "ZH", ja: "JA", ko: "KO" };

export function deeplTargetLang(target) {
  return DEEPL_TARGET[target] ?? null;
}

export function supportsDeepl(target, key) {
  return Boolean(key) && deeplTargetLang(target) != null;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function byteLen(s) {
  return new TextEncoder().encode(s).length;
}

// Race a fetch against a timeout so a hung upstream fails fast (and, for the
// DeepL→MyMemory chain, falls back) instead of blocking until the platform
// function timeout.
async function withTimeout(fetchImpl, url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Break text into segments within MyMemory's per-request byte cap, preferring
// word boundaries so the stitched-back translation stays readable. Without this,
// a field over ~500 bytes comes back blank on the MyMemory fallback path.
function splitForMyMemory(text) {
  if (byteLen(text) <= MYMEMORY_MAX_BYTES) return [text];
  const chunks = [];
  let cur = "";
  for (const word of text.split(/(\s+)/)) {
    if (cur && byteLen(cur + word) > MYMEMORY_MAX_BYTES) {
      chunks.push(cur);
      cur = word.trimStart();
    } else {
      cur += word;
    }
  }
  if (cur.trim()) chunks.push(cur);
  return chunks;
}

async function deeplBatch(texts, source, target, key, fetchImpl, url) {
  const body = new URLSearchParams();
  for (const t of texts) body.append("text", t);
  body.set("target_lang", deeplTargetLang(target));
  const src = DEEPL_SOURCE[source];
  if (src) body.set("source_lang", src);

  const resp = await withTimeout(fetchImpl, url, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!resp.ok) throw new Error(`deepl upstream ${resp.status}`);
  const data = await resp.json();
  const translations = data?.translations;
  if (!Array.isArray(translations) || translations.length !== texts.length) {
    throw new Error("deepl malformed response");
  }
  return translations.map((tr) => (typeof tr?.text === "string" ? tr.text : ""));
}

async function mymemoryOne(text, source, target, email, fetchImpl) {
  const params = new URLSearchParams({ q: text, langpair: `${source}|${target}` });
  if (email) params.set("de", email);
  const resp = await withTimeout(fetchImpl, `${MYMEMORY_URL}?${params.toString()}`, {});
  if (!resp.ok) throw new Error(`mymemory upstream ${resp.status}`);
  const data = await resp.json();
  const out = data?.responseData?.translatedText;
  if (typeof out !== "string" || !out.trim()) throw new Error("no translation");
  return out;
}

// Translate one field via MyMemory, chunking long text to respect its q cap and
// stitching the per-chunk translations back together.
async function mymemoryTranslate(text, source, target, email, fetchImpl) {
  const parts = splitForMyMemory(text);
  const out = [];
  for (const part of parts) {
    out.push(await mymemoryOne(part, source, target, email, fetchImpl));
  }
  return out.join(" ");
}

export async function translateItems(items, opts = {}) {
  const {
    source = "en",
    target,
    deeplKey = process.env.DEEPL_API_KEY || "",
    deeplUrl = process.env.DEEPL_API_URL || DEFAULT_DEEPL_URL,
    mymemoryEmail = process.env.MYMEMORY_EMAIL || undefined,
    fetchImpl = fetch,
  } = opts;

  // Normalise: keep order, cap text length, blank pass-through for the rest.
  const norm = items.map((item) => ({
    key: item?.key,
    text: typeof item?.text === "string" ? item.text.slice(0, MAX_TEXT) : "",
  }));
  const results = norm.map(({ key }) => ({ key, text: "" }));

  // Only items with a usable key and non-blank text get translated.
  const todo = norm
    .map((n, i) => ({ ...n, i }))
    .filter((n) => n.key && n.text.trim());
  if (todo.length === 0) return results;

  // Preferred provider: DeepL (batched) when supported and keyed.
  if (supportsDeepl(target, deeplKey)) {
    for (const group of chunk(todo, DEEPL_BATCH)) {
      try {
        const out = await deeplBatch(group.map((g) => g.text), source, target, deeplKey, fetchImpl, deeplUrl);
        group.forEach((g, j) => {
          results[g.i] = { key: g.key, text: out[j] || "" };
        });
      } catch (err) {
        // Surface why DeepL was skipped (401 key / 403 wrong-plan / 456 quota /
        // timeout) so the silent fallback to MyMemory is diagnosable in logs.
        console.error("[translate] deepl batch failed, falling back to MyMemory:", err?.message || err);
      }
    }
  }

  // Fallback / sole path for unsupported targets: MyMemory, sequential to stay
  // within its per-IP rate limits. Only fills entries still blank.
  for (const g of todo) {
    if (results[g.i].text) continue;
    try {
      results[g.i] = { key: g.key, text: await mymemoryTranslate(g.text, source, target, mymemoryEmail, fetchImpl) };
    } catch {
      // Graceful: leave blank so the couple fills it in manually rather than erroring.
    }
  }

  return results;
}
