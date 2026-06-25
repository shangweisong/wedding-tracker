# Wedding Tracker — Product Roadmap

## Overview

This document outlines the planned development for Phase 2 and Phase 3 of the Wedding Tracker app. Phase 1 (wedding day attendance + angbao tracking) is complete.

```
Phase 1 ✅  Wedding Day Attendance + Angbao Tracking
Phase 2 🔨  RSVP Collection + Table Assignment Planning
Phase 3 💡  AI Seating Suggestions + Personalised Wedding Page
```

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

**Known bug (deferred):** the fuzzy name-matching RPC (`submit_rsvp_by_name`, `supabase/migrations/0004_fuzzy_rsvp_by_name.sql`) falsely reports "ambiguous" when a guest's full name is a prefix of another guest's name (e.g. `rsvptest` vs `rsvptest2`), because its substring fallback matches both rows with no exact-match short-circuit. See [issue #18](https://github.com/shangweisong/wedding-tracker/issues/18).

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
2. **Reminder email — 90 days before wedding** — sent to all guests still `rsvp_status = 'pending'`, nudging them to respond
3. **Reminder email — 30 days before wedding** — same, second nudge for guests still `pending`

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

### 3.3 Personalised Wedding Page

Each couple gets a public wedding page at:
```
https://your-app.vercel.app/wedding/wei-ming-and-siew-yong
```

**Page sections:**
- Hero — couple names, wedding date, countdown timer
- Couple photo
- Love story / about us (free text, couple fills in)
- Event schedule (ceremony time, dinner time, venue address + map link)
- RSVP button → links to the RSVP form
- Dress code note
- Footer with contact details

**Customisation:**
- Template selection (3–5 options to start):
  - `Minimal` — clean white, serif fonts, gold accents
  - `Floral` — soft botanical illustrations, pastel tones
  - `Modern` — bold typography, dark background
  - `Traditional` — red and gold, Chinese-inspired motifs
  - `Garden` — sage green, watercolour style
- Couple uploads hero photo
- Accent colour picker
- Toggle sections on/off

**Database additions for wedding page:**

```sql
create table weddings (
  id uuid default gen_random_uuid() primary key,
  slug text unique,               -- e.g. 'wei-ming-and-siew-yong'
  bride_name text,
  groom_name text,
  wedding_date date,
  venue_name text,
  venue_address text,
  ceremony_time text,
  dinner_time text,
  love_story text,
  dress_code text,
  template text default 'minimal',
  accent_color text default '#c9a84c',
  hero_image_url text,
  meal_options text,              -- comma separated e.g. 'Chicken,Fish,Vegetarian'
  rsvp_deadline date,
  is_published boolean default false
);

alter table weddings enable row level security;
create policy "public" on weddings for all using (true) with check (true);
```

**App routing additions:**
```
/wedding/:slug          → Public personalised wedding page
/admin/wedding-settings → Couple configures their wedding page (PIN protected)
```

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
3. Build wedding page template system (start with 2 templates)
4. Admin wedding settings page (fill in couple details, pick template)
5. Publish wedding page at `/wedding/:slug`
6. ✅ Deterministic seating suggestion algorithm (no AI)
7. ✅ Seating suggestion UI in admin (generate → review → adjust)
8. ✅ `.ics` calendar invite generator (attached to the confirmation email — no
   standalone "Add to Calendar" button on the confirmation screen yet, since
   there's no public wedding page to host it on)
9. ✅ Resend serverless function for RSVP confirmation email (with `.ics` attached)
10. ✅ Vercel Cron job for 90/30-day pending-guest reminder emails
11. Additional templates
12. Multi-couple auth (if needed)

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

## Housekeeping (deferred — once MVP is running)

- Vercel env var setup is manual/one-at-a-time (`vercel env add` per variable) — see [issue #17](https://github.com/shangweisong/wedding-tracker/issues/17), which also covers the Resend sandbox-sender → verified-domain decision still pending.
- The Supabase Vault `vault.create_secret(...)` step for the RSVP email webhook is a manual SQL step with no UI — also tracked in issue #17.
- `supabase/migrations/` has grown to 6 files (895 lines) with some pure follow-up-fix files (e.g. `0004` exists only to patch a function from `0003`) — consider consolidating once the schema settles. See [issue #19](https://github.com/shangweisong/wedding-tracker/issues/19).

---

## Notes for Claude Code

- All environment variables use the `VITE_` prefix for Vite compatibility
- Supabase client can be upgraded to the official `@supabase/supabase-js` SDK in Phase 2 for better real-time support and auth
- Consider splitting the app into feature folders as it grows: `/features/rsvp`, `/features/seating`, `/features/wedding-page`
- React Router v6 is recommended
- For drag-and-drop seating: consider `@dnd-kit/core` — lightweight and accessible
