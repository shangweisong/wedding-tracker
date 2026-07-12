# Wedding Tracker — User Guide

Full step-by-step setup and reference for the Wedding Tracker app.
For a feature overview, see the [README](../README.md).

---

## Table of contents

1. [Set up Supabase](#1-set-up-supabase)
2. [Configure environment variables](#2-configure-environment-variables)
3. [Run locally](#3-run-locally)
4. [Deploy to Vercel](#4-deploy-to-vercel)
5. [Email automation](#5-email-automation)
6. [Adding guests](#6-adding-guests)
7. [Workflow](#7-workflow)
8. [PayNow ang-bao QR](#8-paynow-ang-bao-qr)
9. [Disabling angbao tracking](#9-disabling-angbao-tracking)
10. [Security](#10-security)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Set up Supabase

### 1a. Database migrations

Open the **SQL Editor** in your Supabase dashboard and run the migrations **in order**:

| File | What it creates |
|---|---|
| [`0001_core.sql`](../supabase/migrations/0001_core.sql) | `guests` + `submissions` tables, `set_updated_at` trigger, lucky-draw number (`assign_draw_number`), private `receipts` storage bucket, role plumbing (`app_config` + `is_helper()`) |
| [`0002_rsvp_seating.sql`](../supabase/migrations/0002_rsvp_seating.sql) | `tables` table; all RSVP columns on guests (`rsvp_status`, `meal_choice`, `email`, etc.); relationship taxonomy columns; RSVP RPCs (`submit_rsvp`, fuzzy `submit_rsvp_by_name`, `find_guest_by_name`); reminder-cron indexes |
| [`0003_weddings_page.sql`](../supabase/migrations/0003_weddings_page.sql) | Singleton `weddings` table with **all** columns (page content, AI theme tokens, section photos, hero focal point, budget/runsheet/checklist storage); `wedding-photos` bucket with couple-only write policies; `upsert_wedding_page` / `get_public_wedding` RPCs |
| [`0004_smart_rsvp.sql`](../supabase/migrations/0004_smart_rsvp.sql) | Smart RSVP: `wedding_events` + `guest_event_rsvps` tables, legacy-mirror trigger, `get_public_events` / `get_guest_by_rsvp_token` / `submit_rsvp_events`; final `get_wedding_config` / `upsert_wedding_config` |
| [`0005_roles_security.sql`](../supabase/migrations/0005_roles_security.sql) | Couple/helper RLS split for `guests` / `tables` / `wedding_events` / `guest_event_rsvps` / `submissions` / `receipts`; `set_guest_checkin` + helper-safe `get_checkin_guests` projection |
| [`0006_planning_features.sql`](../supabase/migrations/0006_planning_features.sql) | `vendors` table + RLS; budget / runsheet / checklist config RPCs (couple-gated); `checklist_reminder_log` table |
| [`0007_email_automation.sql`](../supabase/migrations/0007_email_automation.sql) | `pg_net` extension; RSVP status-change webhook trigger (with `old_rsvp_status` for host change-of-mind notifications); `second_reminder_sent_at` column — **apply only after completing the email setup in step 5** |

All migrations are idempotent (`CREATE OR REPLACE`, `IF NOT EXISTS`) — safe to re-run,
including against a database that already ran the pre-consolidation files.

> **Supabase CLI users (existing deployments):** the migration folder was consolidated
> from 19 files down to these 7 (each object now appears once, in its final form).
> If you applied the old files via `supabase db push`, the CLI's tracking table still
> lists the old versions — and because the new files reuse versions `0001`–`0007`,
> `db push` would wrongly treat them as already applied. Reset the tracking rows once,
> then push (the files are no-ops against an already-migrated schema):
>
> | Removed files | Consolidated into |
> |---|---|
> | `0001_init`, `0002_draw_and_submissions`, `0010_role_enforcement` (config/`is_helper`) | `0001_core.sql` |
> | `0003_rsvp_seating`, `0012_perf_indexes` | `0002_rsvp_seating.sql` |
> | `0004_weddings`, `0006_ai_theme`, `0007_section_photos`, `0008_hero_focal_point`, `0019_wedding_photos_policies` | `0003_weddings_page.sql` |
> | `0009_smart_rsvp`, `0015_guard_config_rpcs`, `0017_guard_runsheet` (RPC bodies) | `0004_smart_rsvp.sql` |
> | `0010_role_enforcement` (policies), `0016_helper_guest_projection` | `0005_roles_security.sql` |
> | `0011_vendors_budget`, `0013_runsheet`, `0014_planning_checklist`, `0018_checklist_reminders` | `0006_planning_features.sql` |
> | `0005_email_automation` | `0007_email_automation.sql` |
>
> ```sql
> -- One-time cleanup: drop every pre-consolidation tracking row (0001–0019).
> -- Verify what you have first:  select * from supabase_migrations.schema_migrations;
> delete from supabase_migrations.schema_migrations
>   where version in (
>     '0001','0002','0003','0004','0005','0006','0007','0008','0009','0010',
>     '0011','0012','0013','0014','0015','0016','0017','0018','0019'
>   );
> ```
>
> Then run `supabase db push` — it re-applies the 7 new files, which change nothing
> on an up-to-date schema (one exception: they close a small grant gap on the
> checklist RPCs; see the changelog).

> Never use `for all using (true)` — that exposes the entire guest list to anyone with the public anon key.

### 1b. Auth accounts

The app uses two separate Supabase Auth users — one for the couple (full access) and one for the bridal team (D-Day only). Create both under **Authentication → Users**:

| Account | Example email | Access |
|---|---|---|
| Couple | `couple@wedding.local` | Full dashboard — RSVP, seating, setup, Wishes Wrapped, D-Day |
| Bridal Team | `helper@wedding.local` | D-Day only — guest check-in, angbao recording, lucky draw, read-only seating |

Give each a strong, unique password. The couple shares the **bridal team password** (not the email) with helpers — that's all they need to sign in.

Under **Authentication → Providers → Email**, turn off "Allow new users to sign up".

### 1c. API keys

Under **Project Settings → API**, copy your **Project URL** and **anon public key**.

---

## 2. Configure environment variables

```bash
cp .env.example .env
```

### Frontend variables (`VITE_` prefix — exposed to browser)

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your anon key...

# Emails for the two Supabase Auth accounts (not secret — they ship in the bundle).
# The PASSWORDS are entered at the lock screen at runtime and verified server-side.
VITE_COUPLE_EMAIL=couple@wedding.local    # couple's account → full dashboard access
VITE_HELPER_EMAIL=helper@wedding.local   # bridal team account → D-Day controls only

# Optional — enables the PayNow ang-bao page (Singapore). Not secret.
VITE_PAYNOW_MOBILE=+6591234567            # the couple's PayNow-linked mobile
VITE_PAYNOW_NAME=The Happy Couple         # name shown to guests

# Optional — set to "false" to hide all ang-bao tracking. Default on.
VITE_ENABLE_ANGBAO=true
```

> **Never set `VITE_COUPLE_PASSWORD` or `VITE_HELPER_PASSWORD`.** Any variable with a `VITE_` prefix is embedded in the JavaScript bundle and visible to anyone who inspects the page source. Setting an access code this way exposes it publicly, defeating the purpose of the lock screen entirely. Access codes are entered at the lock screen at runtime and verified server-side by Supabase — they never belong in any env file.

### Server-only variables (no `VITE_` — never expose to client)

These are only used by Vercel serverless functions. **Never add `VITE_` to these.**

```
SUPABASE_SERVICE_ROLE_KEY=eyJ...your service role key...
RESEND_API_KEY=re_xxxxxxxxxxxx            # if using Resend
GMAIL_FROM=yourname@gmail.com             # if using Gmail
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   # if using Gmail
EMAIL_PROVIDER=gmail                      # "gmail" (default) or "resend"
RESEND_SENDING_DOMAIN=mail.yourdomain.com # if using Resend
RSVP_WEBHOOK_SECRET=a-random-secret      # shared between Supabase Vault and Vercel
SITE_URL=https://your-app.vercel.app     # base URL for token links in emails
HOST_EMAIL=your@email.com               # receives change-of-mind RSVP notifications + checklist reminder digests

# Optional — auto-translate (Wedding Page → Translations). Server-only.
DEEPL_API_KEY=                           # preferred; falls back to MyMemory if unset
DEEPL_API_URL=                           # leave blank for Free; set the Pro host for a paid key
MYMEMORY_EMAIL=you@email.com             # optional, raises the free MyMemory quota

# Optional — AI theme generation (Wedding Page → "Generate theme from an image").
THEME_AI_PROVIDER=anthropic              # "anthropic" (default) | "openai" | "nvidia"
ANTHROPIC_API_KEY=                       # set ONLY the key for your chosen provider
OPENAI_API_KEY=
NVIDIA_API_KEY=
THEME_AI_MODEL=                          # optional, override the default vision model
NVIDIA_MODEL=                            # optional, nvidia only — pin the NIM model to route to
COUPLE_EMAIL=                            # optional, server-side override of VITE_COUPLE_EMAIL for /api/generate-theme
HELPER_EMAIL=                            # optional, server-side override of VITE_HELPER_EMAIL for /api/generate-theme
```

> See [`.env.example`](../.env.example) for the full annotated list, including when to set `DEEPL_API_URL` (Pro vs Free) and `NVIDIA_MODEL`.

`.env` is gitignored — never commit it.

---

## 3. Run locally

Install dependencies first (once, or whenever `package.json` changes), then start the dev server:

```bash
npm install
npm run dev
```

Open `http://localhost:5173` for the admin. Open `http://localhost:5173/rsvp` to see the guest RSVP form.

To produce an optimized production build (what Vercel runs on deploy), use `npm run build` — the output goes to `dist/`. Preview it locally with `npm run preview`.

To test multi-device sync on the same WiFi, use your computer's LAN IP instead of `localhost`.

To test Vercel serverless functions locally:

```bash
vercel dev
```

This requires the Vercel CLI and a local `.env` with the server-only variables filled in.

---

## 4. Deploy to Vercel

1. Import the repo at [vercel.com](https://vercel.com) (or run `vercel`) for automatic GitHub deploys.
2. Add the `VITE_*` env vars from step 2 under **Settings → Environment Variables**.
3. Add the server-only env vars — use the setup script (see [Push env vars to Vercel](#push-env-vars-to-vercel) in step 5).
4. Deploy. Security headers (CSP, HSTS, X-Frame-Options, etc.) are applied automatically via [`vercel.json`](../vercel.json).

---

## 5. Email automation

When a guest submits the RSVP form, they receive a confirmation email with a `.ics` calendar invite attached. Guests who haven't responded receive reminder emails 90 days and 30 days before the wedding. When a guest changes their RSVP status (confirmed ↔ declined), you receive a notification at `HOST_EMAIL`.

You can also attach email reminders to your planning-checklist tasks (Checklist tab → bell icon on any task with a due date — e.g. 1 week before due, on the due date). The daily cron emails a digest of every reminder firing that day to `HOST_EMAIL`; each reminder is sent once, and finished tasks are skipped.

A task's due date can be either a preset relative to the wedding date (e.g. "6 months before" — these shift automatically if the wedding date changes) or, via "Exact date…", a specific pinned calendar day for hard external deadlines like a vendor's booking cutoff. Pinned dates (marked 📌) deliberately stay put when the wedding date changes. Reminders work with both kinds — exact-date tasks can even fire reminders before you've set the wedding date.

Once the checklist grows, the category chips above the list (e.g. **Attire**, **Venue & Vendors**, plus **All** and **Uncategorized**) filter the visible tasks; the progress bar always reflects the whole checklist.

**Export CSV** (next to *Add task*) downloads the full checklist as a spreadsheet-ready CSV — task, category, assignee, resolved due date, how the deadline is configured, reminders, and done state — handy for sharing progress outside the app or printing a physical copy.

This is powered by a Supabase webhook trigger → Vercel serverless function.

### Choose a provider

Set `EMAIL_PROVIDER` in your environment variables:

| Provider | `EMAIL_PROVIDER` | Requires | Best for |
|---|---|---|---|
| **Gmail** (default) | `gmail` | A Gmail App Password | Anyone — no domain needed |
| **Resend** | `resend` | A verified sending domain | Custom `rsvp@yourdomain.com` address |

---

### Option A — Gmail (recommended, no domain needed)

Gmail sends from your existing Google account. No domain purchase, no service approval, no IP restrictions. Limit is 500 emails/day — well above any wedding guest list.

**Step 1 — Enable 2-Step Verification on your Google account**

Go to [myaccount.google.com/security](https://myaccount.google.com/security) and turn on 2-Step Verification if it isn't already on. (App Passwords require this.)

**Step 2 — Create an App Password**

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Under "App name", type `wedding tracker`
3. Click **Create** — Google generates a 16-character password
4. Copy it (you won't see it again)

**Step 3 — Add env vars to your `.env`**

```
EMAIL_PROVIDER=gmail
GMAIL_FROM=yourname@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

---

### Option B — Resend (custom sending domain)

Resend sends from `rsvp@yourdomain.com`. Better deliverability and a more professional appearance. Requires a domain you control so you can add DNS records.

**Step 1 — Buy a domain**

Any registrar works — [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) (~$8–12/yr) is recommended (no markup on wholesale prices).

**Step 2 — Verify the domain in Resend**

1. Sign up at [resend.com](https://resend.com) and go to **Domains → Add Domain**
2. Enter your domain (e.g. `mail.yourdomain.com`)
3. Resend gives you two DNS records to add — an SPF `TXT` record and a DKIM `TXT` record
4. Add them in your domain registrar's DNS settings
5. Click **Verify** in Resend — usually takes a few minutes

**Step 3 — Create an API key**

Go to **Resend → API Keys → Create API key**. Copy it.

**Step 4 — Add env vars to your `.env`**

```
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_SENDING_DOMAIN=mail.yourdomain.com
```

---

### Push env vars to Vercel

Instead of adding variables one-by-one in the Vercel dashboard, use the included setup script. It reads your `.env`, detects which provider you've chosen, and pushes the right set of variables to Vercel (production + preview + development) in one command.

> **The Vercel project must exist first.** The script pushes vars to a linked project, so the repo has to be linked/deployed before it works. If you haven't imported the repo via the dashboard, run a first deploy from the CLI to create and link the project:
>
> ```bash
> vercel --prod --yes
> ```
>
> The `--yes` flag accepts the default project settings non-interactively. After this, the env-push script can find the project.

**Preview what will be pushed (no changes made):**
```bash
bash scripts/setup-vercel-env.sh --dry-run
```

**Push to Vercel:**
```bash
bash scripts/setup-vercel-env.sh
```

Then redeploy:
```bash
vercel --prod --yes
```

---

### Wire up the Supabase webhook

This is a one-time step that tells Supabase where to call when a guest RSVPs.

**Step 1 — Apply the email automation migration** (if you haven't already):

Run [`0007_email_automation.sql`](../supabase/migrations/0007_email_automation.sql) in the SQL Editor.

**Step 2 — Register the webhook URL and secret in Supabase Vault:**

The included helper script reads your `.env` and either runs the SQL automatically (if the Supabase CLI is installed) or prints a pre-filled snippet you can paste into the SQL Editor:

```bash
bash scripts/setup-vault-secrets.sh
```

If you prefer to run it manually, open the **Supabase SQL Editor** and paste:

```sql
select vault.create_secret(
  'https://<your-app>.vercel.app/api/send-rsvp-email',
  'rsvp_email_webhook_url'
);

select vault.create_secret(
  '<same value as RSVP_WEBHOOK_SECRET in your .env>',
  'rsvp_email_webhook_secret'
);
```

Replace `<your-app>` with your Vercel project URL (e.g. `wedding-tracker-eight.vercel.app`).

The trigger silently no-ops until both secrets exist — guests can RSVP normally, emails just won't send yet.

---

## 6. Adding guests

### Via the app

Admin → D-Day mode → toolbar → **Add Guest** or **Import CSV**.

### CSV format

Columns: `name, table, notes, vip, party` — only `name` is required.

> Not sure of the format? The **Import Guest List** dialog has a **Download template** button that saves a ready-to-fill `guest-import-template.csv` with these columns and two example rows. Fill it in, then upload it back.

| Column | Description | Example |
|---|---|---|
| `name` | Full name (**required**) | `Tan Wei Ming` |
| `table` | Number or label | `1` or `VIP 1` |
| `notes` | Dietary needs, relationship, etc. | `Vegetarian` |
| `vip` | `true` / `false` | `true` |
| `party` | `bride` or `groom` | `groom` |

```
name,table,notes,vip,party
Tan Wei Ming,1,Best man,true,groom
Ahmad Razif,2,Vegetarian,false,groom
Priya Nair,2,,false,bride
```

> **Partners and plus-ones:** add them as separate rows so they RSVP independently. Only add them if they are actually invited — not everyone needs a plus one.

---

## 7. Workflow

### Before the wedding

1. Fill in your wedding details in the **Wedding Setup tab** (couple names, date, venue, ceremony/dinner time) — do this first, since the RSVP confirmation email and calendar invite read from it
   - Optional: under **Wedding Page**, flip **Fun RSVP options** on to add two playful choices to the guest RSVP form — *"It's complicated 😅"* (how they know you) and *"😏 It's a secret"* (friend type). Off by default.
   - Optional: under **Wedding Page → Note to Guests**, add **Parking** and/or **Smoking** notices — these show on the RSVP form (to attending guests) only if filled. Attending guests are also asked *"Would you like to give a speech?"*; the RSVP tab flags volunteers with a 🎤.
   - Attending guests can bring up to **6 additional guests** — each becomes its own guest entry (seatable and checkable-in independently). In the **RSVP tab** these appear as rows labelled *"↳ additional guest of …"*; the confirmed **headcount** stat counts every body, while the confirmed/pending counts track invitations.
   - The public **Wedding page** and **RSVP form** offer a language selector (top-right) covering **English, 繁體中文 (Traditional Chinese), 简体中文 (Simplified Chinese), Bahasa Melayu, 日本語, and 한국어**. With more than three languages the toggle becomes a dropdown; the app's own labels are translated automatically, the guest's choice is remembered per browser, and the initial language is sniffed from the browser. The admin dashboard and emails stay in English.
   - To translate **your own text**, open **Wedding Setup → Wedding Page → Translations** and pick the target language: fill each field (or click **Auto-translate from English** to draft them, then edit). Blank fields fall back to English per-field on the public page. Auto-translate prefers **DeepL** for more natural output (set the server-only `DEEPL_API_KEY`; use `DEEPL_API_URL` for a Pro key) and falls back to **MyMemory** for languages DeepL doesn't cover (e.g. Malay) or when no DeepL key is set; the optional `MYMEMORY_EMAIL` raises MyMemory's daily limit.
   - Optional: under **Wedding Page**, add **section photo galleries** — photo bands inserted between the public page's sections (after the hero, Our Story, Fun Q&A, event details, or directions). Enable a slot, choose its column count (1–4), and paste the photo URLs (up to 12 per slot); they render as a masonry layout so tall and wide photos aren't cropped. (Schema support ships in `0003_weddings_page.sql`.)
2. Import your guest list via CSV (or add guests one by one)
3. Share `https://your-app.vercel.app/rsvp` in your wedding group chat
4. Guests fill in the RSVP form — responses appear in the **RSVP tab** in real time
5. Once RSVPs are in, open the **Seating Plan tab** to assign confirmed guests to tables
6. Export the seating plan as CSV or print it

### On the wedding day

1. Switch to **💒 D-Day** mode in the header
2. Give helpers the URL — they check guests in as they arrive
   - The **search bar** filters guests by name or table number, and understands lucky-draw numbers: type `#123` to jump straight to a draw number, or a bare `#` to list everyone who has a draw number assigned.
3. Track angbaos in the **Angbao Tracker tab**
4. Export an attendance report afterwards

---

## 8. PayNow ang-bao QR

Guests can send a cash gift without any hassle: they open the public **#pay** page (linked as *"Send a gift · Ang-Bao →"* on the sign-in screen — no access code needed), type an amount, and get a PayNow QR pre-filled with that amount and **locked** so it can't be changed. Scanning it with any Singapore banking app fills in the payment ready to confirm.

- Set `VITE_PAYNOW_MOBILE` to the couple's PayNow-linked mobile and `VITE_PAYNOW_NAME` to the name guests should see. Without `VITE_PAYNOW_MOBILE`, the page shows a "not set up yet" notice.
- The QR is generated entirely in the browser (EMVCo/SGQR standard) — no backend, no payment provider, no fees. The mobile number is embedded in the QR and visible to anyone who decodes it (inherent to PayNow QR).
- **No automatic confirmation.** Singapore banks don't expose a payment webhook for personal accounts, so the app can't detect that a gift arrived — marking ang-bao as received in the helper tracker stays manual.

> **Test with a real banking app (e.g. a S$0.01 transfer) before the wedding.**

You can also share `https://your-site.vercel.app/#pay` directly with guests.

---

## 9. Disabling angbao tracking

Not every event collects ang-bao. Set `VITE_ENABLE_ANGBAO=false` (in `.env` for local dev, or under **Settings → Environment Variables** in Vercel) to hide the entire ang-bao feature, then rebuild/redeploy.

When disabled, the app no longer shows:

- the **🧧 Angbaos** stat pill in the header
- the **Angbao Tracker** tab and the **Submissions** tab
- the **🧧 Gave** search filter
- the per-guest ang-bao toggle and amount field (on guest cards, in the table view, and in the quick-edit popup)
- the public **#pay** PayNow gift page and its *"Send a gift · Ang-Bao →"* link

The toggle is **build-time** and read once at startup — changing it requires a rebuild/redeploy, not a live flip. It is also **UI-only and non-destructive**: the `angbao_given` / `angbao_amount` columns and any values already recorded are left untouched in the database, so re-enabling the feature later brings every amount back exactly as it was.

---

## 10. Security

No backend of its own — the database is the trust boundary.

- **Role-based access** — two Supabase Auth accounts gate the dashboard. The couple account (`VITE_COUPLE_EMAIL`) gets full access. The bridal team account (`VITE_HELPER_EMAIL`) is locked to D-Day controls only: guest check-in, angbao recording, lucky draw, and a read-only seating chart. Planning tabs, guest add/delete/edit, exports, and financial totals are hidden. **The write side of this split is now enforced in the database, not just the browser.** RLS policies key off the signed-in email (via `is_helper()`): the helper account cannot insert, update, or delete guests, seating, events, or RSVPs, and has **no access to the financial `submissions` table at all** — check-in is the one write it can do, routed through the `set_guest_checkin` RPC. So a helper who bypasses the hidden buttons (DevTools/SDK) is refused by Postgres, not merely by the UI. **To activate this, the DB must know which email is the helper:** the `0001_core` migration seeds `public.app_config` with the default emails; a deployment using its own addresses overrides them with a service-role `update public.app_config …` (see `SECURITY.md`). Until configured, enforcement is fail-open (everyone keeps full access — the couple is never locked out). Direct guest *reads* are couple-only too (#99): the helper's D-Day views go through the `get_checkin_guests()` projection, which omits couple-only columns (private notes, ang-bao amounts, contact details, RSVP tokens).
- **Never set access codes as env vars** — any variable with a `VITE_` prefix is embedded in the JavaScript bundle and visible to anyone who opens DevTools. Access codes are entered at the lock screen at runtime and verified server-side by Supabase. If you ever find `VITE_COUPLE_PASSWORD` or `VITE_HELPER_PASSWORD` in your env files, delete them and rotate both Supabase passwords immediately.
- **Public RSVP** — the `/rsvp` page has zero direct table access. It calls `security definer` RPC functions that expose only the minimum needed: name search and writing RSVP fields. The guest list is never returned to the browser.
- **Residual risk** — each account is a shared credential (one password per role), so anyone who knows the bridal team password can use D-Day features. The couple password should be kept private; only the bridal team password is shared with helpers.

See [`SECURITY.md`](../SECURITY.md) for the full threat model.

---

## 11. Troubleshooting

| Problem | Fix |
|---|---|
| RSVP form says "name not found" | Run the `0003` and `0004` migrations in the Supabase SQL Editor |
| Not syncing across devices | Use the live Vercel URL, not `localhost`. Check env vars are set in Vercel. Devices poll every 5 seconds; the **Refresh** button forces an immediate sync. |
| Supabase project paused | Free tier pauses after ~1 week idle — restore in the dashboard. Open the app the day before the wedding. |
| "Not saved — check connection" | A write failed (usually flaky WiFi). The optimistic change stays on screen and reconciles on next sync. Use JSON **Backup** as a safety net. |
| Import fails / 400 error | Check browser console. Verify env vars and that CSV columns match the format above. |
| Angbao tab / 🧧 buttons / #pay page are missing | The ang-bao feature is turned off. Set `VITE_ENABLE_ANGBAO=true` (or remove the variable) and rebuild/redeploy. No data is lost while it's off. |
| Confirmation email not arriving | Check Vercel function logs: `vercel logs --environment production --since 1h --source serverless --no-branch --expand`. A `500 Missing env vars` means the Vercel env vars weren't pushed — run `bash scripts/setup-vercel-env.sh`. No log at all means the Supabase Vault secrets aren't configured — run the `vault.create_secret(...)` SQL above. |
| Gmail — "Invalid login" error | Your regular Gmail password won't work. You must use a **Gmail App Password** (16-char code from [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)). Also requires 2-Step Verification to be on. |
| Resend — emails only arrive to your own inbox | You're in Resend sandbox mode (no verified domain yet). Complete Option B above to send to real guests. |
| RSVP triggers email but guest doesn't receive it | Check spam/junk folder. Gmail-to-Gmail or Gmail-to-Outlook may land there occasionally. Ask the guest to mark it not-spam. |
