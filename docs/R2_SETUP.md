# Setting up Cloudflare R2 for the Guest Photowall

Click-by-click walkthrough for the photowall's recommended storage backend
(`PHOTO_STORAGE_PROVIDER=r2`). For the quick summary version, see the
[User Guide](USER_GUIDE.md#2-configure-environment-variables); for the
lower-setup (but metered-egress) alternative, see
[`BLOB_SETUP.md`](BLOB_SETUP.md); for the trust model behind the upload flow,
see [`SECURITY.md`](../SECURITY.md).

> Cloudflare renames dashboard menus occasionally — if a label below doesn't
> match exactly, look for the nearest equivalent under **R2** in the dashboard.

## What you're setting up

Guest photowall files live **outside Supabase** (#138). With R2 you create:

1. A **public bucket** for the wall photos guests upload. Photos are downscaled
   in the guest's browser first (≤2560px JPEG, so files land around ~1 MB; the
   server rejects anything over 4 MB).
2. *(Optional, #142)* A second, fully **private bucket** that archives each
   guest's untouched original file (≤40 MB, iPhone HEIC included).

Why R2: 10 GB free storage and **no egress charge** — guests scrolling the wall
all night adds no bandwidth cost (reads still count as R2 Class B operations,
but the 10M/month free allowance is far beyond a wedding). Uploads are safe by design: the browser uploads
directly to R2 using short-lived presigned URLs minted by `/api/photowall`, so
your storage credentials never reach anyone's browser.

By the end you'll have values for every variable in this block:

```text
PHOTO_STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=

# optional originals archive (Step 7)
PHOTO_ORIGINALS_PROVIDER=r2
R2_ORIGINALS_BUCKET=
```

---

## Step 1 — Create a Cloudflare account & find your Account ID

1. Sign up (free plan is fine) at [dash.cloudflare.com](https://dash.cloudflare.com)
   and open **R2 Object Storage** in the left sidebar.
2. The first visit asks you to add a payment card — required by Cloudflare even
   though the free tier (10 GB storage, 1M Class A write operations/month)
   covers a wedding comfortably.
3. Copy your **Account ID** — it's shown on the R2 overview page (right-hand
   side) and also appears in the dashboard URL
   (`dash.cloudflare.com/<account-id>/r2`).

→ this is `R2_ACCOUNT_ID`

## Step 2 — Create the public bucket

1. **R2 → Create bucket**
2. Name it (e.g. `wedding-photowall`) — lowercase letters, numbers, and hyphens
3. Leave location on **Automatic** and click **Create bucket**

→ the bucket name is `R2_BUCKET`

## Step 3 — Give the bucket a public read surface

The wedding page loads wall photos straight from the bucket, so it needs a
public URL. Pick one:

### Option 1 — r2.dev development URL (simplest)

1. Open the bucket → **Settings** → **Public access** → **R2.dev subdomain**
2. Click **Allow Access** and type `allow` to confirm
3. Copy the URL it gives you, e.g. `https://pub-a1b2c3d4.r2.dev`

> ⚠️ Cloudflare **rate-limits r2.dev subdomains** and positions them as a
> development convenience, not a production surface. Fine while setting up and
> testing, but for the wedding day itself — hundreds of guests loading the wall
> at once — the custom domain below is the safer choice.

### Option 2 — Custom domain (e.g. `photos.yourdomain.com`)

1. Bucket → **Settings** → **Custom Domains** → **Connect Domain**
2. Enter a subdomain of a domain already on your Cloudflare account; Cloudflare
   adds the DNS record for you
3. ⚠️ **Extra step for custom domains only:** add the domain to the `img-src`
   CSP directive in [`vercel.json`](../vercel.json) — otherwise the wedding
   page's Content-Security-Policy blocks the images from rendering.

→ the URL (no trailing slash) is `R2_PUBLIC_BASE_URL`

## Step 4 — Create an R2 API token

1. From the R2 overview page, open **API → Manage API tokens** (labelled
   **Manage R2 API Tokens** in older layouts)
2. Stay on the **Account API Tokens** tab and click **Create Account API token**
   — *not* a User API token. Both produce the same S3-style key pair, but a
   User token is tied to your personal Cloudflare login and stops working if
   that user's access ever changes; an Account token belongs to the account
   itself, which is what you want for a deployment credential.
3. Permissions: **Object Read & Write**
4. Scope: apply it to your photowall bucket — or to **all buckets** if you plan
   to add the originals archive (Step 7), since one token must cover both
5. Click **Create API Token** and copy the **Access Key ID** and
   **Secret Access Key** — the secret is shown only once

→ these are `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`

## Step 5 — Add the CORS rule (don't skip)

Browsers block the direct-to-bucket upload unless the bucket explicitly allows
`PUT` from your site. **A missing CORS rule is the #1 cause of "upload fails
right after picking a photo".**

1. Bucket → **Settings** → **CORS policy** → **Add CORS policy**
2. Paste (replace the origin with your deployed site):

```json
[
  {
    "AllowedOrigins": ["https://your-app.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"]
  }
]
```

- Testing locally too? Add `"http://localhost:5173"` to `AllowedOrigins`.
- Using a custom app domain (or Vercel preview URLs) as well? Each origin
  guests upload from must be in the list.

## Step 6 — Fill in your `.env`

```text
PHOTO_STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=a1b2c3d4e5f6...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=wedding-photowall
R2_PUBLIC_BASE_URL=https://pub-a1b2c3d4.r2.dev
```

These are **server-only** secrets — never prefix them with `VITE_` (that would
ship them to every browser). See [`.env.example`](../.env.example) for the full
annotated reference.

## Step 7 (optional) — Private originals archive

Wall photos are downscaled in the guest's browser and the source file is
normally discarded. To also keep every guest's **untouched original** (full
resolution, ≤40 MB, HEIC ok):

1. Create a **second bucket** (e.g. `wedding-originals`) — Step 2 again
2. **Keep it fully private**: do *not* enable the r2.dev subdomain, do *not*
   connect a custom domain. Originals retain full EXIF/GPS metadata from
   guests' phones and must never be publicly served.
3. Add the **same CORS rule** from Step 5 to this bucket (it needs its own copy)
4. Confirm your API token from Step 4 covers this bucket too
5. Add to `.env`:

   ```text
   PHOTO_ORIGINALS_PROVIDER=r2
   R2_ORIGINALS_BUCKET=wedding-originals
   ```

Notes:

- Works even if the wall itself uses Vercel Blob — the archive needs
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and
  `R2_ORIGINALS_BUCKET`; the wall-only vars (`R2_BUCKET`,
  `R2_PUBLIC_BASE_URL`) stay unset in that split.
- Uploads are **best-effort**: a failed original never blocks the guest's photo.
- Deleting a photo from the admin **Photowall** tab also deletes its archived
  original (best-effort; requires the archive env vars to still be set). A
  failed or skipped original-delete leaves a harmless orphan in the private
  bucket — sweep it manually after the wedding if you want a clean archive.
- After the wedding, download the archive via the Cloudflare dashboard or
  [rclone](https://rclone.org/s3/#cloudflare-r2).
- Cost: realistic phone photos are 3–8 MB; even the worst case (1500 photos ×
  40 MB = 60 GB) is ≈ $0.75/month beyond the free 10 GB.

## Step 8 — Push env vars to Vercel & redeploy

The setup script reads your `.env` and pushes all `PHOTO_*`/`R2_*` vars (along
with everything else) to the linked Vercel project:

```bash
bash scripts/setup-vercel-env.sh --dry-run   # preview
bash scripts/setup-vercel-env.sh             # push
vercel --prod --yes                          # redeploy so functions pick them up
```

## Step 9 — Verify

1. In the admin dashboard, open **Wedding Setup**, enable **Guest Photowall**,
   and set an upload PIN
2. Visit your public wedding page (`/wedding/<slug>`), scroll to the photowall,
   enter the PIN, and upload a test photo
3. It should appear on the wall within a few seconds

If it doesn't, work through the photowall rows of the
[User Guide troubleshooting table](USER_GUIDE.md#11-troubleshooting) — the two
usual suspects are the CORS rule (Step 5) and a wrong `R2_PUBLIC_BASE_URL`
(Step 3).
