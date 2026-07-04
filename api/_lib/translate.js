// Translation provider layer (#59). Prefers DeepL Free for higher-quality,
// more natural output and falls back to MyMemory for languages DeepL does not
// support (e.g. Malay) or when no DeepL key is configured. The caller contract
// is unchanged: { items: [{ key, text }], source, target } -> [{ key, text }].
export const MAX_ITEMS = 80;
export const MAX_TEXT = 2000;

const MYMEMORY_URL = "https://api.mymemory.translated.net/get";
const DEEPL_URL = "https://api-free.deepl.com/v2/translate";
const DEEPL_BATCH = 50; // DeepL accepts up to 50 `text` params per request.

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

async function deeplBatch(texts, source, target, key, fetchImpl) {
  const body = new URLSearchParams();
  for (const t of texts) body.append("text", t);
  body.set("target_lang", deeplTargetLang(target));
  const src = DEEPL_SOURCE[source];
  if (src) body.set("source_lang", src);

  const resp = await fetchImpl(DEEPL_URL, {
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
  const resp = await fetchImpl(`${MYMEMORY_URL}?${params.toString()}`);
  if (!resp.ok) throw new Error(`mymemory upstream ${resp.status}`);
  const data = await resp.json();
  const out = data?.responseData?.translatedText;
  if (typeof out !== "string" || !out.trim()) throw new Error("no translation");
  return out;
}

export async function translateItems(items, opts = {}) {
  const {
    source = "en",
    target,
    deeplKey = process.env.DEEPL_API_KEY || "",
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
        const out = await deeplBatch(group.map((g) => g.text), source, target, deeplKey, fetchImpl);
        group.forEach((g, j) => {
          results[g.i] = { key: g.key, text: out[j] || "" };
        });
      } catch {
        // Leave this group blank; the MyMemory pass below fills the gaps.
      }
    }
  }

  // Fallback / sole path for unsupported targets: MyMemory, sequential to stay
  // within its per-IP rate limits. Only fills entries still blank.
  for (const g of todo) {
    if (results[g.i].text) continue;
    try {
      results[g.i] = { key: g.key, text: await mymemoryOne(g.text, source, target, mymemoryEmail, fetchImpl) };
    } catch {
      // Graceful: leave blank so the couple fills it in manually rather than erroring.
    }
  }

  return results;
}
