# 💍 Wedding Guest Attendance Tracker

A real-time, multi-device wedding guest tracker — check-in, table management, and red packet (angbao) tracking. Built with React + Vite, powered by Supabase.

> Access is gated by a server-verified helper sign-in and the database is locked down with Row Level Security. See [`SECURITY.md`](SECURITY.md) for the threat model.

## Features

- **Check-in** — tap to mark guests arrived, with timestamp
- **Table view** — all tables at a glance with arrival progress; tap a guest to update inline
- **Angbao tracker** — log red packets and amounts per guest, with a running total. Optional: turn the whole feature off with `VITE_ENABLE_ANGBAO=false` for events that don't collect ang-bao (see [Disabling angbao tracking](#disabling-angbao-tracking))
- **PayNow ang-bao QR** — a public, login-free page where guests type an amount and scan a pre-filled, amount-locked PayNow QR to send a gift (Singapore only)
- **VIP & bride/groom tagging** — starred VIPs; pink/blue colour coding by side
- **CSV import/export** — bulk import a guest list; export an attendance report afterwards
- **JSON backup** — one-tap lossless backup of every guest record (the safety net)
- **Undo** — check-ins, angbao changes, and deletes can be undone from the toast
- **Real-time sync** — devices auto-sync every 5 seconds
- **Search & filter** — by name, table, arrival, or angbao status

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A free [Supabase](https://supabase.com) account, plus a [Vercel](https://vercel.com) account to deploy

## 1. Install

```bash
git clone https://github.com/chuanseng-ng/wedding-tracker.git
cd wedding-tracker
npm install
```

## 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. **Database** — open the **SQL Editor** and run the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), then [`supabase/migrations/0002_draw_and_submissions.sql`](supabase/migrations/0002_draw_and_submissions.sql). The first creates the `guests` table and locks Row Level Security to authenticated helpers only. The second adds the **lucky-draw number** (`draw_number`, minted when an ang-bao is confirmed), the **guest receipt-upload queue** (`submissions` table), and a **private `receipts` storage bucket**. Guests can only *insert* a pending submission / *upload* a file — they can never read, list, or approve anything; helpers review and approve from the **Submissions** tab.
   > ⚠️ Don't use a `for all using (true)` policy — that exposes the whole guest list to anyone with the (public) anon key.
3. **Helper login** — under **Authentication → Users**, add one user (e.g. `helpers@wedding.local`) with a strong password. That password is the **access code** your helpers enter. Then under **Authentication → Providers → Email**, turn off "Allow new users to sign up".
4. **API keys** — under **Project Settings → API**, copy your **Project URL** and **anon public key**.

## 3. Configure environment

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your anon key...
VITE_HELPER_EMAIL=helpers@wedding.local   # must match the helper account; not secret

# Optional — enables the PayNow ang-bao page (Singapore). Not secret.
VITE_PAYNOW_MOBILE=+6591234567            # the couple's PayNow-linked mobile
VITE_PAYNOW_NAME=The Happy Couple         # name shown to guests

# Optional — set to "false" to hide all ang-bao tracking (stat pill, Angbao
# Tracker tab, per-guest toggles, Submissions tab, public gift page). Default on.
# Only hides the UI; existing angbao data is preserved if re-enabled.
VITE_ENABLE_ANGBAO=true
```

`.env` is already gitignored — never commit it. Only the helper account *password* is secret (the email and anon key are not).

## 4. Run locally

```bash
npm run dev
```

Open http://localhost:5173. To test multi-device sync on the same WiFi, use your computer's LAN IP instead of `localhost` (e.g. `http://192.168.1.x:5173`).

## 5. Deploy to Vercel

1. Import the repo at [vercel.com](https://vercel.com) (or run `npx vercel`).
2. Add the env vars from step 3 under **Settings → Environment Variables** (include the optional `VITE_PAYNOW_*` pair to enable the ang-bao QR, or set `VITE_ENABLE_ANGBAO=false` to turn ang-bao tracking off entirely).
3. Deploy. Security headers (CSP, HSTS, etc.) are applied automatically via [`vercel.json`](vercel.json).

Share the live URL and the access code (helper password) with your helpers on the day.

## CSV format

Columns: `name,table,notes,vip,party` — only `name` is required.

| Column | Description | Example |
|---|---|---|
| `name` | Full name (**required**) | `Tan Wei Ming` |
| `table` | Number or text | `1` or `VIP 1` |
| `notes` | Dietary needs, relationship, etc. | `Vegetarian` |
| `vip` | `true` / `false` | `true` |
| `party` | `bride` or `groom` (colour coding) | `groom` |

```
name,table,notes,vip,party
Tan Wei Ming,1,Best man,true,groom
Ahmad Razif,VIP 1,Vegetarian,false,groom
Priya Nair,VIP 2,,true,bride
```

Import via **Import CSV** in the app toolbar.

## PayNow ang-bao QR (Singapore)

Guests can send a cash gift without any hassle: they open the public **#pay** page
(linked as *“Send a gift · Ang-Bao →”* on the sign-in screen — no access code needed),
type an amount, and get a PayNow QR pre-filled with that amount and **locked** so it
can’t be changed. Scanning it with any Singapore banking app fills in the payment
ready to confirm. Share `https://your-site.vercel.app/#pay` directly with guests if you
like.

- Set `VITE_PAYNOW_MOBILE` to the couple's PayNow-linked mobile and `VITE_PAYNOW_NAME`
  to the name guests should see. Without `VITE_PAYNOW_MOBILE`, the page shows a “not set
  up yet” notice.
- The QR is generated entirely in the browser (EMVCo/SGQR standard) — no backend, no
  payment provider, no fees. The mobile number is embedded in the QR and visible to
  anyone who decodes it (inherent to PayNow QR).
- **No automatic confirmation.** Singapore banks don’t expose a payment webhook for
  personal accounts, so the app can’t detect that a gift arrived — marking ang-bao as
  received in the helper tracker stays manual. **Test with a real banking app (e.g. a
  S$0.01 transfer) before the wedding.**

## Disabling angbao tracking

Not every event collects ang-bao. Set `VITE_ENABLE_ANGBAO=false` (in `.env` for
local dev, or under **Settings → Environment Variables** in Vercel) to hide the
entire ang-bao feature, then rebuild/redeploy. When disabled, the app no longer
shows:

- the **🧧 Angbaos** stat pill in the header
- the **Angbao Tracker** tab and the **Submissions** tab
- the **🧧 Gave** search filter
- the per-guest ang-bao toggle and amount field (on guest cards, in the table
  view, and in the quick-edit popup)
- the public **#pay** PayNow gift page and its *“Send a gift · Ang-Bao →”* link

The toggle is **build-time** and read once at startup, so changing it requires a
rebuild/redeploy — it can't be flipped from inside the running app. It is also
**UI-only and non-destructive**: the `angbao_given` / `angbao_amount` columns and
any values already recorded are left untouched in the database, so re-enabling the
feature later brings every amount back exactly as it was. Leave the variable unset
(or `true`) to keep ang-bao tracking on, which is the default.

## Security

The app has no backend of its own, so the database is the trust boundary: RLS limits all access to signed-in helpers, and the access code is verified server-side by Supabase Auth (never shipped in the bundle). **Residual risk:** helpers share one login, so anyone with the access code has full access — fine for a small trusted group. Details in [`SECURITY.md`](SECURITY.md).

## Running on the day

See [`RUNBOOK.md`](RUNBOOK.md) for a printable wedding-day checklist (wake the
database the day before, take a backup, who owns the angbao amounts, what to do
if a screen freezes or the WiFi blips).

## Troubleshooting

- **Import fails / 400 error** — check the browser console; verify your env vars and that CSV columns match the format above.
- **Not syncing across devices** — use the live Vercel URL (not `localhost`) and confirm env vars are set in Vercel. Devices poll every 5 seconds; the **Refresh** button forces an immediate sync.
- **Supabase project paused** — the free tier pauses after ~1 week idle; click **Restore project** in the dashboard (open the app a day before the wedding to be safe).
- **Angbao tab / 🧧 buttons / #pay page are missing** — the ang-bao feature is turned off. Set `VITE_ENABLE_ANGBAO=true` (or remove the variable) and rebuild/redeploy. No data is lost while it's off; amounts reappear when you re-enable it.
- **"Not saved — check connection"** — a write failed (usually flaky WiFi). The optimistic change stays on screen and reconciles on the next successful sync; the JSON **Backup** button is your safety net before/during the event.
