// Guest photowall endpoint (#138) — the app's first anon-facing api/ route.
// One Vercel function, POST-only, dispatched on body.action:
//
//   "grant"   (anon)   — PIN-gated: validates the payload, asks the DB (via the
//                        service-role-only begin_photowall_upload RPC, which owns
//                        the durable attempt log + caps) to create a pending
//                        metadata row, and returns a provider-specific upload
//                        grant. File bytes NEVER pass through this function —
//                        the browser uploads directly to storage (Vercel's
//                        4.5 MB body cap makes proxying impossible anyway).
//   "confirm" (anon)   — HEAD-verifies the uploaded object (exists, size, type)
//                        and flips the row pending → live with a
//                        server-computed public URL.
//   "delete"  (couple) — moderation: removes the storage object (best-effort)
//                        and the metadata row. Hide/unhide never comes here —
//                        the couple updates the row directly under RLS.
//
// Storage provider (Cloudflare R2 | Vercel Blob) is selected by
// PHOTO_STORAGE_PROVIDER — see ./_lib/photoStorage/index.js.
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "./_lib/supabaseAdmin.js";
import { authorizedCoupleEmail, makeRateLimiter } from "./_lib/requireCoupleAuth.js";
import {
  makeObjectKey,
  makeOriginalObjectKey,
  validateGrantRequest,
  validateOriginalRequest,
  uuidFromObjectKey,
  clampUploaderName,
  clampCaption,
  clientIp,
  MAX_UPLOAD_BYTES,
} from "./_lib/photowallCore.js";
import {
  createUploadGrant,
  headObject,
  publicUrlFor,
  deleteObject,
  missingPhotoStorageEnvVars,
  photoOriginalsProvider,
  missingPhotoOriginalsEnvVars,
  createOriginalUploadGrant,
  deleteOriginalObjects,
} from "./_lib/photoStorage/index.js";

// Per-IP cap on grant requests (best-effort, per warm instance — the durable
// brute-force gate is the photowall_pin_attempts table inside the RPC).
const rateLimited = makeRateLimiter({ windowMs: 10 * 60_000, max: 10 });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { action } = req.body ?? {};

  // Storage config is required for uploads only — moderation delete must keep
  // working (row removal + best-effort object cleanup) even when the provider
  // is unset or its credentials are mid-rotation.
  if (action === "grant" || action === "confirm") {
    const missing = missingPhotoStorageEnvVars();
    if (missing.length) {
      console.error(`photowall: missing env vars: ${missing.join(", ")}`);
      return res.status(500).json({ error: "photowall_disabled" });
    }
  }

  if (action === "grant") return grant(req, res);
  if (action === "confirm") return confirm(req, res);
  if (action === "delete") return remove(req, res);
  return res.status(400).json({ error: "unknown action" });
}

async function grant(req, res) {
  if (rateLimited(clientIp(req))) {
    return res.status(429).json({ error: "too_many_attempts" });
  }

  const { pin, contentType, sizeBytes, uploaderName, caption, originalContentType, originalSizeBytes } =
    req.body ?? {};
  const shape = validateGrantRequest({ pin, contentType, sizeBytes });
  if (shape.error) return res.status(400).json({ error: shape.error });

  const admin = supabaseAdmin();
  await pruneStalePending(admin);

  const uuid = randomUUID();
  const key = makeObjectKey(uuid, contentType);
  const { data, error } = await admin.rpc("begin_photowall_upload", {
    p_pin: pin,
    p_uploader_name: clampUploaderName(uploaderName),
    p_caption: clampCaption(caption),
    p_content_type: contentType,
    p_size_bytes: sizeBytes,
    p_object_key: key,
  });
  if (error) {
    console.error("photowall grant rpc failed:", error.message);
    return res.status(500).json({ error: "generic" });
  }
  if (data?.error) {
    // invalid_pin / too_many_attempts / photowall_disabled / photowall_full —
    // returned with their own statuses so clients can distinguish retryable
    // states, but the body code is what the UI maps to i18n.
    const status =
      data.error === "too_many_attempts" ? 429 :
      data.error === "invalid_pin" ? 401 :
      data.error === "photowall_full" ? 409 : 403;
    return res.status(status).json({ error: data.error });
  }

  let uploadGrant;
  try {
    uploadGrant = await createUploadGrant({ key, contentType, sizeBytes });
  } catch (e) {
    // Roll the pending row back so a provider outage can't eat the caps.
    console.error("photowall grant creation failed:", e?.message || e);
    await admin.from("photowall_photos").delete().eq("id", data.id).then(
      () => {},
      () => {}
    );
    return res.status(500).json({ error: "generic" });
  }

  // Originals archive (#142): opt-in side-channel. Minted only after the RPC
  // succeeded, so the PIN gate + caps bound original grants 1:1 with
  // downscaled ones. Everything here is log-and-omit — an archive misconfig
  // or provider hiccup must never turn into a guest-facing error (which is
  // also why missingPhotoOriginalsEnvVars is not in the handler-top gate).
  let original = null;
  if (photoOriginalsProvider()) {
    const missingOriginals = missingPhotoOriginalsEnvVars();
    if (missingOriginals.length) {
      console.error(`photowall originals: missing env vars: ${missingOriginals.join(", ")}`);
    } else if (validateOriginalRequest({ originalContentType, originalSizeBytes }).ok) {
      const originalKey = makeOriginalObjectKey(uuid, originalContentType);
      if (originalKey) {
        try {
          original = {
            key: originalKey,
            grant: await createOriginalUploadGrant({
              key: originalKey,
              contentType: originalContentType,
              sizeBytes: originalSizeBytes,
            }),
          };
        } catch (e) {
          console.error("photowall original grant failed:", e?.message || e);
        }
      }
    }
  }

  return res
    .status(200)
    .json({ photoId: data.id, key, grant: uploadGrant, ...(original ? { original } : {}) });
}

async function confirm(req, res) {
  const { photoId, key, url } = req.body ?? {};
  if (typeof photoId !== "string" || typeof key !== "string" || !photoId || !key) {
    return res.status(400).json({ error: "generic" });
  }

  const admin = supabaseAdmin();
  const { data: rows, error: selError } = await admin
    .from("photowall_photos")
    .select("id, object_key, status, content_type")
    .eq("id", photoId)
    .limit(1);
  if (selError) {
    console.error("photowall confirm select failed:", selError.message);
    return res.status(500).json({ error: "generic" });
  }
  const row = rows?.[0];
  if (!row || row.status !== "pending" || row.object_key !== key) {
    return res.status(409).json({ error: "upload_not_found" });
  }

  const meta = await headObject({ key, url });
  if (!meta.exists) return res.status(409).json({ error: "upload_not_found" });
  if (meta.size > MAX_UPLOAD_BYTES || !(meta.contentType || "").startsWith("image/")) {
    // Object violates the caps the grant promised — remove it outright.
    await deleteObject({ key, url }).catch(() => {});
    return res.status(400).json({ error: "too_large" });
  }

  const publicUrl = await publicUrlFor({ key, clientUrl: url });
  if (!publicUrl) return res.status(400).json({ error: "generic" });

  const { data, error } = await admin.rpc("confirm_photowall_photo", {
    p_id: photoId,
    p_public_url: publicUrl,
    p_size_bytes: meta.size,
  });
  if (error) {
    console.error("photowall confirm rpc failed:", error.message);
    return res.status(500).json({ error: "generic" });
  }
  if (data?.error) return res.status(409).json({ error: "upload_not_found" });

  return res.status(200).json({ url: publicUrl });
}

async function remove(req, res) {
  const callerEmail = await authorizedCoupleEmail(req);
  if (!callerEmail) return res.status(401).json({ error: "unauthorized" });

  const { photoId } = req.body ?? {};
  if (typeof photoId !== "string" || !photoId) {
    return res.status(400).json({ error: "generic" });
  }

  const admin = supabaseAdmin();
  const { data: rows, error: selError } = await admin
    .from("photowall_photos")
    .select("id, object_key, public_url")
    .eq("id", photoId)
    .limit(1);
  if (selError) {
    console.error("photowall delete select failed:", selError.message);
    return res.status(500).json({ error: "generic" });
  }
  const row = rows?.[0];
  if (row) {
    await deleteObject({ key: row.object_key, url: row.public_url }).catch((e) => {
      // Best-effort: an unreachable store must not leave the photo visible.
      console.error("photowall storage delete failed:", e?.message || e);
    });
    // A guest asking for removal expects the EXIF-laden original gone too —
    // best-effort delete of the archived copy (#142); no-op when the archive
    // is off. The original's ext isn't recorded, hence the uuid-prefix list.
    await deleteOriginalObjects({ uuid: uuidFromObjectKey(row.object_key) }).catch((e) => {
      console.error("photowall original delete failed:", e?.message || e);
    });
    const { error: delError } = await admin.from("photowall_photos").delete().eq("id", photoId);
    if (delError) {
      console.error("photowall row delete failed:", delError.message);
      return res.status(500).json({ error: "generic" });
    }
  }
  return res.status(200).json({ ok: true });
}

// Guests who got a grant but never finished uploading leave invisible pending
// rows (and possibly orphaned objects). Opportunistically clean a small batch
// on each grant — same self-maintenance stance as the attempt-log pruning in
// the RPC; no cron needed. The 1-hour TTL keeps the RPC's 50-pending
// grant-flood guard from locking out real guests for long: an actual upload
// confirms within seconds of its grant.
async function pruneStalePending(admin) {
  try {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: stale } = await admin
      .from("photowall_photos")
      .select("id, object_key, public_url")
      .eq("status", "pending")
      .lt("created_at", cutoff)
      .limit(10);
    for (const row of stale || []) {
      try {
        // Storage first, row second — if the provider is down, keep the row
        // so a later prune can still find (and delete) the orphaned object.
        await deleteObject({ key: row.object_key, url: row.public_url });
        await admin.from("photowall_photos").delete().eq("id", row.id);
      } catch (e) {
        console.error("photowall prune skipped a row:", e?.message || e);
      }
    }
  } catch (e) {
    console.error("photowall prune failed:", e?.message || e);
  }
}
