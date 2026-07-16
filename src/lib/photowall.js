// ─── GUEST PHOTOWALL (#138) ───────────────────────────────────────────────────
// Pure helpers for the public photowall section. Uploads are PIN-gated (same
// shared-invitation-secret model as open RSVP); client-side hygiene only — the
// /api/photowall endpoint + supabase/migrations/0011_photowall.sql are the
// authoritative enforcement. Limits mirror api/_lib/photowallCore.js and the
// photowall_photos check constraints.
export const MAX_UPLOADER_NAME = 80;
export const MAX_CAPTION = 280;

// What the file input accepts. HEIC is listed so iPhone galleries open
// unfiltered — Safari decodes it for the canvas re-encode; browsers that
// can't decode HEIC surface wedding.photowall.err.unsupported instead.
export const ACCEPTED_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export const cleanUploaderName = (v) => String(v ?? "").trim().slice(0, MAX_UPLOADER_NAME);
export const cleanCaption = (v) => String(v ?? "").trim().slice(0, MAX_CAPTION);

// Rows whose <img> failed to load are hidden client-side — e.g. the file was
// deleted straight from the storage dashboard while the DB row stayed live
// (only the admin Photowall tab's delete removes both file and row).
export const visiblePhotos = (photos, failedIds) =>
  Array.isArray(photos) ? photos.filter((p) => !failedIds.has(p.id)) : [];

// Maps an /api/photowall (or photoPrep) error code to an i18n key — same
// contract as registerResultErrorKey in openRsvp.js.
export const photowallErrorKey = (error) => {
  if (error === "invalid_pin") return "wedding.photowall.err.pinInvalid";
  if (error === "too_many_attempts") return "wedding.photowall.err.tooManyAttempts";
  if (error === "photowall_disabled") return "wedding.photowall.err.disabled";
  if (error === "photowall_full") return "wedding.photowall.err.full";
  if (error === "too_large") return "wedding.photowall.err.tooLarge";
  if (error === "bad_type") return "wedding.photowall.err.badType";
  if (error === "unsupported_image") return "wedding.photowall.err.unsupported";
  if (error === "upload_not_found") return "wedding.photowall.err.uploadFailed";
  return "wedding.photowall.err.generic";
};
