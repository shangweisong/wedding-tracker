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

// Admin Photowall tab search: case-insensitive substring match on uploader
// name. Unnamed uploads match "Anonymous" — the label the row displays.
export const filterPhotosByUploader = (photos, query) => {
  if (!Array.isArray(photos)) return [];
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return photos;
  return photos.filter((p) => (p.uploader_name || "Anonymous").toLowerCase().includes(q));
};

// Originals archive (#142): fields describing the guest's UNTOUCHED source
// file, sent with every grant request. The server ignores them unless
// PHOTO_ORIGINALS_PROVIDER is configured, so sending them is always safe.
export const originalGrantFields = (file) => {
  const type = file?.type;
  const size = file?.size;
  if (typeof type !== "string" || !type) return {};
  if (!Number.isInteger(size) || size < 1) return {};
  return { originalContentType: type, originalSizeBytes: size };
};

// Shape-validates the optional `original` field of a grant response so a
// malformed server payload can never throw inside the guest upload path.
// Only presigned-PUT grants are ever minted for originals.
export const plannedOriginalUpload = (grantResponse) => {
  const original = grantResponse?.original;
  if (!original || typeof original.key !== "string" || !original.key) return null;
  const grant = original.grant;
  if (!grant || grant.mode !== "put" || typeof grant.url !== "string" || !grant.url) return null;
  return { key: original.key, grant };
};

// Tiny inline-SVG placeholders for demo mode (CSP allows data: in img-src).
// Shared by the public PhotowallSection and the admin D-Day slideshow (#149).
export const demoSvg = (w, h, bg, label) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<rect width="${w}" height="${h}" fill="${bg}"/>` +
      `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" opacity="0.85" font-family="Georgia, serif" font-size="${Math.round(w / 12)}">${label}</text>` +
    `</svg>`
  )}`;

export const DEMO_PHOTOWALL = [
  { id: "p1", public_url: demoSvg(400, 533, "#8a9a5b", "🥂"), uploader_name: "Aunty May", caption: "So proud of you two!", created_at: "2026-12-27T12:10:00Z" },
  { id: "p2", public_url: demoSvg(400, 300, "#b08d57", "💐"), uploader_name: "Jon & Priya", caption: "Beautiful ceremony", created_at: "2026-12-27T12:05:00Z" },
  { id: "p3", public_url: demoSvg(400, 400, "#7d6b91", "📸"), uploader_name: "", caption: "", created_at: "2026-12-27T11:58:00Z" },
  { id: "p4", public_url: demoSvg(400, 533, "#a26769", "🎉"), uploader_name: "The Tans", caption: "Congratulations!", created_at: "2026-12-27T11:45:00Z" },
  { id: "p5", public_url: demoSvg(400, 320, "#5b7c99", "💍"), uploader_name: "Wei Jie", caption: "", created_at: "2026-12-27T11:30:00Z" },
];

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
