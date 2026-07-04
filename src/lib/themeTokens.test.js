import { describe, it, expect } from "vitest";
import {
  THEME_TOKEN_KEYS,
  isValidColor,
  sanitizeThemeTokens,
  isCompleteThemeTokens,
  themeTokenStyle,
} from "./themeTokens.js";

const FULL = {
  background: "#faf7f2",
  surface: "#f5f0e8",
  accent: "#c9a84c",
  accentLight: "#e8d5a3",
  accentDark: "#a07830",
  heading: "#2c2416",
  text: "#5c4a2a",
};

describe("isValidColor", () => {
  it("accepts 3-, 6-, and 8-digit hex colors", () => {
    expect(isValidColor("#abc")).toBe(true);
    expect(isValidColor("#AABBCC")).toBe(true);
    expect(isValidColor("#aabbccdd")).toBe(true);
  });
  it("rejects non-hex, injection, and non-strings", () => {
    expect(isValidColor("red")).toBe(false);
    expect(isValidColor("rgb(0,0,0)")).toBe(false);
    expect(isValidColor("#fff; background:url(x)")).toBe(false);
    expect(isValidColor("")).toBe(false);
    expect(isValidColor(123)).toBe(false);
    expect(isValidColor(null)).toBe(false);
  });
});

describe("sanitizeThemeTokens", () => {
  it("keeps only known keys with valid hex colors", () => {
    const out = sanitizeThemeTokens({
      ...FULL,
      accent: "notacolor",
      evil: "#000; }",
      "--x": "#fff",
    });
    expect(out).not.toHaveProperty("accent"); // invalid dropped
    expect(out).not.toHaveProperty("evil"); // unknown dropped
    expect(out).not.toHaveProperty("--x"); // unknown dropped
    expect(out.background).toBe("#faf7f2");
  });
  it("trims whitespace and returns {} for non-objects", () => {
    expect(sanitizeThemeTokens({ accent: "  #c9a84c  " }).accent).toBe("#c9a84c");
    expect(sanitizeThemeTokens(null)).toEqual({});
    expect(sanitizeThemeTokens("nope")).toEqual({});
  });
});

describe("isCompleteThemeTokens", () => {
  it("is true only when every token key is a valid color", () => {
    expect(isCompleteThemeTokens(FULL)).toBe(true);
    const missing = { ...FULL };
    delete missing.text;
    expect(isCompleteThemeTokens(missing)).toBe(false);
    expect(isCompleteThemeTokens({})).toBe(false);
  });
});

describe("themeTokenStyle", () => {
  it("maps a complete palette to CSS custom properties + background", () => {
    const style = themeTokenStyle(FULL);
    expect(style.background).toBe("#faf7f2");
    expect(style["--gold"]).toBe("#c9a84c");
    expect(style["--gold-light"]).toBe("#e8d5a3");
    expect(style["--gold-dark"]).toBe("#a07830");
    expect(style["--charcoal"]).toBe("#2c2416");
    expect(style["--brown"]).toBe("#5c4a2a");
    expect(style["--warm-white"]).toBe("#f5f0e8");
  });
  it("returns {} for an incomplete or invalid palette (no partial theming)", () => {
    const missing = { ...FULL };
    delete missing.accent;
    expect(themeTokenStyle(missing)).toEqual({});
    expect(themeTokenStyle({})).toEqual({});
  });
  it("covers every declared token key", () => {
    expect(THEME_TOKEN_KEYS.sort()).toEqual(Object.keys(FULL).sort());
  });
});
