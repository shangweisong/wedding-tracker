// Section photo galleries (#71) — optional photo bands inserted between the
// public wedding-page sections. Single source of truth for the slot list and a
// normalizer that guards the `weddings.section_photos` JSONB shape so the admin
// editor (WeddingPageTab) and the public page (WeddingPage) always agree.
//
// Shape: { "<slotKey>": { enabled: bool, cols: 1..4, photos: ["<publicUrl>"] } }

export const SECTION_PHOTO_SLOTS = [
  { key: "afterHero",         label: "After hero photo" },
  { key: "afterOurStory",     label: "After Our Story" },
  { key: "afterFunQA",        label: "After Fun Q&A" },
  { key: "afterEventDetails", label: "After Event details" },
  { key: "afterGettingThere", label: "After Plan your journey" },
];

export const MAX_PHOTOS_PER_SLOT = 12;
export const MIN_COLS = 1;
export const MAX_COLS = 4;
export const DEFAULT_COLS = 2;

function clampCols(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_COLS;
  return Math.min(MAX_COLS, Math.max(MIN_COLS, n));
}

function normalizeSlot(raw) {
  const slot = raw && typeof raw === "object" ? raw : {};
  const photos = Array.isArray(slot.photos)
    ? slot.photos
        .filter((p) => typeof p === "string" && p.trim() !== "")
        .map((p) => p.trim())
        .slice(0, MAX_PHOTOS_PER_SLOT)
    : [];
  return {
    enabled: Boolean(slot.enabled),
    cols: clampCols(slot.cols),
    photos,
  };
}

// Returns a fully-populated map keyed by every known slot, with each slot
// coerced to a safe { enabled, cols, photos } shape. Unknown keys are dropped.
export function normalizeSectionPhotos(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const { key } of SECTION_PHOTO_SLOTS) {
    out[key] = normalizeSlot(src[key]);
  }
  return out;
}
