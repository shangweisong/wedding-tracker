# 💍 Wedding Guest Attendance Tracker

A real-time, multi-device wedding guest tracker — check-in, table management, and red packet (angbao) tracking. Built with React + Vite, powered by Supabase.

> Access is gated by a server-verified helper sign-in and the database is locked down with Row Level Security. See [`SECURITY.md`](SECURITY.md) for the threat model.

## Features

- **Check-in** — tap to mark guests arrived, with timestamp
- **Table view** — all tables at a glance with arrival progress; tap a guest to update inline
- **Angbao tracker** — log red packets and amounts per guest, with a running total
- **VIP & bride/groom tagging** — starred VIPs; pink/blue colour coding by side
- **CSV import/export** — bulk import a guest list; export an attendance report afterwards
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
2. **Database** — open the **SQL Editor** and run the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). This creates the `guests` table and locks Row Level Security to authenticated helpers only.
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
```

`.env` is already gitignored — never commit it. Only the helper account *password* is secret (the email and anon key are not).

## 4. Run locally

```bash
npm run dev
```

Open http://localhost:5173. To test multi-device sync on the same WiFi, use your computer's LAN IP instead of `localhost` (e.g. `http://192.168.1.x:5173`).

## 5. Deploy to Vercel

1. Import the repo at [vercel.com](https://vercel.com) (or run `npx vercel`).
2. Add the three env vars from step 3 under **Settings → Environment Variables**.
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

## Security

The app has no backend of its own, so the database is the trust boundary: RLS limits all access to signed-in helpers, and the access code is verified server-side by Supabase Auth (never shipped in the bundle). **Residual risk:** helpers share one login, so anyone with the access code has full access — fine for a small trusted group. Details in [`SECURITY.md`](SECURITY.md).

## Troubleshooting

- **Import fails / 400 error** — check the browser console; verify your env vars and that CSV columns match the format above.
- **Not syncing across devices** — use the live Vercel URL (not `localhost`) and confirm env vars are set in Vercel.
- **Supabase project paused** — the free tier pauses after ~1 week idle; click **Restore project** in the dashboard (open the app a day before the wedding to be safe).
