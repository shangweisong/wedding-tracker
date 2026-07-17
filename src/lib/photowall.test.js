import { describe, it, expect } from "vitest";
import {
  MAX_UPLOADER_NAME,
  MAX_CAPTION,
  ACCEPTED_INPUT_TYPES,
  cleanUploaderName,
  cleanCaption,
  photowallErrorKey,
  visiblePhotos,
  filterPhotosByUploader,
  originalGrantFields,
  plannedOriginalUpload,
} from "./photowall.js";

describe("originalGrantFields", () => {
  it("extracts the original's declared type and size from the source file", () => {
    expect(originalGrantFields({ type: "image/heic", size: 8_000_000 })).toEqual({
      originalContentType: "image/heic",
      originalSizeBytes: 8_000_000,
    });
  });

  it("returns {} when the file has no usable type or size", () => {
    expect(originalGrantFields(null)).toEqual({});
    expect(originalGrantFields(undefined)).toEqual({});
    expect(originalGrantFields({ type: "", size: 1000 })).toEqual({});
    expect(originalGrantFields({ type: "image/jpeg", size: 0 })).toEqual({});
    expect(originalGrantFields({ type: "image/jpeg", size: -5 })).toEqual({});
    expect(originalGrantFields({ type: "image/jpeg", size: 10.5 })).toEqual({});
    expect(originalGrantFields({ type: "image/jpeg", size: NaN })).toEqual({});
    expect(originalGrantFields({ type: "image/jpeg" })).toEqual({});
  });
});

describe("plannedOriginalUpload", () => {
  const good = {
    photoId: "p1",
    key: "photowall/abc.jpg",
    grant: { mode: "vercel-blob", clientToken: "t" },
    original: {
      key: "photowall/originals/abc.heic",
      grant: { mode: "put", url: "https://acct.r2.cloudflarestorage.com/x", headers: {} },
    },
  };

  it("returns the original's key + grant when the server minted one", () => {
    expect(plannedOriginalUpload(good)).toEqual({
      key: "photowall/originals/abc.heic",
      grant: good.original.grant,
    });
  });

  it("returns null when the response carries no (or a malformed) original", () => {
    expect(plannedOriginalUpload({ photoId: "p1", key: "k", grant: {} })).toBe(null);
    expect(plannedOriginalUpload(null)).toBe(null);
    expect(plannedOriginalUpload(undefined)).toBe(null);
    expect(plannedOriginalUpload({ ...good, original: { ...good.original, key: 42 } })).toBe(null);
    expect(plannedOriginalUpload({ ...good, original: { ...good.original, grant: null } })).toBe(null);
    expect(
      plannedOriginalUpload({
        ...good,
        original: { ...good.original, grant: { mode: "vercel-blob", clientToken: "t" } },
      })
    ).toBe(null);
    expect(
      plannedOriginalUpload({
        ...good,
        original: { ...good.original, grant: { mode: "put", url: 42 } },
      })
    ).toBe(null);
  });
});

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

describe("filterPhotosByUploader", () => {
  const rows = [
    { id: "a", uploader_name: "Aunty May" },
    { id: "b", uploader_name: "Uncle Bob" },
    { id: "c", uploader_name: null },
  ];

  it("returns all photos for an empty query", () => {
    expect(filterPhotosByUploader(rows, "")).toEqual(rows);
  });

  it("returns all photos for a whitespace-only query", () => {
    expect(filterPhotosByUploader(rows, "   ")).toEqual(rows);
  });

  it("matches case-insensitively", () => {
    expect(filterPhotosByUploader(rows, "aunty may")).toEqual([rows[0]]);
    expect(filterPhotosByUploader(rows, "UNCLE")).toEqual([rows[1]]);
  });

  it("matches partial names", () => {
    expect(filterPhotosByUploader(rows, "bob")).toEqual([rows[1]]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterPhotosByUploader(rows, "zzz")).toEqual([]);
  });

  it('treats a missing uploader name as "Anonymous" (matching the row display)', () => {
    expect(filterPhotosByUploader(rows, "anon")).toEqual([rows[2]]);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(filterPhotosByUploader(rows, "  bob  ")).toEqual([rows[1]]);
  });

  it("returns [] for non-array input", () => {
    expect(filterPhotosByUploader(null, "bob")).toEqual([]);
    expect(filterPhotosByUploader(undefined, "")).toEqual([]);
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
