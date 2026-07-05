// Hero focal point (#75) — lets the couple anchor how the hero photo is cropped
// when it doesn't match the wide hero box. Single source of truth for the 9-point
// grid, shared by the admin editor (WeddingPageTab) and the public page
// (WeddingPage), plus a normalizer that guards the untrusted `hero_focal_point`
// value so both sides always agree and only safe CSS reaches `background-position`.
//
// Each `css` is a literal `background-position` value; the photo still uses
// `background-size: cover`, so the focal point only re-anchors the crop — it never
// leaves empty space.

export const DEFAULT_FOCAL_POINT = "center";

// Ordered top-left → bottom-right so the editor can lay them out as a 3×3 grid.
export const FOCAL_POINTS = [
  { key: "leftTop",      css: "left top",      label: "Top left" },
  { key: "centerTop",    css: "center top",    label: "Top" },
  { key: "rightTop",     css: "right top",     label: "Top right" },
  { key: "leftCenter",   css: "left center",   label: "Left" },
  { key: "center",       css: "center",        label: "Center" },
  { key: "rightCenter",  css: "right center",  label: "Right" },
  { key: "leftBottom",   css: "left bottom",   label: "Bottom left" },
  { key: "centerBottom", css: "center bottom", label: "Bottom" },
  { key: "rightBottom",  css: "right bottom",  label: "Bottom right" },
];

const VALID = new Set(FOCAL_POINTS.map((p) => p.css));

// Returns the value if it is one of the 9 whitelisted `background-position`
// strings, otherwise the safe default. Guards the public render against a bad,
// legacy, or hostile stored value (the write RPC is granted to anon).
export function normalizeFocalPoint(value) {
  if (typeof value !== "string") return DEFAULT_FOCAL_POINT;
  const v = value.trim();
  return VALID.has(v) ? v : DEFAULT_FOCAL_POINT;
}
