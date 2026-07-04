import { describe, it, expect } from "vitest";
import {
  SECTION_PHOTO_SLOTS,
  MAX_PHOTOS_PER_SLOT,
  normalizeSectionPhotos,
} from "./sectionPhotos.js";

const KEYS = SECTION_PHOTO_SLOTS.map((s) => s.key);

describe("normalizeSectionPhotos", () => {
  it("returns every known slot with defaults for empty/undefined input", () => {
    for (const input of [undefined, null, {}, "nope", 42]) {
      const out = normalizeSectionPhotos(input);
      expect(Object.keys(out).sort()).toEqual([...KEYS].sort());
      for (const key of KEYS) {
        expect(out[key]).toEqual({ enabled: false, cols: 2, photos: [] });
      }
    }
  });

  it("coerces enabled to a boolean", () => {
    const out = normalizeSectionPhotos({
      afterHero: { enabled: 1 },
      afterOurStory: { enabled: "yes" },
      afterFunQA: { enabled: 0 },
    });
    expect(out.afterHero.enabled).toBe(true);
    expect(out.afterOurStory.enabled).toBe(true);
    expect(out.afterFunQA.enabled).toBe(false);
  });

  it("clamps cols to the 1..4 range and rounds", () => {
    expect(normalizeSectionPhotos({ afterHero: { cols: 0 } }).afterHero.cols).toBe(1);
    expect(normalizeSectionPhotos({ afterHero: { cols: -3 } }).afterHero.cols).toBe(1);
    expect(normalizeSectionPhotos({ afterHero: { cols: 5 } }).afterHero.cols).toBe(4);
    expect(normalizeSectionPhotos({ afterHero: { cols: 3 } }).afterHero.cols).toBe(3);
    expect(normalizeSectionPhotos({ afterHero: { cols: 2.6 } }).afterHero.cols).toBe(3);
  });

  it("defaults cols to 2 when missing or non-numeric", () => {
    expect(normalizeSectionPhotos({ afterHero: {} }).afterHero.cols).toBe(2);
    expect(normalizeSectionPhotos({ afterHero: { cols: "wide" } }).afterHero.cols).toBe(2);
  });

  it("keeps only non-empty, trimmed string URLs", () => {
    const out = normalizeSectionPhotos({
      afterHero: {
        photos: ["  https://x/a.jpg  ", "", "   ", null, 5, { url: "b" }, "https://x/b.png"],
      },
    });
    expect(out.afterHero.photos).toEqual(["https://x/a.jpg", "https://x/b.png"]);
  });

  it("treats a non-array photos value as empty", () => {
    expect(normalizeSectionPhotos({ afterHero: { photos: "x.jpg" } }).afterHero.photos).toEqual([]);
  });

  it("caps photos at MAX_PHOTOS_PER_SLOT", () => {
    const many = Array.from({ length: MAX_PHOTOS_PER_SLOT + 5 }, (_, i) => `https://x/${i}.jpg`);
    const out = normalizeSectionPhotos({ afterEventDetails: { photos: many } });
    expect(out.afterEventDetails.photos).toHaveLength(MAX_PHOTOS_PER_SLOT);
    expect(out.afterEventDetails.photos[0]).toBe("https://x/0.jpg");
  });

  it("ignores unknown slot keys", () => {
    const out = normalizeSectionPhotos({ bogusSlot: { enabled: true, photos: ["a"] } });
    expect(out).not.toHaveProperty("bogusSlot");
    expect(Object.keys(out).sort()).toEqual([...KEYS].sort());
  });
});
