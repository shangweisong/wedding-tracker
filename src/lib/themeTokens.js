// Theme tokens (#60): a constrained, color-only palette derived from an uploaded
// image by a vision LLM and applied to the public wedding page as CSS-variable
// overrides. Color-only by design — generation can never inject arbitrary CSS or
// markup, only hex colors that map to a fixed set of custom properties.

export const THEME_TOKEN_KEYS = [
  "background",  // page background
  "surface",     // cards / warm-white surfaces
  "accent",      // gold accent
  "accentLight",
  "accentDark",
  "heading",     // charcoal headings
  "text",        // body/brown text
];

// Maps each token (except `background`, applied directly) to the CSS custom
// property it overrides on the public page's `.wp` container.
export const TOKEN_TO_CSS_VAR = {
  surface: "--warm-white",
  accent: "--gold",
  accentLight: "--gold-light",
  accentDark: "--gold-dark",
  heading: "--charcoal",
  text: "--brown",
};

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isValidColor(value) {
  return typeof value === "string" && HEX_COLOR.test(value.trim());
}

// Keep only known keys whose value is a valid hex color; drop everything else.
// Returns a clean (possibly partial) object — callers treat empty as "no theme".
export function sanitizeThemeTokens(input) {
  if (!input || typeof input !== "object") return {};
  const out = {};
  for (const key of THEME_TOKEN_KEYS) {
    if (isValidColor(input[key])) out[key] = input[key].trim();
  }
  return out;
}

// A palette is usable only when every token is present and valid.
export function isCompleteThemeTokens(input) {
  const clean = sanitizeThemeTokens(input);
  return THEME_TOKEN_KEYS.every((k) => clean[k]);
}

// Inline style object (CSS custom properties + background) for the public page
// when the custom theme is active. Returns {} unless the palette is complete, so
// an incomplete palette falls back to the preset theme rather than half-applying.
export function themeTokenStyle(tokens) {
  const clean = sanitizeThemeTokens(tokens);
  if (!isCompleteThemeTokens(clean)) return {};
  const style = { background: clean.background };
  for (const [key, cssVar] of Object.entries(TOKEN_TO_CSS_VAR)) {
    style[cssVar] = clean[key];
  }
  return style;
}
