// Guest photowall upload orchestrator (#138): prep → grant → direct-to-storage
// upload → confirm. Thin network glue over the tested pure modules
// (photoPrepCore/photowall); the server re-verifies everything at confirm.
import { prepareImage } from "./photoPrep.js";
import {
  cleanUploaderName,
  cleanCaption,
  originalGrantFields,
  plannedOriginalUpload,
} from "./photowall.js";
import { cleanPin } from "./openRsvp.js";

class PhotowallError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

async function postAction(body) {
  let res;
  try {
    res = await fetch("/api/photowall", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new PhotowallError("generic");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) throw new PhotowallError(data?.error || "generic");
  return data;
}

async function uploadToStorage(grant, key, blob, contentType) {
  if (grant.mode === "put") {
    // Cloudflare R2 presigned PUT. Requires the bucket CORS rule documented
    // in .env.example — a missing rule surfaces here as a network error.
    let res;
    try {
      res = await fetch(grant.url, {
        method: "PUT",
        headers: grant.headers || { "Content-Type": contentType },
        body: blob,
      });
    } catch {
      throw new PhotowallError("upload_not_found");
    }
    if (!res.ok) throw new PhotowallError("upload_not_found");
    return { url: null };
  }
  if (grant.mode === "vercel-blob") {
    // Lazy import: the Blob client only ever loads for deployments that use it.
    const { put } = await import("@vercel/blob/client");
    try {
      const result = await put(key, blob, {
        access: "public",
        token: grant.clientToken,
        contentType,
      });
      return { url: result.url };
    } catch {
      throw new PhotowallError("upload_not_found");
    }
  }
  throw new PhotowallError("generic");
}

// -> { url } of the now-live photo. onPhase: "preparing" | "uploading".
// Throws Error with .code mappable via photowallErrorKey().
export async function uploadPhotowallPhoto({ pin, file, uploaderName, caption, onPhase }) {
  onPhase?.("preparing");
  const { blob, contentType } = await prepareImage(file);

  onPhase?.("uploading");
  const granted = await postAction({
    action: "grant",
    pin: cleanPin(pin),
    contentType,
    sizeBytes: blob.size,
    uploaderName: cleanUploaderName(uploaderName),
    caption: cleanCaption(caption),
    // Ignored by the server unless the originals archive (#142) is enabled.
    ...originalGrantFields(file),
  });

  // Originals archive (#142): best-effort, fire-and-forget PUT of the raw
  // source file to the private bucket. Never awaited — the guest's success is
  // owned entirely by the downscaled flow, and confirm must not wait on a
  // 30 MB upload. Closing the tab mid-flight loses the original (accepted:
  // keepalive/sendBeacon cap out at ~64 KB, so there is no mitigation).
  const original = plannedOriginalUpload(granted);
  if (original) {
    uploadToStorage(original.grant, original.key, file, file.type).catch(() => {});
  }

  const { url } = await uploadToStorage(granted.grant, granted.key, blob, contentType);

  const confirmed = await postAction({
    action: "confirm",
    photoId: granted.photoId,
    key: granted.key,
    url,
  });
  return { url: confirmed.url };
}
