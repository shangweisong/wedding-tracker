import { describe, it, expect } from "vitest";
import { FOCAL_POINTS, DEFAULT_FOCAL_POINT, normalizeFocalPoint } from "./heroFocalPoint.js";

describe("FOCAL_POINTS", () => {
  it("exposes the 9 grid cells with unique keys and css values", () => {
    expect(FOCAL_POINTS).toHaveLength(9);
    const keys = FOCAL_POINTS.map((p) => p.key);
    const css = FOCAL_POINTS.map((p) => p.css);
    expect(new Set(keys).size).toBe(9);
    expect(new Set(css).size).toBe(9);
    for (const p of FOCAL_POINTS) {
      expect(typeof p.key).toBe("string");
      expect(typeof p.css).toBe("string");
      expect(typeof p.label).toBe("string");
    }
  });

  it("uses 'center' as the default and includes it in the grid", () => {
    expect(DEFAULT_FOCAL_POINT).toBe("center");
    expect(FOCAL_POINTS.map((p) => p.css)).toContain("center");
  });
});

describe("normalizeFocalPoint", () => {
  it("passes through every whitelisted css value unchanged", () => {
    for (const { css } of FOCAL_POINTS) {
      expect(normalizeFocalPoint(css)).toBe(css);
    }
  });

  it("falls back to 'center' for unknown / empty / non-string input", () => {
    for (const input of [undefined, null, "", "  ", "nope", "top", "left", 42, {}, [], "center; url(x)"]) {
      expect(normalizeFocalPoint(input)).toBe("center");
    }
  });

  it("trims surrounding whitespace before matching", () => {
    expect(normalizeFocalPoint("  left top  ")).toBe("left top");
  });
});
