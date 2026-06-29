# Changelog

All notable changes to Wedding Tracker are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2026-06-29] — feat/delete-guest-reset-seating (PR #35)

### Added

- **Delete guest with safety confirmation** — trash button on every RSVP tab row opens a confirmation modal. Safe mode (default) requires typing `DELETE` before the button activates; quick mode is a one-click confirm. Toggle persists to `localStorage`. Deletion calls `sb.delete("guests", id)`; FK on `submissions.matched_guest_id` cascades to `SET NULL`, wiping the guest from all tables.
- **Reset seating plan** — `↺ Reset Seating` button in seating toolbar. Confirmation modal before executing. On confirm, a single bulk `UPDATE` sets `table_id = NULL` and `table_number = ''` for every guest; table definitions are kept.
- **Bulk add tables** — `+ Add Multiple` button in seating toolbar. Modal accepts count and capacity-per-table. Auto-numbers from the lowest available integers, filling gaps and skipping existing table numbers. Shows a live preview of which numbers will be created.

### Changed

- **Seating algorithm reworked** (`seatingSuggestion.js`) — within each side, sub-groups (relationship category × friend subtype) are sorted by size descending and packed greedily as one flat queue. Overflow from a larger sub-group blends with the next sub-group in the same table, keeping seats full. Only the groom/bride boundary remains hard — `slotIdx` advances past partial tables at every side transition so the two sides never share a table.
- **D-day mode shows confirmed guests only** — guest list and table view exclude any guest whose `rsvp_status` is not `"confirmed"`.
- **Seating tab excludes non-confirmed guests** — `assignedAt` and the occupancy counter filter to `rsvp_status === "confirmed"`; declined/pending guests with a lingering `table_id` are invisible in table cards and do not consume capacity for the suggestion.

---

## [2026-06-29] — feat/wedding-wishes-wrapped (Phase 4 complete)

### Added

- **Hall of Silence slide** — up to 3 randomly-sampled guests who left no well-wish are called out with an MC prompt: "give them the mike!" (`SilenceSlide`). Re-shuffled every Generate click for a surprise reveal. Deep crimson Vibrant gradient.
  - `wishesWrapped.js` — `shuffled()` Fisher-Yates helper; `silentGuests` included in the stats return object.
  - 3 new unit tests; 114 total, all passing.
- **Per-slide toggle UI** (`WishesWrappedTab.jsx`) — chip panel listing all applicable slides after generating. Click to enable/disable; All / None shortcuts. Inapplicable slides (no emojis → Emoji Report, no side data → Bride vs Groom, etc.) are hidden rather than greyed out. Selection persisted in `localStorage` and respected by the presentation page.
- **`SLIDE_TOGGLES` constant** — 8 slide definitions each with a `check(data)` predicate.
- **`buildSlides` updated** — accepts `enabledSlides: Set<string>`; empty set = all slides shown (backwards compatible with old sessions).

---

## [2026-06-29] — feat/wedding-wishes-wrapped (Phase 4 MVP)

### Added

- **Wedding Wishes Wrapped** — Spotify Wrapped–style presentation of guest well-wishes, built entirely from the existing `guests.rsvp_message` field with no new DB columns or AI calls.
  - **`src/admin/wishesWrapped.js`** — pure stats engine: total wishes, total words, average length, participation rate with tiered commentary, top-30 word cloud (stop-word filtered), Bride vs Groom head-to-head, personality clusters (essayists / brief / emoji-lovers / shouty), emoji leaderboard, most common opening word, novel-pages equivalent, and up to 5 guest awards (Most Words, Most Enthusiastic, Emoji Champion, Most Poetic, Keeping It Short & Sweet). Fully unit-tested (111 cases on release).
  - **`src/admin/WishesWrappedTab.jsx`** — new "✨ Wishes Wrapped" tab in the Planning mode admin panel. Generate button, stat cards, top-word chips, scrollable message list, and theme toggle (Elegant / Vibrant). "Open Presentation" stores data in `localStorage` and opens the presentation page in a new tab.
  - **`src/wishes-wrapped/WishesWrappedPage.jsx`** — fullscreen presentation at `/wishes-wrapped`. Slides: Title → Participation → Hall of Silence → By the Numbers → Bride vs Groom → Personality Clusters → Word Cloud → Emoji Report → Award slides → Thank You. Keyboard navigation (`←` `→` `Space`), 8-second auto-advance toggle, fullscreen API toggle. Two themes: **Elegant** (dark gold, Cormorant Garamond) and **Vibrant** (bold per-slide gradients, Spotify Wrapped-style).
  - **`src/main.jsx`** — `/wishes-wrapped` route added.
  - **`test-guests-50.csv`** — 50-row confirmed-guest test file (25 bride / 25 groom, diverse well-wishes, ~84% participation) for manual QA.
- **Phase 4 roadmap** — `ROADMAP.md` updated with the full Phase 4 spec.

### Changed

- **Demo data enriched** — four previously empty `rsvp_message` fields in `DEMO_GUESTS` now have realistic well-wish messages so the Wishes Wrapped tab is usable in demo mode without a real Supabase connection.
- **CSV parser extended** — `src/lib/csv.js` now parses `rsvp_status`, `rsvp_message`, and `meal_choice` columns from uploaded CSVs.

---

## [2026-06-29] — chore/vault-script-migration-consolidation

### Added

- **`scripts/setup-vault-secrets.sh`** — reads `SITE_URL` and `RSVP_WEBHOOK_SECRET` from `.env` and either runs the Vault SQL automatically via the Supabase CLI (`supabase db execute`) or prints a pre-filled copy-paste snippet for the SQL Editor. Closes the remaining manual step from issue #17.

### Changed

- **Migration consolidation** — `0006_rsvp_host_notify.sql` and `0007_second_reminder.sql` merged into `0005_email_automation.sql` and deleted. Migration folder is back to a clean 5-file structure (`0001`–`0005`). Existing deployments are unaffected (all SQL uses `CREATE OR REPLACE` / `IF NOT EXISTS`). Supabase CLI users on existing deployments: see USER_GUIDE §1a for the one-time tracking cleanup.
- **`docs/USER_GUIDE.md`** — migration table updated to reflect the consolidated structure; email setup step now references the vault secrets script.

---

## [2026-06-29] — fix/reminders-cron-secret-polish

### Security

- **`CRON_SECRET` now mandatory** — `send-reminders.js` previously only validated the `Authorization` header when `CRON_SECRET` was set; if the env var was missing the endpoint was open to anyone. Now returns 500 if the env var is absent, 401 if the header doesn't match.

### Fixed

- **Reminder double-send bug** — the 30-day nudge used to overwrite `last_reminder_sent_at`, causing it to re-fire every day from day 30 to the wedding. Added `second_reminder_sent_at` column (`0007_second_reminder.sql`) so each send is tracked independently and fires exactly once.
- **"Update RSVP" promoted to button** — was a plain inline text link in confirmation/declined emails; now a proper outlined button matching the email design system.
- **Reminder CTA button padding bumped** — `12px 28px` → `16px 36px`, font size `15px` → `16px`.
- **PayNow page intent documented** — added explicit "intentionally no auth check" comment in `AdminApp.jsx` near the `/#pay` route.

### Changed

- **Reminder emails retargeted to confirmed guests** — previously sent RSVP nudges to pending guests; now sends wedding countdown reminders to confirmed attendees.
  - **90-day email** — warm, excited tone: date, venue name, dress code, link to published wedding page.
  - **30-day email** — full logistics: schedule (tea ceremony, solemnisation, dinner), venue + address + Google Maps link, dress code, getting there directions, "Update RSVP" button.
  - Both emails include the hero image if set.
- **Local test escape hatch** — `?override_days=<n>` query param accepted in non-production so the endpoint can be tested without touching the DB wedding date.

---

## [2026-06-28] — security/restore-admin-pin

### Security

- **Admin PIN re-enabled** — `unlocked` state was initialised to `true`, bypassing the lock screen entirely in production. Restored to `isDemoMode` so the PIN screen shows in production and demo mode stays unlocked.
- **`VITE_HELPER_PASSWORD` removed** — this variable caused the access code to be embedded in the JavaScript bundle in plaintext, readable by anyone who inspected the page source. The auto-sign-in block that read it has been removed. The correct flow is: helper types the access code at the lock screen → Supabase Auth verifies it server-side → session is persisted in the browser.
- **Docs updated** — `docs/USER_GUIDE.md` and `SECURITY.md` now document why `VITE_HELPER_PASSWORD` must never be set and what to do if it was (rotate the Supabase helper password immediately).

---

## [2026-06-28]

### Fixed

- **RSVP name-match false-positive (issue #18)** — Guests whose name was a prefix or substring of another guest's name (e.g. `Wei` / `Wei Ming`, `testing` / `testing 2`, `lee` / `aileen`) were permanently blocked from RSVPing via the no-token flow because `submit_rsvp_by_name` reported "ambiguous". The bug affected both directions of a conflict and had two independent causes: the `LIKE '%…%'` substring clause matching the search term anywhere in a name, and trigram similarity firing for near-identical names (e.g. similarity("testing", "testing 2") = 0.80).

  **Fix:** the no-token RSVP flow in `RsvpPage.jsx` now uses a search-and-select pattern. As the guest types, `find_guest_by_name` returns up to 5 matches (ordered exact-first); the guest clicks their name; the form then submits via `submit_rsvp(token, …)` — the same token-based RPC used by personalised email links. `submit_rsvp_by_name` is no longer called at submission time.

---

## [2026-06-27]

### Added

- Public wedding page at `/wedding/:slug` — hero, love story, Q&A, schedule, Getting There, RSVP CTA
- Wedding Setup modal (onboarding gate + gear icon) — couple names, dates, venue, slug, dress code, hero photo, fun Q&A, publish toggle
- Tea ceremony time field
- Getting There directions section
- Personalised RSVP update links in all guest emails (`SITE_URL` env var)
- Host change-of-mind notifications when a guest flips confirmed ↔ declined (`HOST_EMAIL` env var)
- RSVP form pre-fill from token; token-based submit when link is available
- `.ics` calendar invite attached to RSVP confirmation email
- Vercel Cron 90/30-day reminder emails for pending guests
- Deterministic seating suggestion algorithm (bin-packing, no LLM)
- App personalisation — header title, countdown pill, tab title, CSV filename

### Changed

- Migrations consolidated from 10 files → 5 clean files (PR #25)
- Vercel env var setup automated via `scripts/setup-vercel-env.sh` (PR #26)
- Pluggable email provider — `EMAIL_PROVIDER=gmail` (default) or `EMAIL_PROVIDER=resend`
- README split: detailed setup moved to `docs/USER_GUIDE.md`

### Fixed

- Mobile portrait hero image crop (background-size: contain on tall viewports)
- Solemnisation and meal time picker ranges corrected

---

## [2026-06-25]

### Added

- Resend email integration for RSVP confirmation and declined emails
- Vercel Cron job for 90/30-day pending-guest reminder emails
- RSVP update links and host change-of-mind notification emails

---

## [2026-06-23]

### Added

- Public RSVP form at `/rsvp?token=<uuid>` — meal choice, dietary notes, relationship group, message
- Admin RSVP dashboard — summary stats, filter by status/party, inline edit, resend email button
- Table management + seating plan with drag-and-drop assignment
- Guest relationship taxonomy — two-tier side/category/friend-subtype model

---

## [2026-06-21]

### Added

- PIN-protected admin app at `/`
- Guest list management with CSV import/export
- Real-time attendance marking on wedding day
- Angbao (cash gift) recording with PayNow QR code page
- Draw number assignment
