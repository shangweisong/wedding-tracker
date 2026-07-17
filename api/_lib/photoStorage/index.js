// Unified guest-photo storage. Set PHOTO_STORAGE_PROVIDER to one of:
//   "r2"          — Cloudflare R2 (S3 presigned PUT); R2_* vars + public base URL
//   "vercel-blob" — Vercel Blob (client-token direct upload); BLOB_READ_WRITE_TOKEN
//
// Switching providers = change PHOTO_STORAGE_PROVIDER in Vercel env vars, no
// code change — same contract as api/_lib/emailProvider.js. Leave it unset to
// disable guest uploads server-side.
//
// Provider modules are lazy-imported inside each operation so this index (and
// its tests) never load the AWS/Blob SDKs, and a broken/unused provider can't
// take down the other.

export function photoStorageProvider(env = process.env) {
  const value = (env.PHOTO_STORAGE_PROVIDER || "").trim().toLowerCase();
  if (value === "r2" || value === "vercel-blob") return value;
  return null;
}

// Returns a list of missing required env var names for the configured
// provider. Call at the top of the API handler to catch misconfiguration
// early (same contract as missingEmailEnvVars).
export function missingPhotoStorageEnvVars(env = process.env) {
  const missing = [];
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  const provider = photoStorageProvider(env);
  if (!provider) {
    missing.push("PHOTO_STORAGE_PROVIDER");
    return missing;
  }

  if (provider === "r2") {
    for (const name of [
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET",
      "R2_PUBLIC_BASE_URL",
    ]) {
      if (!env[name]) missing.push(name);
    }
  } else if (!env.BLOB_READ_WRITE_TOKEN) {
    missing.push("BLOB_READ_WRITE_TOKEN");
  }

  return missing;
}

async function providerModule() {
  const provider = photoStorageProvider();
  if (provider === "r2") return import("./r2.js");
  if (provider === "vercel-blob") return import("./vercelBlob.js");
  throw new Error("PHOTO_STORAGE_PROVIDER is not configured");
}

// -> { mode: "put", url, headers } (r2)
//  | { mode: "vercel-blob", clientToken } (blob)
export async function createUploadGrant({ key, contentType, sizeBytes }) {
  const mod = await providerModule();
  return mod.createUploadGrant({ key, contentType, sizeBytes });
}

// -> { exists, size, contentType } — authoritative post-upload check.
export async function headObject({ key, url }) {
  const mod = await providerModule();
  return mod.headObject({ key, url });
}

// -> public https URL for the stored object, or null if it can't be derived
// (blob: requires the client-reported URL to validate against the key).
export async function publicUrlFor({ key, clientUrl }) {
  const mod = await providerModule();
  return mod.publicUrlFor({ key, clientUrl });
}

// Best-effort: swallows not-found so moderation delete stays idempotent.
export async function deleteObject({ key, url }) {
  const mod = await providerModule();
  return mod.deleteObject({ key, url });
}

// ---------------------------------------------------------------------------
// Originals archive (#142). Opt-in via PHOTO_ORIGINALS_PROVIDER=r2: the grant
// response additionally carries a presigned PUT for the guest's UNTOUCHED
// source file, uploaded best-effort to a SEPARATE, PRIVATE bucket
// (R2_ORIGINALS_BUCKET — no r2.dev URL, no custom domain, since
// R2_PUBLIC_BASE_URL would expose a whole bucket). R2-only, independent of
// the downscaled provider above (which is typically vercel-blob here).

export function photoOriginalsProvider(env = process.env) {
  const value = (env.PHOTO_ORIGINALS_PROVIDER || "").trim().toLowerCase();
  return value === "r2" ? "r2" : null;
}

// Unlike missingPhotoStorageEnvVars, an UNSET provider returns [] — the
// archive is an optional add-on, so "off" is a valid state, not a
// misconfiguration. Credentials are shared with the downscaled R2 path; only
// the private bucket name is new.
export function missingPhotoOriginalsEnvVars(env = process.env) {
  if (!photoOriginalsProvider(env)) return [];
  const missing = [];
  for (const name of [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_ORIGINALS_BUCKET",
  ]) {
    if (!env[name]) missing.push(name);
  }
  return missing;
}

// -> { mode: "put", url, headers } targeting the private originals bucket.
export async function createOriginalUploadGrant({ key, contentType, sizeBytes }) {
  const mod = await import("./r2.js");
  return mod.createUploadGrant({
    key,
    contentType,
    sizeBytes,
    bucket: process.env.R2_ORIGINALS_BUCKET,
  });
}

// Moderation cleanup: the original's extension isn't recorded anywhere, so
// list by uuid prefix and delete whatever is there (≤1 object in practice).
// No-op when the feature is off; callers treat every failure as best-effort.
export async function deleteOriginalObjects({ uuid }) {
  if (!photoOriginalsProvider() || !uuid) return;
  const bucket = process.env.R2_ORIGINALS_BUCKET;
  const mod = await import("./r2.js");
  const keys = await mod.listKeys({ prefix: `photowall/originals/${uuid}.`, bucket });
  for (const key of keys) {
    await mod.deleteObject({ key, bucket });
  }
}
