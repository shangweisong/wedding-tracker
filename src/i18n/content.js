// ─── COUPLE-CONTENT LOCALIZATION (#53, Phase 2) ───────────────────────────────
// UI chrome is translated via the message catalog (t()). The couple's own text
// lives on the `weddings` row and is translated per-wedding into
// `content_translations = { "<locale>": { <field>, ..., fun_qa: [{id,q,answer}] } }`.
// `localizeWedding` returns a shallow copy with those fields overridden for the
// active locale, falling back to the English value for any blank/missing field.

// Plain text fields on the wedding object that can be translated.
export const TRANSLATABLE_FIELDS = [
  "bride_name",
  "groom_name",
  "love_story",
  "dress_code",
  "venue_name",
  "venue_address",
  "getting_there",
  "smoking_notice",
  "parking_notice",
];

const nonEmpty = (v) => typeof v === "string" && v.trim() !== "";

export function localizeWedding(wedding, locale) {
  if (!wedding || !locale || locale === "en") return wedding;
  const tr = wedding.content_translations?.[locale];
  if (!tr || typeof tr !== "object") return wedding;

  const out = { ...wedding };
  for (const field of TRANSLATABLE_FIELDS) {
    if (nonEmpty(tr[field])) out[field] = tr[field];
  }

  // Fun Q&A: match translated entries to English ones by id; per-field fallback.
  if (Array.isArray(wedding.fun_qa) && Array.isArray(tr.fun_qa)) {
    const byId = new Map(tr.fun_qa.map((x) => [x?.id, x]));
    out.fun_qa = wedding.fun_qa.map((item) => {
      const t = byId.get(item?.id);
      if (!t) return item;
      return {
        ...item,
        q: nonEmpty(t.q) ? t.q : item.q,
        answer: nonEmpty(t.answer) ? t.answer : item.answer,
      };
    });
  }

  return out;
}
