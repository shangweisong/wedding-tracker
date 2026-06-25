# Security

## Architecture & threat model

Wedding Tracker is a static single-page app (no backend of its own) talking to
Supabase. Because all code and the Supabase **anon key** ship to every visitor's
browser, the only real trust boundary is the database — specifically Supabase
**Row Level Security (RLS)**.

This project is configured so that:

- **The database is locked to authenticated helpers only.** RLS grants access to
  the `authenticated` role; the anonymous role has no policy, so the public anon
  key alone cannot read, insert, update, or delete any guest data. See
  [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
- **Access is gated by a real server-side sign-in.** Helpers unlock the app by
  entering a shared access code, which is verified by Supabase Auth on the
  server (`signInWithPassword`). The code is **never** hard-coded in the bundle
  and is never compared in the browser — a change from the earlier client-side
  PIN, which anyone could read from DevTools.
- **Response security headers** (CSP, HSTS, `X-Frame-Options`, etc.) are set in
  [`vercel.json`](vercel.json).
- **Input is validated** both client-side (fast feedback) and at the database
  level via `CHECK` constraints (authoritative).

### Required setup to be secure

1. Run `supabase/migrations/0001_init.sql` in your Supabase project.
2. In **Authentication → Providers → Email**, create one helper user and
   **disable public sign-ups** so strangers can't self-register an account.
3. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_HELPER_EMAIL`
   in your deployment environment. Never commit `.env`.
4. For email automation (Phase 3, optional): run
   `supabase/migrations/0006_email_automation.sql`, then create the two
   Supabase Vault secrets it documents (`rsvp_email_webhook_url`,
   `rsvp_email_webhook_secret`), and set the server-only env vars listed in
   `.env.example` (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
   `RSVP_WEBHOOK_SECRET`, `CRON_SECRET`, etc.) on the Vercel project. **Never**
   give these a `VITE_` prefix.

## Residual risks (by design)

- **Shared credential.** Every helper uses the same login, so anyone who learns
  the access code has full read/write/delete access to the guest list. This
  matches the operational model (a small group of trusted helpers on the day).
  `created_at` / `updated_at` columns provide a basic audit trail. For stronger
  isolation, switch to per-helper accounts.
- **Google Fonts** is loaded from an external origin (allow-listed in the CSP).
  Self-hosting the fonts would remove this dependency.
- **`VITE_ENABLE_ANGBAO=false` is a UI toggle, not a security control.** Disabling
  ang-bao tracking hides the public `#pay` page and the helper-side ang-bao UI in
  the browser bundle, but it does **not** alter RLS or storage policies: the
  anonymous *insert a pending submission* / *upload a receipt* grants from
  [`0002_draw_and_submissions.sql`](supabase/migrations/0002_draw_and_submissions.sql)
  still exist server-side. If you need those endpoints fully closed (not just
  hidden), drop or tighten the corresponding policies in Supabase as well.

- **Email automation introduces a second trust boundary** (`api/` serverless
  functions on Vercel, separate from the browser/RLS boundary above). The
  `SUPABASE_SERVICE_ROLE_KEY` there bypasses RLS entirely, so it must only
  ever live as a server-only Vercel env var. `api/send-rsvp-email.js` is
  reachable by anyone who knows the URL — it's gated by the
  `RSVP_WEBHOOK_SECRET` shared secret (checked against the `x-webhook-secret`
  header), not by Supabase auth, since the caller is a Postgres trigger, not
  a logged-in helper. `api/send-reminders.js` is gated the same way via
  Vercel's `CRON_SECRET` mechanism.

## Reporting a vulnerability

Please open a private security advisory on the repository, or contact the
maintainer directly. Do not file public issues for undisclosed vulnerabilities.
