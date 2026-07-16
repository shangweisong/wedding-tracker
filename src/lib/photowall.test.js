import { describe, it, expect } from "vitest";
import {
  MAX_UPLOADER_NAME,
  MAX_CAPTION,
  ACCEPTED_INPUT_TYPES,
  cleanUploaderName,
  cleanCaption,
  photowallErrorKey,
  visiblePhotos,
} from "./photowall.js";

describe("cleanUploaderName / cleanCaption", () => {
  it("trims and clamps to the server limits", () => {
    expect(cleanUploaderName("  Aunty May  ")).toBe("Aunty May");
    expect(cleanUploaderName("x".repeat(200))).toHaveLength(MAX_UPLOADER_NAME);
    expect(cleanCaption("x".repeat(500))).toHaveLength(MAX_CAPTION);
  });

  it("returns empty string for nullish input", () => {
    expect(cleanUploaderName(null)).toBe("");
    expect(cleanCaption(undefined)).toBe("");
  });
});

describe("photowallErrorKey", () => {
  it("maps every server error code to its i18n key", () => {
    expect(photowallErrorKey("invalid_pin")).toBe("wedding.photowall.err.pinInvalid");
    expect(photowallErrorKey("too_many_attempts")).toBe("wedding.photowall.err.tooManyAttempts");
    expect(photowallErrorKey("photowall_disabled")).toBe("wedding.photowall.err.disabled");
    expect(photowallErrorKey("photowall_full")).toBe("wedding.photowall.err.full");
    expect(photowallErrorKey("too_large")).toBe("wedding.photowall.err.tooLarge");
    expect(photowallErrorKey("bad_type")).toBe("wedding.photowall.err.badType");
    expect(photowallErrorKey("unsupported_image")).toBe("wedding.photowall.err.unsupported");
    expect(photowallErrorKey("upload_not_found")).toBe("wedding.photowall.err.uploadFailed");
  });

  it("falls back to the generic key for unknown codes", () => {
    expect(photowallErrorKey("weird")).toBe("wedding.photowall.err.generic");
    expect(photowallErrorKey(undefined)).toBe("wedding.photowall.err.generic");
  });
});

describe("visiblePhotos", () => {
  const rows = [
    { id: "a", public_url: "https://blob.example/a.jpg" },
    { id: "b", public_url: "https://blob.example/b.jpg" },
    { id: "c", public_url: "https://blob.example/c.jpg" },
  ];

  it("filters out rows whose id is in the failed set", () => {
    expect(visiblePhotos(rows, new Set(["b"]))).toEqual([rows[0], rows[2]]);
  });

  it("returns all rows when nothing has failed", () => {
    expect(visiblePhotos(rows, new Set())).toEqual(rows);
  });

  it("returns an empty list when every image has failed", () => {
    expect(visiblePhotos(rows, new Set(["a", "b", "c"]))).toEqual([]);
  });

  it("returns [] for non-array input", () => {
    expect(visiblePhotos(null, new Set())).toEqual([]);
    expect(visiblePhotos(undefined, new Set())).toEqual([]);
  });
});

describe("constants", () => {
  it("keeps client limits in sync with the server module", () => {
    expect(MAX_UPLOADER_NAME).toBe(80);
    expect(MAX_CAPTION).toBe(280);
  });

  it("accepts the camera/gallery types the prep step can decode", () => {
    expect(ACCEPTED_INPUT_TYPES).toContain("image/jpeg");
    expect(ACCEPTED_INPUT_TYPES).toContain("image/png");
    expect(ACCEPTED_INPUT_TYPES).toContain("image/webp");
    expect(ACCEPTED_INPUT_TYPES).toContain("image/heic");
  });
});
