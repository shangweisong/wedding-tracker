# Changelog

All notable changes to Wedding Tracker are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2026-07-03] — feat/53-i18n-public-pages (#53, Phase 1)

### Added

- **Multi-language public pages (English / 中文)** — the guest-facing Wedding page and RSVP form can now switch between English and Traditional Chinese via an `EN | 中文` toggle (top-right). The choice is remembered in `localStorage` and falls back to the browser language.
- Lightweight in-app i18n (`src/i18n/`) — a message-catalog + `t()` helper + React context, no new dependency. ~95 UI-chrome strings externalised across `WeddingPage.jsx` and `RsvpPage.jsx`; dates/times now localise via `Intl.DateTimeFormat`. A unit test enforces that the `en` and `zh-TW` catalogs stay key-for-key in sync.

### Notes

- **Phase 1 = UI chrome only.** App-owned labels are translated; the couple's own content (love story, venue, Q&A answers, notices) stays as entered. RSVP dropdown **labels** translate while the stored **values** are unchanged. Admin UI and emails remain English.
- Phase 2 (couple-content translations with an auto-translate draft) is planned as a follow-up.

---

## [2026-07-03] — feat/38-plus-x-guests (#38)

### Added

- **RSVP form — bring up to 6 additional guests** — attending guests pick how many others they're bringing (0–6) and name each one. A disclaimer reminds them to inform the couple of the addition.
- Each additional guest becomes its own **child guest row** (`guests.primary_guest_id`), so they're independently seatable and checkable-in. Revisiting an RSVP link repopulates the names; changing the list preserves the seats/check-ins of unchanged names (reconcile-by-name in `submit_rsvp`).

### Changed

- **Replaces the single `plus_one_name` field.** Existing values are migrated into child rows and the legacy field is cleared. The admin RSVP tab labels child rows ("↳ additional guest of …") and shows a "+N guests" tag on primaries; responder stats count primaries while **headcount counts every confirmed body**. Seating export drops the now-redundant `plus_one` column. Name search hides child rows (they don't self-RSVP).

> Migration `0003_rsvp_seating.sql` was updated in place (idempotent): adds `primary_guest_id` + backfills existing plus-ones into child rows. Re-run it in the Supabase SQL editor.

---

## [2026-07-03] — feat/40-note-to-guests (#40)

### Added

- **RSVP form — "Would you like to give a speech?"** — a three-state (unanswered / Yes / No) question shown to attending guests. Stored on `guests.wants_to_speak`; the admin RSVP tab shows a 🎤 marker for volunteers and lets helpers edit the answer.
- **RSVP form — Note to Guests notices** — couples can set optional **Parking** and **Smoking** notices under **Wedding Setup → Wedding Page → Note to Guests**; each appears on the RSVP form (when attending) only if filled. Stored on new `weddings.smoking_notice` / `weddings.parking_notice` columns.

### Changed

- `submit_rsvp` and `get_guest_by_rsvp_token` RPCs carry `wants_to_speak`; `get_wedding_config` / `upsert_wedding_page` carry the two notice fields.

> Migrations `0003_rsvp_seating.sql` and `0004_weddings.sql` were updated in place (idempotent). Re-run both in the Supabase SQL editor.

---

## [2026-07-02] — feat/42-fun-rsvp-options (#42)

### Added

- **RSVP form — opt-in playful dropdown options** — couples can enable two lighthearted choices on the public RSVP form: "It's complicated 😅" under *How do you know the couple?* and "😏 It's a secret" under *Which kind of friend?*. Off by default; toggled from **Wedding Setup → Wedding Page** ("Fun RSVP options").
- New `weddings.enable_fun_rsvp_options` boolean flag, threaded through `get_wedding_config` (read by the public RSVP page) and `upsert_wedding_page` (admin save).

### Changed

- `guests.relationship_group` / `friend_subgroup` CHECK constraints and the `submit_rsvp` / `submit_rsvp_by_name` RPC allow-lists now accept `complicated` / `secret`. The admin RSVP tab shows these options unconditionally so helpers can view/set stored values; the public form shows them only when the couple opts in.

> Migrations `0003_rsvp_seating.sql` and `0004_weddings.sql` were updated in place (idempotent — `create or replace`, `add column if not exists`, and explicit `drop/add constraint`). Re-run both in the Supabase SQL editor.

---

## [2026-07-02] — feat/39-guest-import-template (#39)

### Added

- **Guest import — downloadable template** — the Import Guest List dialog now has a **Download template** button that saves a ready-to-fill `guest-import-template.csv` (the documented `name, table, notes, vip, party` columns plus two example rows), so users know the expected format before uploading. Built with the existing injection-safe `csvCell` helper; a Vitest round-trip test asserts the template always re-parses cleanly through `parseCSV`, keeping template and importer in sync.

> Note: issue #39 requested an *xlsx* template, but the importer is CSV-only (no xlsx dependency). Delivered as a CSV template matching the actual importer rather than adding a heavyweight spreadsheet library.

---

## [2026-07-01] — feat/52-editable-fun-questions (PR #54)

### Added

- **Fun Facts — editable question labels** — each question in the Fun Facts About You section is now an editable input; couples can rename any of the 8 default questions to suit their story.
- **Fun Facts — delete questions** — a ✕ button on each row lets couples remove questions they don't want to show guests.
- **Fun Facts — add custom questions** — a "+ Add question" button at the bottom lets couples create entirely new questions beyond the defaults.
- **Fun Facts — resizable answer field** — the answer input is now a textarea (`min-height: 72px`, vertically resizable) so long answers are fully visible while editing.

### Changed

- `fun_qa` storage shape updated from `[{ id, answer }]` to `[{ id, q, answer }]`; existing saved data is read with a backward-compatible fallback.
- Public wedding page Q&A now renders in the couple's chosen order rather than the hardcoded default order.

---

## [2026-06-29] — improve/wishes-wrapped-ui

### Changed

- **Wishes Wrapped — segmented progress bar** — thin bar across the top of the presentation with one segment per slide; active segment fills over 8 s during autoplay, dimly lit at rest, solid for past slides.
- **Wishes Wrapped — staggered word cloud** — each word cascades in with a 40 ms delay per index (`animation-delay: calc(var(--i) * 40ms)`) instead of all appearing simultaneously.
- **Wishes Wrapped — exit animation** — 150 ms fade-up-out before each incoming slide's fade-in; all navigation paths (buttons, keyboard, autoplay) route through `navigate()`.
- **Wishes Wrapped — tap-to-advance** — click left half of slide = previous, right half = next; controls bar excluded.
- **Wishes Wrapped — Vibrant font consistency** — DM Sans extended to `.ww-award-name`, `.ww-award-quote`, `.ww-word`, `.ww-thanks-names`; previously only titles/numbers were overridden.
- **Wishes Wrapped — Thank You closing line** — "Thank you for being part of our story" added below the date in the final slide.
- **Wishes Wrapped — Hall of Silence muted cards** — softer background, reduced border, muted text colour to differentiate "gentle roast" from celebration stats.
- **RSVP page — confirmation screen** — redesigned with pulsing `♡`, large 36 px heading, guest name in italic gold, and a date + venue keepsake card for attending guests.
- **RSVP page — attending buttons** — Yes now highlights gold (warm/celebratory); No highlights muted charcoal (sympathetic, not alarming).
- **RSVP page — meal/dietary expand animation** — smooth CSS grid `0fr → 1fr` transition replaces hard snap.
- **RSVP page — card entrance** — 0.45 s fade-up animation on load.
- **RSVP page — logo** — 32 px, pulsing heart span, tighter eyebrow tracking.
- **RSVP page — submit button** — pill shape (`border-radius: 50 px`) matching the wedding page CTA; sticky on mobile with gradient fade.
- **RSVP page — theme card backgrounds** — Garden card tinted `#f3f8f0`, Chinese card tinted `#fff8f8`.
- **Wedding page — scroll entrance animations** — `IntersectionObserver` fades each `.wp-section` in as it enters the viewport.
- **Wedding page — Big Day timeline** — vertical timeline with circular icon nodes and gold connector line replaces the flat event card list.
- **Wedding page — closing CTA panel** — dark gradient panel (matching hero mood) with white title and gold pill button; Garden/Chinese variants use matching dark-green and dark-crimson gradients.
- **Wedding page — Q&A cards** — larger answer text (`clamp(18–22 px)`), decorative `"` quote mark via `::before`, bolder question label.
- **Wedding page — hero invite tag** — personalised with couple names when available.
- **Wedding page — hero radial glow** — subtle gold/green/amber radial gradient behind couple names for depth.
- **Wedding page — Getting There** — paragraphs split on `\n\n` with auto-detected transport icons (🚇 MRT, 🚗 car, 🚶 walking, 📍 default).

---

## [2026-06-29] — fix/wishes-wrapped-confirmed-only (PR #41)

### Fixed

- **Wishes Wrapped scoped to confirmed guests** — declined and pending guests were included in `totalGuests`, participation rate, side breakdowns, and Hall of Silence callouts. `WishesWrappedTab` now filters to `rsvp_status === 'confirmed'` before passing guests to `computeWrapped`.
- **Hall of Silence spares family** — guests with `relationship_group === 'family'` are excluded from the silent-guest pool so relatives aren't publicly called out for skipping a well-wish.

---

## [2026-06-29] — feat/wedding-page-templates

### Added

- **Garden theme** — forest-green hero gradient, Libre Baskerville headings, sage-green accents, pale sage page background (`#f1f7ed`). Twelve scattered SVG leaf shapes frame the left and right page margins at low opacity.
- **Traditional Chinese theme** — deep crimson hero gradient, gold accents on red, warm blush page background (`#fff5f5`). Repeating 喜 watermark pattern (180×180px SVG tile, two staggered gold characters per tile) on both the wedding page and RSVP page background.
- **Theme picker** in the Wedding Page admin tab — three cards with gradient swatches (Minimal / Garden / Traditional). Selection saved to `weddings.theme` via `upsert_wedding_page`.
- **`theme` column** added to the `weddings` table (default `'minimal'`); `get_wedding_config`, `upsert_wedding_page`, and `get_public_wedding` RPCs updated to carry the field. Themes affect only `/wedding/:slug` and `/rsvp` — admin UI untouched.
- **Libre Baskerville + Nunito** added to the shared Google Fonts import in `theme.js` for the Garden theme.

### Changed

- `0006_themes.sql` merged into `0004_weddings.sql` (natural home for all weddings DDL); migrations folder stays at 5 files. `USER_GUIDE §1a` reconcile table updated.

---

## [2026-06-29] — docs/readme-hero-gif

### Added

- **README hero GIF** — `docs/demo.gif` placed immediately after the title, covering the Planning/D-Day toggle → RSVP submission → seating auto-suggest → lock a table flow.
- **README Screenshots section** — `## Screenshots` added after Features with per-section PNGs (`docs/screenshot-*.png`) stored in `docs/`.

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
