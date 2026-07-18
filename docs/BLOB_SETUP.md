# Setting up Vercel Blob for the Guest Photowall

Click-by-click walkthrough for the photowall's lowest-effort storage backend
(`PHOTO_STORAGE_PROVIDER=vercel-blob`). For the Cloudflare R2 alternative
(10 GB free, zero egress, but more setup), see [`R2_SETUP.md`](R2_SETUP.md);
for the trust model behind the upload flow, see [`SECURITY.md`](../SECURITY.md).

## What you're setting up

Guest photowall files live **outside Supabase** (#138). With Vercel Blob you
create a single **Blob store** attached to your Vercel project; connecting it
auto-configures the credentials — no buckets, no CORS rules, no CSP edits.

Photos are downscaled in the guest's browser first (≤2560px JPEG, so files land
around ~1 MB; the server rejects anything over 4 MB). Uploads are safe by
design: the browser uploads directly to Blob using a single-use client token
minted by `/api/photowall` — scoped to one file path, content type, and size,
valid for 5 minutes — so your read-write token never reaches anyone's browser.

**Trade-offs vs R2:** fastest setup by far, but storage and bandwidth come out
of your Vercel plan's included Blob allotment (see
[Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing)),
and guests viewing the wall counts as egress — R2's is free. Also, the optional
**originals archive** (#142) is R2-only; you can still add it later on top of a
Blob-backed wall (see the last section).

## Step 1 — Create the Blob store

1. Open your project in the [Vercel dashboard](https://vercel.com/dashboard)
2. Go to the **Storage** tab → **Create Database** → pick **Blob**
3. Name it (e.g. `wedding-photowall`) and click **Create**
4. If the dialog asks for an access level, choose **Public** — the app only
   accepts and serves photo URLs on `*.public.blob.vercel-storage.com`, so a
   private store breaks the wall

## Step 2 — Connect it to the project

1. When prompted (or via the store's **Connect Project** button), connect the
   store to your wedding-tracker project — select all environments
   (Production, Preview, Development)
2. Connecting **auto-populates `BLOB_READ_WRITE_TOKEN`** in the project's
   environment variables — nothing to copy by hand

## Step 3 — Set the provider in your `.env`

```text
PHOTO_STORAGE_PROVIDER=vercel-blob
```

That's the only variable you set yourself. (If you also keep
`BLOB_READ_WRITE_TOKEN` in your local `.env` — see Step 4 — the
`setup-vercel-env.sh` script will push it too, which is harmless since the
value already matches.)

## Step 4 — Get the token locally (only for `vercel dev`)

The deployed functions read the token Vercel injected in Step 2. If you run the
`api/` functions locally with `vercel dev`, pull the linked project's env so
your local run has it too:

```bash
vercel env pull .env.development.local
```

(or copy the token from **Storage → your store → Settings → Tokens** into your
`.env`). Skip this step if you only develop the UI with `npm run dev`.

## Step 5 — Push env vars to Vercel & redeploy

```bash
bash scripts/setup-vercel-env.sh --dry-run   # preview
bash scripts/setup-vercel-env.sh             # pushes PHOTO_STORAGE_PROVIDER (+ the rest of your .env)
vercel --prod --yes                          # redeploy so functions pick it up
```

## Step 6 — Verify

1. In the admin dashboard, open **Wedding Setup**, enable **Guest Photowall**,
   and set an upload PIN
2. Visit your public wedding page (`/wedding/<slug>`), scroll to the photowall,
   enter the PIN, and upload a test photo
3. It should appear on the wall within a few seconds

If it doesn't, work through the photowall rows of the
[User Guide troubleshooting table](USER_GUIDE.md#11-troubleshooting) — with
Blob, a `500 photowall_disabled` in the `/api/photowall` function logs means
`PHOTO_STORAGE_PROVIDER`, `BLOB_READ_WRITE_TOKEN`, or
`SUPABASE_SERVICE_ROLE_KEY` (required for every provider) is missing in Vercel.

## Notes

- **No CORS or CSP work needed.** The browser uploads via
  `https://vercel.com/api/blob` and serves photos from
  `*.public.blob.vercel-storage.com` — both hosts are already in
  [`vercel.json`](../vercel.json)'s CSP (`connect-src` / `img-src`). Just don't
  remove them.
- **Deleting photos:** always delete from the admin **Photowall** tab, not the
  Blob dashboard — dashboard deletes leave the database entry behind.
- **Want to archive guests' untouched originals too?** That add-on stores
  full-resolution files (≤40 MB, HEIC ok) in a **private Cloudflare R2 bucket**
  and works alongside a Blob-backed wall — the typical split is downscaled →
  Vercel Blob, originals → R2. Follow
  [`R2_SETUP.md`](R2_SETUP.md#step-7-optional--private-originals-archive)
  Steps 1, 4, 5, and 7 (private bucket + API token + CORS rule), and note the
  three `R2_*` credential vars must be set even though the wall itself uses
  Blob.
