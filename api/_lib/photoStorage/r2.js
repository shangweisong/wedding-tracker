// Cloudflare R2 provider — S3-compatible API. The browser PUTs directly to a
// short-lived presigned URL (bypassing Vercel's 4.5 MB body cap); this module
// only ever handles metadata operations and signatures, never file bytes.
//
// ⚠ Deployer setup: the bucket needs a CORS rule allowing PUT from the site
// origin with the "content-type" header, and a public read surface (the
// r2.dev dev URL or a custom domain) matching R2_PUBLIC_BASE_URL. See
// SECURITY.md / .env.example.
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2PublicUrl } from "../photowallCore.js";

let cachedClient = null;

function client() {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return cachedClient;
}

// ContentType AND ContentLength are signed into the URL: the client declared
// the exact byte size at grant time and uploads exactly that blob, so the
// browser's automatic Content-Length matches — while any oversized body an
// attacker substitutes fails the signature at the storage layer, before any
// bytes persist. (The confirm-time headObject check remains as the
// authoritative backstop.)
export async function createUploadGrant({ key, contentType, sizeBytes, bucket = process.env.R2_BUCKET }) {
  const url = await getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes,
    }),
    {
      expiresIn: 300,
      // The v3 presigner excludes content-type from the signature by default
      // (aws-sdk-js-v3#3497) — force both headers in so the type/size contract
      // is actually enforced by the storage service, not just declared.
      signableHeaders: new Set(["content-type", "content-length"]),
    }
  );
  return { mode: "put", url, headers: { "Content-Type": contentType } };
}

export async function headObject({ key, bucket = process.env.R2_BUCKET }) {
  try {
    const out = await client().send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    );
    return { exists: true, size: out.ContentLength ?? 0, contentType: out.ContentType || "" };
  } catch (e) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === "NotFound") {
      return { exists: false, size: 0, contentType: "" };
    }
    throw e;
  }
}

export async function publicUrlFor({ key }) {
  return r2PublicUrl(process.env.R2_PUBLIC_BASE_URL, key);
}

export async function deleteObject({ key, bucket = process.env.R2_BUCKET }) {
  try {
    await client().send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key })
    );
  } catch (e) {
    // Best-effort: a missing object must not block metadata deletion.
    if (e?.$metadata?.httpStatusCode !== 404 && e?.name !== "NotFound") throw e;
  }
}

// Keys under a prefix — used to find an archived original whose extension
// isn't recorded anywhere (photowall/originals/<uuid>.*). MaxKeys is tiny:
// a uuid prefix matches at most one object.
export async function listKeys({ prefix, bucket = process.env.R2_BUCKET }) {
  const out = await client().send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: 10 })
  );
  return (out.Contents || []).map((o) => o.Key);
}
