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
  [`supabase/migrations/0001_core.sql`](supabase/migrations/0001_core.sql) and
  [`supabase/migrations/0005_roles_security.sql`](supabase/migrations/0005_roles_security.sql).
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

1. Run the migrations in `supabase/migrations/` (0001–0010; 0007 is the
   optional email automation) in your Supabase project.
2. In **Authentication → Providers → Email**, create one helper user and
   **disable public sign-ups** so strangers can't self-register an account.
3. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_HELPER_EMAIL`
   in your deployment environment. Never commit `.env`.
   **Never set `VITE_HELPER_PASSWORD`.** Any `VITE_` variable is embedded in
   the JavaScript bundle and readable by anyone who inspects the page — setting
   the access code this way exposes it publicly. The access code is entered at
   the lock screen at runtime and verified server-side; it must never appear in
   any env file.
4. For email automation (Phase 3, optional): run
   `supabase/migrations/0007_email_automation.sql`, then create the two
   Supabase Vault secrets it documents (`rsvp_email_webhook_url`,
   `rsvp_email_webhook_secret`), and set the server-only env vars listed in
   `.env.example` (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
   `RSVP_WEBHOOK_SECRET`, `CRON_SECRET`, etc.) on the Vercel project. **Never**
   give these a `VITE_` prefix.
5. For auto-translation (optional): set `DEEPL_API_KEY` (and/or
   `MYMEMORY_EMAIL`) as **server-only** Vercel env vars — the browser calls the
   same-origin `/api/translate` proxy, never the translation host directly.
   The proxy requires the signed-in couple/helper's Supabase token (same gate
   as `/api/generate-theme`), so anonymous callers can't spend the translation
   quota or use it as an open relay.
6. For AI theme generation (optional; schema support ships in
   `supabase/migrations/0003_weddings_page.sql`): pick a provider with
   `THEME_AI_PROVIDER` and set only its **server-only** key (`ANTHROPIC_API_KEY`
   / `OPENAI_API_KEY` / `NVIDIA_API_KEY`). Never give any of these a `VITE_`
   prefix. Keep public sign-ups disabled (step 2) — `/api/generate-theme` is
   gated on the helper account, and that gate assumes strangers can't self-register.

## Residual risks (by design)

- **Shared credential.** Every helper uses the same bridal-team login, so anyone
  who learns the bridal-team access code can use the D-Day features. This matches
  the operational model (a small group of trusted helpers on the day).
  `created_at` / `updated_at` columns provide a basic audit trail. For stronger
  isolation, switch to per-helper accounts.
- **Couple vs helper is enforced in the database for writes (#92).** The helper
  and couple are two distinct Supabase Auth users. RLS keys off the signed-in
  email via `public.is_helper()` (defined in `0001_core.sql`; policies in
  `0005_roles_security.sql`): the
  helper account has **no insert/update/delete** on `guests`, `tables`,
  `wedding_events`, or `guest_event_rsvps`, and **no access to the financial
  `submissions` table**. Its one permitted guest write — check-in — goes through
  the `set_guest_checkin` security-definer RPC, which can only touch the
  `checked_in` / `checked_in_at` columns. So a helper who bypasses the UI gates is
  refused by Postgres, not just by the browser.
  - **Configuration.** Enforcement keys on the helper email stored in the
    locked-down `public.app_config` table (RLS-on, no policy → only the SQL editor
    / `service_role` can write it — a helper cannot re-designate themselves). The
    migration seeds the `couple@wedding.local` / `helper@wedding.local` defaults;
    a deployment with its own addresses overrides them, keeping them in sync with
    `VITE_COUPLE_EMAIL` / `VITE_HELPER_EMAIL`:

    ```sql
    update public.app_config set value = lower('team@example.com')  where key = 'helper_email';
    update public.app_config set value = lower('bride@example.com') where key = 'couple_email';
    ```

    **Fail-open:** if `helper_email` is unset, `is_helper()` returns false for
    everyone and all authenticated users keep full access — the couple is never
    locked out, and `is_helper()` also fails open on any internal error.
  - **Read side (#99).** RLS filters rows, not columns, so direct guest selects
    are couple-only and the helper's D-Day reads go through the
    `get_checkin_guests()` security-definer projection
    (`0005_roles_security.sql`), which omits couple-only columns (private
    `notes`, `angbao_*`, `rsvp_token`, contact details).
- **Google Fonts** is loaded from an external origin (allow-listed in the CSP).
  Self-hosting the fonts would remove this dependency.
- **`VITE_ENABLE_ANGBAO=false` is a UI toggle, not a security control.** Disabling
  ang-bao tracking hides the public `#pay` page and the helper-side ang-bao UI in
  the browser bundle, but it does **not** alter RLS or storage policies: the
  anonymous *insert a pending submission* / *upload a receipt* grants from
  [`0001_core.sql`](supabase/migrations/0001_core.sql) /
  [`0005_roles_security.sql`](supabase/migrations/0005_roles_security.sql)
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

- **AI theme generation** (`api/generate-theme.js`, optional) is a paid,
  metered call, so it is gated more tightly than the other endpoints. It
  requires a valid Supabase access token **and** that the token's email matches
  the configured helper (`HELPER_EMAIL` / `VITE_HELPER_EMAIL`) — verified
  server-side via the service-role key — so a stranger who self-registers can't
  spend the couple's vision-API budget. **Set `HELPER_EMAIL` (or `VITE_HELPER_EMAIL`)
  for this endpoint: if neither is configured it falls back to accepting *any*
  authenticated user, so disabling public sign-ups (step 2) alone is not enough
  to lock it down.** It fails closed, applies a best-effort
  per-helper rate limit, and never fetches an attacker-supplied URL (the image
  is passed to the model as inline base64, so there is no SSRF surface). The
  model's reply is constrained to a hex-color-only palette, sanitized on the
  server and **again** when the public page renders it as CSS variables, so it
  cannot inject arbitrary CSS or markup. Provider keys (`ANTHROPIC_API_KEY` /
  `OPENAI_API_KEY` / `NVIDIA_API_KEY`) are server-only. A durable per-day quota
  (beyond the in-memory rate limit) is a sensible future hardening.

- **Wedding-page content writes are couple-gated (#101).** The
  `upsert_wedding_page` / `upsert_wedding_config` / `upsert_runsheet` /
  `upsert_budget_config` / `upsert_checklist_config` RPCs had historically been
  reachable with the anon key; their grants are now `authenticated`-only and each
  carries an internal couple-only gate (see
  [`0003_weddings_page.sql`](supabase/migrations/0003_weddings_page.sql),
  [`0004_smart_rsvp.sql`](supabase/migrations/0004_smart_rsvp.sql),
  [`0006_planning_features.sql`](supabase/migrations/0006_planning_features.sql)).
  The server-side `weddings_section_photos_size` check constraint
  (`pg_column_size(section_photos) < 200000`) remains the authoritative payload
  cap — the client-side "12 photos / 4 columns per slot" limits are UI-only.
  Photo URLs are stored and rendered as plain image `src`s (not HTML), so they
  can't inject markup. Likewise, the public `wedding-photos` storage bucket
  accepted anonymous upload/overwrite/delete until writes were restricted to the
  authenticated couple ([`0003_weddings_page.sql`](supabase/migrations/0003_weddings_page.sql) §3;
  public read stays — the bucket serves the hero/section images).

- **RSVP-by-name is anonymous by design.** `find_guest_by_name` and
  `submit_rsvp_by_name` are executable by `anon` so guests can RSVP with just
  their invitation name. The tradeoff: anyone can probe whether a name is on the
  guest list and submit/alter that guest's RSVP without a token. The token deep
  link (`/rsvp?token=…`) is the stricter path; if the enumeration tradeoff is
  unacceptable for your deployment, revoke the by-name RPCs from `anon` and send
  token links only.

- **Open RSVP is a deliberate widening of the anonymous surface**
  ([`0009_open_rsvp.sql`](supabase/migrations/0009_open_rsvp.sql), opt-in,
  default off). When enabled, the anon-callable `register_open_rsvp` RPC
  creates a guest row from a free-text name — gated by a **mandatory shared
  PIN** verified server-side. The PIN is a low-entropy invitation-card secret
  (≤ 20 chars), not an account credential: it is stored plainly, is **never**
  returned by any anon-callable RPC (`get_wedding_config` exposes only the
  `enable_open_rsvp` flag), and can be read back only through the couple-only
  `get_open_rsvp_admin_config` RPC (helper excluded). Brute force is bounded by
  a global sliding-window lockout — 20 wrong PINs in 15 minutes locks the open
  form until attempts age out (logged in the RLS-sealed
  `open_rsvp_pin_attempts` table) — so a determined attacker can at most
  temporarily lock the form, not enumerate a PIN. Self-registered guests are
  flagged (`guests.self_registered`) for the couple to vet; matching an
  existing primary guest by name returns that guest's token, which is the same
  surface `find_guest_by_name` already exposes *without* any PIN, so open mode
  is strictly tighter than the by-name path above.

- **Event audience targeting is cosmetic, not access control**
  ([`0010_event_audiences.sql`](supabase/migrations/0010_event_audiences.sql)).
  `wedding_events.audience_groups` filters which event cards the public RSVP
  form *shows*, keyed off the guest-**selected** `relationship_group` — so a
  guest can see any event by picking a different relationship. Do not treat it
  as a secrecy mechanism: event names/times in `get_public_events` remain
  readable to `anon` regardless. The authoritative per-guest gate is and
  remains `guest_event_rsvps.invited`.

- **Outbound email hardening.** Guest-controlled fields (name, meal choice,
  dietary notes) are HTML-escaped before interpolation into RSVP/reminder email
  templates, subjects are stripped of CR/LF, and the webhook / cron shared
  secrets are compared in constant time (`api/_lib/secureCompare.js`).

## Reporting a vulnerability

Please open a private security advisory on the repository, or contact the
maintainer directly. Do not file public issues for undisclosed vulnerabilities.
