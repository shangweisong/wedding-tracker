# Wedding Tracker — Product Roadmap

## Overview

This document outlines the planned development for Phase 2 and Phase 3 of the Wedding Tracker app. Phase 1 (wedding day attendance + angbao tracking) is complete.

```
Phase 1 ✅  Wedding Day Attendance + Angbao Tracking
Phase 2 ✅  RSVP Collection + Table Assignment Planning
Phase 3 ✅  Personalised Wedding Page  (seating ✅, emails ✅, setup ✅, public page ✅)
Phase 4 ✅  Fun to Have — Wedding Wishes Wrapped
```

---

## Pending Issues

A quick-scan list of known bugs, deferred work, and housekeeping. Details live in their respective sections below.

| # | Area | Summary | Section |
|---|---|---|---|
| 1 | RSVP | ~~**Fuzzy name match false-positive**~~ ✅ — no-token RSVP flow now uses search-and-select + token-based submit; `submit_rsvp_by_name` is no longer called at submission time. [Issue #18](https://github.com/shangweisong/wedding-tracker/issues/18) | §3.1 |
| 2 | Email | ~~**Supabase Vault webhook setup is manual**~~ ✅ — `scripts/setup-vault-secrets.sh` reads `.env` and either runs the SQL via the Supabase CLI or prints a pre-filled snippet to paste into the SQL Editor. [Issue #17](https://github.com/shangweisong/wedding-tracker/issues/17) | §Housekeeping |
| 3 | Wedding Page | ~~**Single template only**~~ ✅ — Minimal, Garden (forest green) and Traditional Chinese (red & gold) presets, plus a **Custom** theme generated from an uploaded photo by a vision LLM (#60). Theme picker in Wedding Page tab. Applies to wedding page + RSVP form only. | §3.3 |
| 4 | Docs | ~~**README → User Guide split**~~ ✅ — `docs/USER_GUIDE.md` created; README is now a 1-page overview + quick-start. | §Housekeeping |
| 5 | Migrations | ~~**Migration consolidation**~~ ✅ — `0006`/`0007` merged into `0005`; `0006_themes` merged into `0004`. Migration table is now 6 files (`0006_ai_theme.sql` added for the AI Custom theme, #60). CLI users: see USER_GUIDE §1a for tracking cleanup. | §Housekeeping |
| 6 | Security | ~~**Admin PIN disabled**~~ ✅ — `unlocked` restored to `useState(isDemoMode)`; `VITE_HELPER_PASSWORD` removed (was exposing Supabase password in JS bundle). [PR #31](https://github.com/shangweisong/wedding-tracker/pull/31) | §Security |
| 7 | Security | ~~**`CRON_SECRET` not enforced**~~ ✅ — now mandatory; returns 500 if env var absent, 401 if header mismatch. | §Security |
| 8 | Email | ~~**RSVP email buttons undersized**~~ ✅ — reminder CTA bumped to `16px 36px`; "Update RSVP" promoted to outlined button in confirmation/declined emails. | §Security |
| 9 | Security | ~~**PayNow `/#pay` page is fully public**~~ ✅ — documented with explicit "intentionally no auth check" comment in `AdminApp.jsx`. | §Security |
| 10 | Wishes Wrapped | ~~**Not started**~~ ✅ — Phase 4 complete: pure-stats engine, Elegant + Vibrant themes, Hall of Silence MC callout, per-slide toggle, 114 unit tests. AI tier and keepsake export remain optional follow-ons. | §4 |
| 11 | Docs | ~~**README hero GIF + screenshots**~~ ✅ — hero GIF added after title, `## Screenshots` section added after Features with per-section PNGs in `docs/`. | §Housekeeping |

---

## Phase 2 — RSVP Collection + Table Assignment Planning

### Goal
Transform the app from a day-of tool into a full pre-wedding planning companion. Couples collect RSVPs digitally, assign guests to tables, and arrive on the wedding day with everything already set up.

---

### 2.1 Database Changes

Add the following columns to the existing `guests` table in Supabase:

```sql
alter table guests add column rsvp_status text default 'pending';
-- values: 'pending' | 'confirmed' | 'declined'

alter table guests add column rsvp_at timestamptz;
-- timestamp of when guest responded

alter table guests add column meal_choice text default '';
-- e.g. 'chicken' | 'fish' | 'vegetarian'

alter table guests add column plus_one_name text default '';
-- name of plus one if bringing someone

alter table guests add column dietary_notes text default '';
-- allergies or special dietary requirements

alter table guests add column phone text default '';
-- for future WhatsApp notifications

alter table guests add column relationship_group text default '';
-- e.g. 'family' | 'uni_friends' | 'secondary_school' | 'colleagues' | 'childhood_friends' | 'other'

alter table guests add column rsvp_token uuid default gen_random_uuid();
-- unique token for personalised RSVP links
```

Create a new `tables` table to manage table configuration:

```sql
create table tables (
  id uuid default gen_random_uuid() primary key,
  table_number text,
  label text,
  capacity int default 10,
  is_locked boolean default false
);

alter table tables enable row level security;

create policy "public" on tables
  for all using (true) with check (true);
```

---

### 2.2 RSVP Email Automation

**Email service:** [Resend](https://resend.com) — free tier includes 3,000 emails/month, simple API.

**Flow:**
```
Couple adds guest + email in admin →
App calls Resend API with personalised RSVP link →
Guest receives branded email →
Guest clicks link → lands on RSVP form →
Guest submits → Supabase auto-updates rsvp_status, meal_choice etc →
Couple sees live update in admin dashboard
```

**Personalised RSVP link format:**
```
https://your-app.vercel.app/rsvp?token=<rsvp_token>
```

Each guest has a unique `rsvp_token` (UUID) generated on creation. The link pre-fills their name so they just confirm details.

**Email template content:**
- Couple names + wedding date
- Venue name
- RSVP deadline
- CTA button → "Confirm My Attendance"

**Environment variable to add:**
```
VITE_RESEND_API_KEY=your_resend_api_key
```

**WithJoy integration (optional):**
- WithJoy does not currently expose a public API
- Recommended approach: couples export their WithJoy guest list as CSV and import via the existing CSV import feature
- Monitor WithJoy for API availability in future

---

### 2.3 Public RSVP Form

A separate public route `/rsvp` — no PIN required.

**Fields shown to guest:**
- Name (pre-filled from token, read-only)
- Attendance confirmation (Yes / No / Maybe)
- Meal choice (options configured by couple in admin)
- Plus one (toggle → name field appears if yes)
- Dietary notes (free text)
- Message to couple (optional, fun touch)

**Behaviour:**
- If token is valid → pre-fill name, show form
- If token is invalid or missing → show general search by name fallback
- If guest declines → rsvp_status set to `declined`, hidden from wedding day view
- Confirmation screen shown after submission with wedding details

---

### 2.4 Admin RSVP Dashboard

New tab in the admin app: **"RSVP"**

**Summary stats panel:**
- Total invited
- Confirmed / Declined / Pending counts
- Total confirmed headcount (including plus ones)
- Meal choice breakdown (e.g. Chicken: 32, Fish: 18, Vegetarian: 5)

**Guest RSVP list:**
- Filter by status: All / Confirmed / Declined / Pending
- Filter by party: Bride / Groom
- Resend RSVP email button per guest
- Manually mark as confirmed (for physical invite guests)
- Edit meal choice, plus one, dietary notes inline

**Manual add:**
- Existing add guest form remains
- New field: mark RSVP status directly (for guests invited physically)

---

### 2.5 Table Assignment Planning

New tab in the admin app: **"Seating Plan"**

**Unassigned pool:**
- All confirmed guests without a table assignment appear here
- Filter by relationship group, party (bride/groom)
- Search by name

**Table management:**
- Create / edit / delete tables
- Set table label (e.g. "VIP Table", "Groom's Family") and capacity
- Visual capacity indicator (e.g. 7/10 filled)

**Assignment flow:**
- Drag guest from unassigned pool → drop onto a table card
- Or use a dropdown on each guest row to assign table
- Warning shown when table exceeds capacity
- Lock table toggle — prevent accidental changes once finalised

**Bulk actions:**
- Select multiple guests → assign to table
- Move all guests from one table to another

**Export:**
- Download seating plan as CSV for venue coordinator
- Print view — clean table-by-table layout

---

### 2.6 App Routing Structure

Phase 2 introduces multiple pages. Suggested routing using React Router:

```
/                   → Admin app (PIN protected)
/rsvp               → Public RSVP form (general, search by name)
/rsvp?token=xxxx    → Personalised RSVP form (pre-filled)
```

Install React Router:
```bash
npm install react-router-dom
```

---

### Phase 2 Build Order

1. Database schema changes (SQL above)
2. Add React Router, set up `/rsvp` route
3. Build public RSVP form page
4. Resend email integration + send RSVP email button in admin
5. Admin RSVP dashboard tab (stats + list)
6. Tables table + table management UI
7. Seating plan tab with drag-and-drop assignment
8. Export seating plan CSV

---

---

## Phase 3 — AI Seating Suggestions + Personalised Wedding Page

### Goal
Reduce the manual effort of seating planning using AI-generated suggestions based on guest relationships, and give couples a beautiful personalised wedding page to share with guests for RSVPs.

---

### 3.1 Guest Relationship Data Collection

During RSVP, ask an additional question:

**"How do you know the couple?"**
```
○ Family
○ University Friends
○ Secondary School Friends
○ Primary School Friends
○ Colleagues
○ Childhood Friends
○ Neighbours
○ Other
```

**"Closer to:"**
```
○ Bride   ○ Groom   ○ Both
```

This data maps to the existing `relationship_group` and `party` columns and feeds directly into the AI seating algorithm.

Also collect the guest's **email address** on the RSVP form (see 3.1a below) — required for calendar invites and automated email reminders (3.1b, 3.1c).

~~**Known bug (deferred):** the fuzzy name-matching RPC (`submit_rsvp_by_name`) falsely reports "ambiguous" when a guest's full name is a prefix of another guest's name.~~ **Fixed ([PR #27](https://github.com/shangweisong/wedding-tracker/pull/27))** — the no-token RSVP flow now uses a search-and-select dropdown (`find_guest_by_name`) and submits via the token-based `submit_rsvp` RPC, bypassing `submit_rsvp_by_name` at submission time entirely. See [issue #18](https://github.com/shangweisong/wedding-tracker/issues/18).

---

### 3.1a RSVP Collects Email Address ✅ (implemented)

**Why:** `guests.phone` already exists for future WhatsApp notifications, but there's no email on file per-guest — needed to send the calendar invite and reminder emails below.

**DB change:**
```sql
alter table guests add column email text default '';
-- guest's email, collected at RSVP, used for calendar invite + reminder emails
```

**RSVP form (`src/rsvp/RsvpPage.jsx`):**
- Add an email field (required, basic format validation) alongside the existing fields
- Pre-fill from `guests.email` if already on file (e.g. couple imported it via CSV)
- `submit_rsvp` RPC updates `email` along with the other RSVP fields

**Admin (`src/admin/RsvpTab.jsx`):**
- Show email in the guest row / inline edit, so couples can manually add it for guests invited physically

---

### 3.1b Calendar Invite Feature ✅ (implemented — attached to confirmation email)

**Why:** Once a guest confirms attendance, give them a one-click way to add the wedding to their calendar instead of manually copying date/time/venue.

**Approach:** Generate a standard `.ics` file (no third-party calendar API needed — works with Google Calendar, Apple Calendar, Outlook).

**Flow:**
```
Guest confirms RSVP (status → 'confirmed') →
Confirmation screen shows "Add to Calendar" button →
Button downloads/links a generated .ics file built from `weddings` table
  (wedding_date, ceremony_time, dinner_time, venue_name, venue_address) →
Same .ics attached to the confirmation/reminder emails (3.1c)
```

**Implementation notes:**
- Small `.ics` builder util (e.g. `src/shared/ics.js`) — VEVENT with `DTSTART`/`DTEND` from `ceremony_time`/`dinner_time`, `LOCATION` from `venue_address`, `SUMMARY` from couple names
- No new dependency required for a single VEVENT; reach for a lightweight package only if multiple events (ceremony + dinner) need richer recurrence/timezone handling
- Served as a data URL or small serverless endpoint (`/api/calendar.ics?token=...`) so it can also be attached to outbound emails

---

### 3.1c Automated RSVP + Reminder Emails ✅ (implemented)

**Why:** Builds on the deferred Phase 2 Resend integration (Stage 5) — now triggered automatically by RSVP submission and by date, instead of only a manual "send" button.

**Emails sent:**
1. **Confirmation email** — sent immediately after a guest submits the RSVP form (whether confirmed or declined), summarising their response + the `.ics` calendar attachment (3.1b) if confirmed
2. **Reminder email — 90 days before wedding** — sent to all `confirmed` guests: warm, excited tone with date, venue name, and dress code; links to the wedding page if published
3. **Reminder email — 30 days before wedding** — sent to all `confirmed` guests: full logistics (schedule, venue + address + Google Maps, dress code, getting there directions) + "Update RSVP" button in case plans changed

**Implementation:**
- Reuse the Phase 2 Resend setup: `RESEND_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` as server-only env vars (no `VITE_` prefix) in a Vercel serverless function
- Confirmation email: triggered synchronously from the `submit_rsvp` flow (serverless function called right after the RPC succeeds)
- 90/30-day reminders: a Vercel Cron job (`vercel.json` `crons` entry) running daily, querying `weddings.wedding_date` and `guests` where `rsvp_status = 'pending'`, firing once each guest crosses the 90-day and 30-day thresholds (track via a `last_reminder_sent_at` column to avoid duplicate sends)

```sql
alter table guests add column last_reminder_sent_at timestamptz;
-- prevents duplicate 90/30-day reminder sends
```

**Known rough edges:** manual Vercel env var + Supabase Vault setup, and the pending Resend sandbox→domain decision — see [Housekeeping](#housekeeping-deferred--once-mvp-is-running) below.

---

### 3.2 Draft Seating Suggestions ✅ (implemented, deterministic — no LLM)

No AI call. The arrangement is a bin-packing problem with clean categorical
keys (`party`, `relationship_group`, `friend_subgroup`), not a language
problem, so a plain clustering/greedy-pack algorithm gives a free,
instant, deterministic starting draft that the couple then rearranges by
hand — the goal is a good base, not a finished plan.

**How it works** (`src/admin/seatingSuggestion.js`, wired into
`SeatingTab.jsx` via the "✨ Generate Draft Seating" button):
1. Couple clicks **"Generate Draft Seating"** in the Seating Plan tab
2. Unassigned confirmed guests are grouped by side (`party`) → category
   (`relationship_group`) → friend subtype (`friend_subgroup`)
3. Groups are packed into unlocked tables in order, preferring an empty
   table per group; VIPs within a group are seated first
4. A group too large for one table spills into the next adjacent table
   (same side) rather than scattering
5. Locked tables are excluded as targets entirely; already-assigned guests
   are never touched (fill-only — safe to re-run after manual edits)
6. Couple reviews the result and drags/reassigns guests manually as needed

---

### 3.3 Wedding Setup — Core Details ✅ (implemented)

The `weddings` singleton table and admin UI replace the old server env vars.

**What's done (`supabase/migrations/0007_wedding_setup.sql`):**
- `weddings` table — `bride_name`, `groom_name`, `wedding_date`, `venue_name`, `venue_address`, `ceremony_time`, `dinner_time`
- `get_wedding_config()` / `upsert_wedding_config()` RPCs (anon-accessible)
- Admin **Wedding Setup modal** — auto-opens on first launch as an onboarding gate; re-openable via the ⚙ gear icon in the header
- Old env vars (`WEDDING_DATE`, `CEREMONY_TIME`, `DINNER_TIME`, `VENUE_NAME`, `VENUE_ADDRESS`, `COUPLE_NAMES`) fully removed — API functions now read from the `weddings` table

**App personalisation using wedding details (all ✅):**
- Admin header title — "♡ Wei Ming & Siew Yong" once names are set
- Countdown pill in header — "183 days to go" / "Today! 🎊"
- Browser tab title — personalised on admin and RSVP pages
- RSVP page — couple names + date + venue shown; "Closer to" uses real names; confirmation message personalised
- PayNow ang-bao page — shows couple names in header
- CSV export — filename uses couple names

**Public wedding page ✅ (implemented — `supabase/migrations/0008_wedding_page.sql`, `src/wedding/WeddingPage.jsx`, `src/wedding/WeddingPageTab.jsx`):**

Each couple gets a public wedding page at:
```
https://your-app.vercel.app/wedding/wei-ming-and-siew-yong
```

**Page sections (all live):**
- Hero — couple names, wedding date, countdown timer, hero photo
- Love story / about us (free text)
- Fun Q&A — playful questions with couple's answers
- Event schedule — tea ceremony (optional) + solemnisation + dinner reception + venue + Google Maps link
- Getting There — freetext directions + Google Maps button (`0010_getting_there.sql`)
- RSVP CTA → links to the RSVP form
- Dress code badge

**Admin tab — "Wedding Page" (`WeddingPageTab.jsx`):**
- Slug, love story, dress code, hero photo upload, fun Q&A editor
- Getting There textarea (2000 chars)
- RSVP deadline, publish toggle
- Live preview link

**Wedding Setup modal (`WeddingSetupTab.jsx`):**
- "Ceremony time" renamed to "Solemnisation time" (9 AM–6 PM range)
- "Tea ceremony time" optional field added (8 AM–1 PM range, `0009_tea_ceremony.sql`)
- "Meal time" split into Lunch (12–4 PM) and Dinner (5–10 PM) optgroups

**Columns added (`0008_wedding_page.sql` + `0009` + `0010`):**
```sql
alter table weddings add column slug text unique;
alter table weddings add column love_story text default '';
alter table weddings add column dress_code text default '';
alter table weddings add column hero_image_url text default '';
alter table weddings add column fun_qa jsonb default '[]';
alter table weddings add column rsvp_deadline date;
alter table weddings add column is_published boolean default false;
alter table weddings add column tea_ceremony_time time;      -- 0009
alter table weddings add column getting_there text default ''; -- 0010
```

**RPCs:** `get_wedding_config()`, `upsert_wedding_config()`, `upsert_wedding_page()`, `get_public_wedding(p_slug)`

**Mobile fix:** hero image on portrait mobile uses `background-size: contain` so full photo is visible (was cropped with `cover` on tall viewports)

**App routing:**
```
/wedding/:slug          → Public personalised wedding page (live ✅)
```

**Still pending:**
- Additional templates (only Minimal dark-gold theme implemented)
- Accent colour picker

---

### 3.5 RSVP Update Links & Host Change-of-Mind Notifications ✅ (implemented)

**Why:** Guests needed a way to update their RSVP after initial submission, and the couple needed to know when someone changed their mind — without inbox noise from every first-time submission.

---

**Personalised RSVP update links in emails ✅**

Every guest-facing email (reminder + confirmation + declined) now includes a token-based link so the guest can return and update their response at any time:

```
https://your-app.vercel.app/rsvp?token=<rsvp_token>
```

The `rsvp_token` UUID already existed in the DB (`guests.rsvp_token`). The gap was that emails never included it. Both `send-rsvp-email.js` (confirmation/declined emails) and `send-reminders.js` (90/30-day nudges) now fetch `rsvp_token` alongside other guest data and embed a branded "Update RSVP" button.

**New env var required:**
```
SITE_URL=https://your-app.vercel.app
```
Used server-side to build the RSVP link. No `VITE_` prefix — never exposed to the browser.

---

**RSVP form pre-fill from token ✅**

When a guest arrives via `?token=<uuid>`, `RsvpPage.jsx` now calls `get_guest_by_rsvp_token` to pre-load all their existing answers (name, attendance, meal, dietary, relationship, party). The name field is locked read-only. On submit, uses `submit_rsvp` (token-based RPC) instead of the fuzzy name-match — exact lookup, no ambiguity risk. Falls back to name-search flow if no token present.

---

**Host change-of-mind notifications ✅**

When a guest changes their RSVP status in either direction (`confirmed → declined` or `declined → confirmed`), a notification email is sent to the couple. First-time submissions (`pending → confirmed/declined`) do **not** trigger a host notification — avoiding inbox noise during the initial RSVP collection period.

**How it works:**
- `0006_rsvp_host_notify.sql` — updates the `notify_rsvp_status_change()` Postgres trigger to include `old_rsvp_status` in the webhook payload (alongside the existing `guest_id`)
- `send-rsvp-email.js` — if `old_rsvp_status` is `confirmed` or `declined`, sends a second email to `HOST_EMAIL` with guest name, old → new status, and meal/dietary notes if now confirmed
- Subject line: `RSVP change: [Name] is now attending/not attending`

**New env var required:**
```
HOST_EMAIL=your@email.com
```

**New migration:** `supabase/migrations/0006_rsvp_host_notify.sql`

---

### 3.4 Multi-Couple Support (Future consideration)

Currently the app is single-couple. Phase 3 may need to support multiple couples if this becomes a hosted product.

Options:
- **Supabase Auth** — each couple signs up, data scoped by `user_id`
- **Simple passphrase** — each couple gets a unique admin passphrase instead of shared PIN
- Keep single-couple for now, revisit if productising

---

### Phase 3 Build Order

1. ✅ Add relationship group question to RSVP form
2. ✅ Add email field to RSVP form + `guests.email` migration
3. ✅ `weddings` table + RPCs + admin Wedding Setup modal (onboarding gate + gear icon)
4. ✅ App personalisation — header title, countdown pill, RSVP page, PayNow page, CSV filename, browser tab title
5. ✅ Deterministic seating suggestion algorithm (no AI)
6. ✅ Seating suggestion UI in admin (generate → review → adjust)
7. ✅ `.ics` calendar invite generator (attached to the confirmation email)
8. ✅ Resend serverless function for RSVP confirmation email (with `.ics` attached)
9. ✅ Vercel Cron job for 90/30-day pending-guest reminder emails
10. ✅ Build public wedding page (Minimal template — dark gold, Cormorant Garamond)
11. ✅ Add remaining `weddings` columns (slug, love_story, dress_code, hero_image_url, fun_qa, rsvp_deadline, is_published) via `0008_wedding_page.sql`
12. ✅ Publish wedding page at `/wedding/:slug`
13. ✅ Expand Wedding Setup modal — love story, dress code, hero photo upload, fun Q&A, publish toggle
14. ✅ Personalised RSVP update links in all guest emails (`SITE_URL` env var + token button in confirmation, declined, and reminder emails)
15. ✅ Host change-of-mind notifications (`HOST_EMAIL` env var + `0006_rsvp_host_notify.sql` trigger update + `send-rsvp-email.js` host email)
16. ✅ Additional templates — Garden (forest green) and Traditional Chinese (red & gold) themes added via `0006_themes.sql`. Theme picker in Wedding Page tab; affects wedding page + RSVP page only.
17. Multi-couple auth (if needed)

---

## Full Architecture (End State)

```
                    ┌──────────────────────────┐
                    │   /wedding/:slug          │
                    │   Personalised Page       │  ← couple customises
                    │   (public)                │
                    └────────────┬─────────────┘
                                 │ guests visit + RSVP
                    ┌────────────▼─────────────┐
                    │   /rsvp?token=xxxx        │
                    │   RSVP Form               │  ← collects relationship,
                    │   (public)                │     meal, plus one
                    └────────────┬─────────────┘
                                 │ auto-writes
                    ┌────────────▼─────────────┐
                    │        Supabase           │
                    │   guests + tables +       │  ← single source of truth
                    │   weddings tables         │
                    └────────────┬─────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
   ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐
   │ /admin         │  │ Seating Draft   │  │ Wedding Day      │
   │ RSVP Dashboard │  │ Algorithm       │  │ Attendance +     │
   │ Seating Plan   │  │ (deterministic) │  │ Angbao Tracking  │
   │ Wedding Setup  │  │                 │  │                  │
   └────────────────┘  └─────────────────┘  └──────────────────┘
```

---

## Full Tech Stack

| Layer | Tool | Cost |
|---|---|---|
| Frontend | React + Vite | Free |
| Styling | Tailwind CSS or CSS-in-JS | Free |
| Routing | React Router | Free |
| Database | Supabase (PostgreSQL) | Free tier |
| Auth | Supabase Auth | Free tier |
| File storage | Supabase Storage | Free 1GB |
| Email | Resend | Free 3k/month |
| Seating draft | In-app grouping algorithm | Free |
| Deployment | Vercel | Free tier |

---

## Security (issues #6–#9)

### #6 — Re-enable Admin PIN ✅ Fixed (PR #31)

`unlocked` restored to `useState(isDemoMode)`. `VITE_HELPER_PASSWORD` also removed — it was embedding the Supabase Auth password in the JS bundle (all `VITE_` vars are bundled and publicly visible). The auto-sign-in block that read it was deleted; correct flow is helper types PIN → Supabase verifies server-side → session persists in localStorage. `SECURITY.md` and `USER_GUIDE.md` updated to warn against `VITE_HELPER_PASSWORD`.

---

### #7 — Make `CRON_SECRET` mandatory ✅ Fixed

Guard inverted in `send-reminders.js` — returns 500 if `CRON_SECRET` env var is absent, 401 if the `Authorization` header doesn't match. The endpoint is no longer callable without the secret.

### #8 — Bigger RSVP email buttons ✅ Fixed

- Reminder email (`send-reminders.js`): CTA padding `12px 28px` → `16px 36px`, font size `15px` → `16px`.
- Confirmation/declined emails (`send-rsvp-email.js`): "Update RSVP" promoted from inline text link to a proper outlined `<a>` button.

### #9 — PayNow page visibility ✅ Documented

Explicit "intentionally no auth check" comment added in `AdminApp.jsx` near the `route === "pay"` branch.

---

## Housekeeping (deferred — once MVP is running)

- ✅ Vercel env var setup automated via `scripts/setup-vercel-env.sh` — reads `.env`, detects provider, pushes all server-only vars to Vercel in one command ([PR #26](https://github.com/shangweisong/wedding-tracker/pull/26), closes [issue #17](https://github.com/shangweisong/wedding-tracker/issues/17) setup-script part).
- ✅ Pluggable email provider — `EMAIL_PROVIDER=gmail` (default, no domain needed) or `EMAIL_PROVIDER=resend` (custom domain). Brevo removed due to incompatibility with Vercel's dynamic IPs ([PR #26](https://github.com/shangweisong/wedding-tracker/pull/26)).
- ✅ **Supabase Vault setup semi-automated** — `scripts/setup-vault-secrets.sh` reads `.env` and either runs the SQL via the Supabase CLI or prints a pre-filled snippet to paste into the SQL Editor. Closes the remaining part of [issue #17](https://github.com/shangweisong/wedding-tracker/issues/17).
- ✅ Two new server-only env vars added for RSVP update links and host notifications: `SITE_URL` (base URL for token links) and `HOST_EMAIL` (destination for change-of-mind alerts). Neither uses a `VITE_` prefix.
- ✅ `supabase/migrations/` consolidated from 10 files → 5 files ([PR #25](https://github.com/shangweisong/wedding-tracker/pull/25), closes [issue #19](https://github.com/shangweisong/wedding-tracker/issues/19)). New structure:
  - `0001_init.sql` — guests table + trigger (unchanged)
  - `0002_draw_and_submissions.sql` — draw numbers + submissions (unchanged)
  - `0003_rsvp_seating.sql` — all RSVP/seating columns + final-form RPCs
  - `0004_weddings.sql` — weddings table (all columns) + page RPCs + photo bucket
  - `0005_email_automation.sql` — **optional**, apply after Resend + Vercel are configured
  - `reconcile_remote_db.sql` — run once in Supabase SQL Editor on existing projects to sync migration tracking
- ✅ **Migration consolidation** — `0006` (`old_rsvp_status` in webhook payload) and `0007` (`second_reminder_sent_at` column) both merged into `0005` and deleted. Migration folder is back to a clean 5-file structure. CLI users on existing deployments: see USER_GUIDE §1a for the one-time tracking cleanup SQL.
- ✅ **README → User Guide split** — detailed setup instructions (Supabase, email, Vercel, CSV, PayNow, angbao) extracted to [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md). README is now a 1-page overview + quick-start that links to the guide for depth.
- ✅ **README hero GIF + screenshots** — `docs/demo.gif` added after title; `## Screenshots` section with per-section PNGs (`docs/screenshot-*.png`) added after Features. Branch `docs/readme-hero-gif`.

---

## Phase 4 — Fun to Have: Wedding Wishes Wrapped

### Goal

Turn guest well-wishes (collected via the RSVP form) into a Spotify Wrapped–style presentation — a fun, visual recap the couple can run during the reception or keep as a digital keepsake. The feature is additive and self-contained; nothing in Phases 1–3 needs to change.

---

### 4.1 Data Source

Guest well-wishes already live in `guests.message_to_couple` (free-text field collected on the RSVP form). No new DB columns are needed for the MVP.

---

### 4.2 MVP — Pure Stats (No AI)

All computed client-side from the existing guest data; zero new infrastructure.

**Stats to generate:**

| Stat | How |
|---|---|
| Total wishes received | `count` of guests where `message_to_couple` is non-empty |
| Total words written | tokenise all messages |
| Average wish length | total words ÷ total wishes |
| Longest wish | max word count |
| Shortest wish | min word count (non-empty) |
| Most emojis | emoji regex scan |
| Most exclamation marks | `!` count per message |
| Top words (word cloud) | frequency map, stop-words filtered |
| Guest awards | computed from stats above — see §4.3 |

**Implementation:** `src/admin/wishesWrapped.js` — pure functions, fully testable, no side effects.

---

### 4.3 Guest Awards

Deterministic awards derived from the stats. Suggested set:

| Award | Criteria |
|---|---|
| Most Enthusiastic | highest `!` count |
| Most Emoji | highest emoji count |
| Most Words | longest message by word count |
| Fewest Words | shortest non-empty message |
| Most Poetic | highest unique-word ratio |

Awards are computed in `wishesWrapped.js` and passed as props into the slide components.

---

### 4.4 Admin Tab — Wishes Wrapped

New tab in the admin app: **"Wishes Wrapped"** (appears after "Wedding Page").

- **Generate** button — runs `wishesWrapped.js` over live guest data, stores result in component state
- **Preview slides** — scrollable preview of all slides in the tab
- **Enter Presentation** button — opens `/wishes-wrapped` in a new tab / fullscreen

No new DB table needed for MVP; state is ephemeral (re-generated on demand). If persistence is needed later, store the JSON blob in `weddings.wishes_wrapped_json jsonb`.

---

### 4.5 Presentation Mode — `/wishes-wrapped`

New public (or PIN-gated) route for the live projector display.

**Slides (in order):**

1. **Title** — "Wedding Wishes Wrapped ✨ — [Couple Names]"
2. **By the Numbers** — total wishes, total words, average length
3. **Word Cloud** — top 30 words, sized by frequency
4. **Top Themes** *(Phase 4.2 AI tier)* — placeholder slide in MVP
5. **Guest Awards** — one award per slide, animated reveal
6. **AI Observations** *(Phase 4.2 AI tier)* — placeholder in MVP
7. **Relationship Recipe** *(Phase 4.2 AI tier)* — placeholder in MVP
8. **Collective Letter** *(Phase 4.2 AI tier)* — placeholder in MVP
9. **One-Sentence Blessing** *(Phase 4.2 AI tier)* — placeholder in MVP
10. **Thank You** — couple names + wedding date

**UX requirements:**
- Fullscreen via the Fullscreen API (`document.documentElement.requestFullscreen()`)
- Keyboard navigation: `←` / `→` / `Space` to advance; `Esc` exits fullscreen
- Auto-advance toggle (configurable interval, default 8 s)
- Projector-friendly: dark background, large text, no scrollbars

**Route:** `/wishes-wrapped` — add to `src/main.jsx` alongside existing routes.

---

### 4.6 AI Enhancement (Phase 4.2 — optional, gated)

Call an LLM **only** through a Vercel Serverless Function — never expose the API key to the browser.

**Endpoint:** `api/generate-wishes-wrapped.js`

**Flow:**
```
Admin clicks "Generate AI Insights"
        ↓
POST /api/generate-wishes-wrapped  { guestMessages: [...] }
        ↓
Serverless function calls LLM API (OPENAI_API_KEY or ANTHROPIC_API_KEY)
        ↓
Returns structured JSON { themes, observations, recipe, letter, blessing }
        ↓
Stored in weddings.wishes_wrapped_json (upserted)
        ↓
Presentation reads from Supabase — no re-generation needed on reload
```

**Suggested LLM outputs:**

| Output | Prompt goal |
|---|---|
| Theme classification | Group messages into 3–5 recurring emotional themes |
| Funny observations | Light, humorous pattern spotted across all wishes |
| Relationship recipe | "To make this marriage: 2 cups of laughter, 1 tablespoon of…" |
| Collective letter | One synthesised letter from all guests to the couple |
| One-sentence blessing | Single poetic line distilling all the wishes |

**Env var required:**
```
OPENAI_API_KEY   # or ANTHROPIC_API_KEY — server-only, no VITE_ prefix
```

---

### 4.7 Keepsake Export (Phase 4.3 — future)

Allow exporting the Wrapped as:
- **JSON** — raw stats + AI outputs (trivial, just download `wishes_wrapped_json`)
- **PDF** — use `react-pdf` or `html2canvas` + `jsPDF`; one page per slide
- **Images** — `html2canvas` per slide → PNG download
- **Video** — pre-recorded screen capture guidance only; no automated video generation

---

### Phase 4 Build Order

1. ✅ `src/admin/wishesWrapped.js` — pure stats + awards + participation commentary + sides + clusters + emojis + opening word + novel pages + Hall of Silence. 114 unit tests.
2. ✅ Admin **Wishes Wrapped tab** — generate button, stat cards, theme toggle (Elegant / Vibrant), per-slide toggle chips (All / None shortcuts), enter-presentation button.
3. ✅ `/wishes-wrapped` route — 10 slide types, keyboard nav (`←` `→` `Space`), 8-second auto-advance, fullscreen API, two themes, slide selection from session.
4. ✅ **Hall of Silence** — random 3-person callout with MC prompt; re-shuffled on each Generate.
5. ✅ **Per-slide toggle** — `SLIDE_TOGGLES` predicate array; `enabledSlides` Set serialised through `localStorage`.
6. *(Optional)* `api/generate-wishes-wrapped.js` — AI tier (needs `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, server-only)
7. *(Optional)* Persist `wishes_wrapped_json` in `weddings` table — `0006_wishes_wrapped.sql`
8. *(Optional)* Keepsake export — JSON download first, then PDF/images via `html2canvas` + `jsPDF`

---

## Notes for Claude Code

- All environment variables use the `VITE_` prefix for Vite compatibility
- Supabase client can be upgraded to the official `@supabase/supabase-js` SDK in Phase 2 for better real-time support and auth
- Consider splitting the app into feature folders as it grows: `/features/rsvp`, `/features/seating`, `/features/wedding-page`
- React Router v6 is recommended
- For drag-and-drop seating: consider `@dnd-kit/core` — lightweight and accessible
