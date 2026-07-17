import { describe, it, expect } from "vitest";
import {
  photoStorageProvider,
  missingPhotoStorageEnvVars,
  photoOriginalsProvider,
  missingPhotoOriginalsEnvVars,
} from "./index.js";

const R2_ENV = {
  PHOTO_STORAGE_PROVIDER: "r2",
  R2_ACCOUNT_ID: "acct",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: "photos",
  R2_PUBLIC_BASE_URL: "https://pub-x.r2.dev",
  SUPABASE_SERVICE_ROLE_KEY: "svc",
};

const BLOB_ENV = {
  PHOTO_STORAGE_PROVIDER: "vercel-blob",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x",
  SUPABASE_SERVICE_ROLE_KEY: "svc",
};

describe("photoStorageProvider", () => {
  it("returns the configured provider", () => {
    expect(photoStorageProvider(R2_ENV)).toBe("r2");
    expect(photoStorageProvider(BLOB_ENV)).toBe("vercel-blob");
  });

  it("is case/whitespace tolerant", () => {
    expect(photoStorageProvider({ PHOTO_STORAGE_PROVIDER: " R2 " })).toBe("r2");
  });

  it("returns null when unset or unknown (feature disabled)", () => {
    expect(photoStorageProvider({})).toBe(null);
    expect(photoStorageProvider({ PHOTO_STORAGE_PROVIDER: "" })).toBe(null);
    expect(photoStorageProvider({ PHOTO_STORAGE_PROVIDER: "s3" })).toBe(null);
  });
});

describe("missingPhotoStorageEnvVars", () => {
  it("returns [] when the r2 provider is fully configured", () => {
    expect(missingPhotoStorageEnvVars(R2_ENV)).toEqual([]);
  });

  it("returns [] when the vercel-blob provider is fully configured", () => {
    expect(missingPhotoStorageEnvVars(BLOB_ENV)).toEqual([]);
  });

  it("reports PHOTO_STORAGE_PROVIDER when no provider is set", () => {
    expect(missingPhotoStorageEnvVars({})).toContain("PHOTO_STORAGE_PROVIDER");
  });

  it("reports each missing r2 var", () => {
    const missing = missingPhotoStorageEnvVars({
      PHOTO_STORAGE_PROVIDER: "r2",
      SUPABASE_SERVICE_ROLE_KEY: "svc",
    });
    expect(missing).toEqual(
      expect.arrayContaining([
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET",
        "R2_PUBLIC_BASE_URL",
      ])
    );
  });

  it("reports the blob token for vercel-blob", () => {
    const missing = missingPhotoStorageEnvVars({
      PHOTO_STORAGE_PROVIDER: "vercel-blob",
      SUPABASE_SERVICE_ROLE_KEY: "svc",
    });
    expect(missing).toEqual(["BLOB_READ_WRITE_TOKEN"]);
  });

  it("always requires the service role key", () => {
    const missing = missingPhotoStorageEnvVars({ ...R2_ENV, SUPABASE_SERVICE_ROLE_KEY: "" });
    expect(missing).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});

const ORIGINALS_ENV = {
  PHOTO_ORIGINALS_PROVIDER: "r2",
  R2_ACCOUNT_ID: "acct",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_ORIGINALS_BUCKET: "photo-originals",
};

describe("photoOriginalsProvider", () => {
  it("returns r2 when configured, case/whitespace tolerant", () => {
    expect(photoOriginalsProvider(ORIGINALS_ENV)).toBe("r2");
    expect(photoOriginalsProvider({ PHOTO_ORIGINALS_PROVIDER: " R2 " })).toBe("r2");
  });

  it("returns null when unset or unknown (feature off)", () => {
    expect(photoOriginalsProvider({})).toBe(null);
    expect(photoOriginalsProvider({ PHOTO_ORIGINALS_PROVIDER: "" })).toBe(null);
    expect(photoOriginalsProvider({ PHOTO_ORIGINALS_PROVIDER: "vercel-blob" })).toBe(null);
    expect(photoOriginalsProvider({ PHOTO_ORIGINALS_PROVIDER: "s3" })).toBe(null);
  });
});

describe("missingPhotoOriginalsEnvVars", () => {
  it("returns [] when the feature is off (unset provider is not an error)", () => {
    expect(missingPhotoOriginalsEnvVars({})).toEqual([]);
    expect(missingPhotoOriginalsEnvVars({ PHOTO_ORIGINALS_PROVIDER: "" })).toEqual([]);
  });

  it("returns [] when r2 originals are fully configured", () => {
    expect(missingPhotoOriginalsEnvVars(ORIGINALS_ENV)).toEqual([]);
  });

  it("reports each missing r2 var, and only those", () => {
    expect(missingPhotoOriginalsEnvVars({ PHOTO_ORIGINALS_PROVIDER: "r2" })).toEqual([
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_ORIGINALS_BUCKET",
    ]);
    expect(
      missingPhotoOriginalsEnvVars({ ...ORIGINALS_ENV, R2_ORIGINALS_BUCKET: "" })
    ).toEqual(["R2_ORIGINALS_BUCKET"]);
  });

  it("does not require the downscaled-path vars (bucket, public URL, service key)", () => {
    const missing = missingPhotoOriginalsEnvVars(ORIGINALS_ENV);
    expect(missing).not.toContain("R2_BUCKET");
    expect(missing).not.toContain("R2_PUBLIC_BASE_URL");
    expect(missing).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
