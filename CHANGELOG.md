# Changelog

All notable changes to Wedding Tracker are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2026-07-14] — fix/131-smart-rsvp-attending-gate

### Added

- **Smart RSVP attending gate (#131)** — in smart (per-event) mode the public form now opens with a single **"Will you be attending?"** yes/no before any event cards. *Yes* reveals the per-event section as before; *No* hides it and submits a decline for every invited event in one go (new `declineAllResponses()` in `src/lib/rsvpFormPayload.js`), so a guest who can't come no longer has to decline each event individually.
- **Audience-targeted events (#131)** — each smart-RSVP event can be restricted to relationship groups (family / friends / colleagues / other) via **Show to** checkboxes on the event editor in Wedding Setup (none checked = shown to everyone). The public form filters event cards by the guest's relationship (`visibleEventsFor()` in new `src/lib/eventVisibility.js`; `audience_groups` diffed in `eventDiff.js`). **This is presentational declutter, not a security boundary** — `relationship_group` is guest-selected on the form; the real per-guest gate remains `guest_event_rsvps.invited`.
- **Migration `0010_event_audiences.sql`** — `wedding_events.audience_groups text[]` with a check constraint limiting values to the four groups; `get_public_events` and `get_guest_by_rsvp_token`'s `invited_events` objects grow an `audience_groups` field (append-only drop-and-recreate, same convention as 0009).

### Fixed

- The audience filter can never blank the form: if filtering would hide *every* invited event (e.g. a stale relationship on the guest row), the full invited list is shown instead.

---

## [2026-07-13] — fix/129-runsheet-time-ampm

### Fixed

- **Runsheet time column shows AM/PM (#129)** — the admin Runsheet tab's Time column was too narrow for the browser's 12-hour time input, clipping the AM/PM suffix. Column widened (90 → 120 px, table min-width adjusted) and the time picker indicator slimmed so the full `hh:mm AM/PM` value is visible. CSS-only.

---

## [2026-07-13] — feat/126-open-rsvp

### Added

- **Open RSVP self-registration (#126)** — an opt-in mode where guests are *not* cross-checked against the guest list: they type their name free-text on the public RSVP form and a guest row is created for them, flagged `self_registered` so the couple can cross-check sign-ups after the deadline. Enabled via a new **Open RSVP** card in Wedding Setup, which requires a **mandatory PIN** (≤ 20 chars, shared on the invitation like a Wi-Fi password) — saving with open mode on and a blank PIN is refused in both the UI and the RPC.
- **Migration `0009_open_rsvp.sql`** — columns `weddings.enable_open_rsvp`, `weddings.rsvp_pin`, `guests.self_registered`; rate-limit table `open_rsvp_pin_attempts` (RLS on, no policies — only the security-definer RPC touches it); anon-callable `register_open_rsvp(p_name, p_pin)` returning `{token}` on success or `{error}` on PIN failure (returned, not raised, so the attempt log commits); couple-only `get_open_rsvp_admin_config()` for PIN readback; `upsert_wedding_config` grows two parameters and `get_wedding_config` exposes `enable_open_rsvp` (never the PIN).

### Security

- The PIN is verified **server-side** and never exposed to anon callers; readback is couple-only (helper excluded). Brute force is bounded by a global sliding window — 20 wrong PINs in 15 minutes locks the open form until attempts age out (an attacker can at most temporarily lock the form, not enumerate a PIN). Matching an existing primary guest by name hands back that guest's token — the same surface the long-standing anon `find_guest_by_name` already exposes *without* a PIN, so open mode is strictly tighter.

---

## [2026-07-13] — fix/122-vendor-modal-alignment

### Fixed

- **Add Vendor pop-up alignment (#122)** — the Status select could drift out of line with the Contract Total input when the contract-total label wrapped; the row is now bottom-aligned so the two fields stay level.

---

## [2026-07-13] — feat/125-rsvp-extra-notice

### Added

- **Extra Notice on the RSVP page (#125)** — the "Note to Guests" card in Wedding Setup gains a general free-text notice alongside the existing Parking and Smoking ones, with identical behaviour: 500-char cap, hidden on the RSVP form when blank, translatable via `content_translations`.
- **Migration `0008_extra_notice.sql`** — `weddings.extra_notice` column; `upsert_wedding_page` grows an 18th parameter and `get_wedding_config` an append-only return column.

---

## [2026-07-13] — feat/124-checklist-notes

### Added

- **Per-task remarks on the planning checklist (#124)** — each checklist task can carry a free-text remark (vendor quotes, contact details, decisions) edited inline in the Checklist tab. Remarks ride along in the checklist CSV export as a new column.

---

## [2026-07-13] — feat/123-budget-total-spending

### Added

- **Total spending in Budget Overview (#123)** — the budget summary card now shows committed spend (the sum of every category's contracted vendor totals) beside the overall budget figure, highlighted in red with a ⚠ when it exceeds the budget.

---

## [2026-07-13] — feat/121-runsheet-gantt

### Added

- **Gantt timeline view for the runsheet (#121)** — the runsheet can be viewed as a horizontal Gantt-style timeline built from each item's start time and duration (new pure modules `src/lib/runsheetTime.js` + `src/lib/runsheetGantt.js`, shared `RunsheetGantt` component). Available in both the admin Runsheet tab and the public `/runsheet/:slug` page, with the view labels translated in all six locales.

---

## [2026-07-13] — fix/120-checklist-due-date-commit

### Fixed

- **Checklist exact-date edits commit on blur/Enter (#120)** — typing an exact due date no longer saves every keystroke (which could persist half-typed dates); the date input now holds a local draft and commits when the field loses focus or Enter is pressed.

---

## [2026-07-12] — chore/consolidate-migrations

### Changed

- **Migration folder consolidated: 19 files → 7** (`0001_core`, `0002_rsvp_seating`,
  `0003_weddings_page`, `0004_smart_rsvp`, `0005_roles_security`,
  `0006_planning_features`, `0007_email_automation` — the last one stays optional).
  Every database object now appears once, in its final form: previously
  `get_wedding_config` was redefined 8 times, `upsert_wedding_page` /
  `get_public_wedding` 5 times each, and the RLS policies for
  `guests`/`tables`/events were rewritten across three files. All files remain
  idempotent and are verified no-ops against an already-migrated database
  (schema-snapshot diff old-19 vs new-7: identical modulo the fix below).
  `app_config` + `is_helper()` moved ahead of the tables (into `0001_core`) so
  every later file can reference them. **Supabase CLI users:** one-time
  `schema_migrations` cleanup required — see USER_GUIDE §1a.
- Docs/refs updated to the new filenames (`USER_GUIDE`, `SECURITY.md`,
  `CLAUDE.md`, `.env.example`, `supabase/tests/role_rls_verification.sql`);
  stale "0001–0005" notes and the already-closed helper column-read gap (#99)
  corrected along the way.

### Security

- **Checklist config RPCs no longer callable with the anon key.**
  `get_checklist_config` / `upsert_checklist_config` (former
  `0014_planning_checklist.sql`) were granted to `authenticated` but never had
  the implicit `PUBLIC` execute grant revoked — the same gap class #101 fixed
  for the budget RPCs — so the public anon key alone could read and overwrite
  the couple's checklist (`is_helper()` is false for an unauthenticated
  caller). The consolidated `0006_planning_features.sql` revokes
  `public`/`anon` and re-grants `authenticated` only. This is the single
  intentional behavioural change of the consolidation.

---

## [2026-07-12] — fix/security-lint-audit

### Security

- **`wedding-photos` bucket writes are now couple-only** (migration
  `0019_wedding_photos_policies.sql`). The 0004 policies allowed *anonymous*
  upload/overwrite/delete on the public bucket with the anon key that ships in
  the JS bundle; writes now require the signed-in couple (`authenticated` +
  `not is_helper()`), public read is unchanged. Remote projects need
  `supabase db push`.
- **`/api/translate` now requires the couple/helper Supabase token** — the same
  gate as `/api/generate-theme` (JWT verified server-side + email allowlist,
  shared via new `api/_lib/requireCoupleAuth.js`) plus a per-minute rate limit,
  so anonymous callers can't burn the DeepL/MyMemory quota. The admin
  auto-translate button sends the session token.
- **Outbound email hardening** (`send-rsvp-email.js`, `send-reminders.js`):
  guest-controlled values (name, meal choice, dietary notes) and all other
  dynamic fields are HTML-escaped before interpolation into email templates
  (new `api/_lib/escapeHtml.js`); subjects are stripped of CR/LF; the webhook /
  cron shared-secret checks use constant-time comparison (new
  `api/_lib/secureCompare.js`); config-error 500s no longer echo internal
  `e.message` (logged server-side instead).
- `scripts/setup-vault-secrets.sh` no longer prints a prefix of
  `RSVP_WEBHOOK_SECRET`; SECURITY.md refreshed (0015 already closed the anon
  wedding-page editor path; documented the by-design RSVP-by-name tradeoff).

### Changed

- **Lint waiver audit**: removed 16 stale `react-hooks/set-state-in-effect`
  disable directives in `WeddingPageTab.jsx` (the rule reports once per effect;
  one live directive remains); `npm run lint` now runs with `--max-warnings 0`
  so stale directives fail CI. All remaining waivers were reviewed and kept
  (the three `exhaustive-deps` ones were verified not to mask stale-closure
  bugs; intent comment added in `BudgetTab.jsx`).

---

## [2026-07-12] — feat/115-checklist-csv-export

### Added

- **Checklist CSV export (#115)** — an **Export CSV** button in the Checklist tab downloads the planning checklist as `<bride>-<groom>-checklist.csv` (columns: Task, Category, Assignee, Due date, Due, Reminders, Done), for sharing progress outside the app or printing. The **Due date** column holds each task's *resolved* date — a pinned exact date wins over the wedding-date offset — so both kinds of task read uniformly; the **Due** column says how it was configured ("Exact date", a preset like "6 months before", or "No specific deadline"). Reminders are listed as their labels ("1 week before due; On due date"). Cells go through the same formula-injection escaping as the guest-list export. Export-only (no import); always exports the full checklist regardless of the category filter. `ASSIGNEES` moved from `ChecklistTab` to `checklistUtils` so the CSV module shares the label source.

---

## [2026-07-12] — feat/114-checklist-category-filter

### Added

- **Checklist category filter (#114)** — a chip row above the checklist tasks filters by category: **All**, one chip per category *currently in use* (derived from the tasks themselves, not the template — categories are free text), and **Uncategorized** when any task has no category. Each chip shows its task count; the row hides itself when no task has a category, and a filter whose category is renamed away falls back to All. The progress bar keeps tracking the whole checklist, not the filtered subset. Purely a UI refinement — the selected chip isn't persisted and `weddings.checklist` is unchanged (no migration).

---

## [2026-07-12] — feat/110-exact-due-dates

### Added

- **Exact due dates for checklist tasks (#110)** — each task's due picker now offers "Exact date…" alongside the relative presets, revealing a date input for tasks with a hard external deadline (e.g. a vendor's booking cutoff). An exact date is **pinned**: unlike offset presets, it deliberately does not move when the wedding date changes (shown with a 📌 cue). One mode per task — picking a preset clears the exact date and vice versa; clearing the date input behaves like "No specific deadline" (also clearing reminders). Reminders now anchor on the task's *resolved* due date, so they work identically for both modes — including exact-date tasks on a wedding whose date isn't set yet. Stored as an optional `dueDate` field in the existing `weddings.checklist` JSONB; **no migration needed** and pre-existing checklists are untouched.

### Changed

- **`api/send-reminders.js`** — a missing wedding date now skips only the guest-reminder job (`guestReason: "wedding date not set"`); the checklist digest still runs, since pinned exact-date tasks are meaningful before the wedding date is configured.

### Notes

- The other two refinements floated in #110 — a category filter and CSV export for the checklist — are split into separate follow-up issues rather than bundled here.

---

## [2026-07-11] — feat/113-checklist-reminders

### Added

- **Checklist reminder notifications (#113)** — checklist tasks can now carry multiple email reminders, each an offset relative to the task's due date (1 month / 2 weeks / 1 week / 3 days / day before / on due date). Configured per task via a bell toggle in the Checklist tab (due-dated tasks only; clearing a task's due date clears its reminders). The daily `send-reminders` cron emails a single digest of all reminders firing that day to `HOST_EMAIL` (skipped with a reason when unset); done tasks never fire, and a missed cron day fires late rather than never.
- **Migration `0018_checklist_reminders.sql`** — new `checklist_reminder_log` table (composite PK `task_id, reminder_id`) recording sent reminders. Written only by the service-role cron: reminder *config* stays in the couple-edited `weddings.checklist` JSONB while sent *state* lives here, so a stale admin tab re-saving the checklist can never wipe sent-state and re-trigger emails. RLS enabled with no policies — invisible to `anon`/`authenticated`.

### Changed

- **`api/send-reminders.js`** — restructured into two isolated jobs (guest RSVP reminders + checklist digest); a failure or skip in one no longer blocks the other, and the >90-days-out early exit now applies only to guest reminders. Response gains `checklistSent` plus per-job `reason`/`error` fields (`sent` unchanged). `?override_days=<n>` (non-prod) now also simulates the checklist clock (today = wedding date − n days).

---

## [2026-07-10] — feature/planning-checklist

### Added

- **Planning checklist** — new ✅ Checklist tab in the admin panel (Planning mode, couple-only, matching Budget's access gating). Auto-seeds a curated 19-task default checklist (venue/vendor booking, attire, legal, guests & invitations, day-of prep) on first open. Each task has a text description, category, assignee (Bride / Groom / Both), and a due-date preset expressed as an offset from the wedding date (e.g. "6 months before") rather than a stored absolute date — deadlines recompute automatically if the wedding date changes. Tasks are sorted by computed due date, overdue tasks are flagged, and a progress bar shows completion (`X of Y tasks done`). Changes auto-save with an 800 ms debounce.
- **Migration `0014_planning_checklist.sql`** — adds `checklist` (JSONB) to the `weddings` singleton; adds couple-only `get_checklist_config` and `upsert_checklist_config` RPCs (same `is_helper()`-gated pattern as the Budget tab's config RPCs — no public page, this is private planning data, not guest-facing).

---

## [2026-07-10] — feature/design-taste-rsvp-wedding

### Added

- **Midnight Bloom presentation theme** — third theme option for the Wishes Wrapped slideshow. Deep midnight navy (`#06080f`) base, blush rose accent (`#f9a8b8`), cool off-white text. Numbers use DM Sans tabular figures for a harder-edged feel; slide transitions use a lateral x-shift crossfade (feels like a page turn) instead of the vertical slide-up used by Elegant and Vibrant. A thin blush rule appears above each slide label as a signature accent. Selectable via the Theme picker in the Wishes Wrapped admin tab.

### Changed

- **RunsheetPage (`/runsheet/:slug`) redesigned** — HTML table replaced with a flex timeline layout (time column / dot-and-vline gutter / content body). Phosphor `ClipboardText` icon replaces the clipboard emoji in empty and not-found states. Font updated to DM Sans; viewport uses `100svh`; mobile breakpoint added for screens narrower than 480 px.
- **WishesWrappedPage visual polish** — all text-character navigation controls (←, →, ▶, ⏸, ⤡, ⤢) replaced with Phosphor icons (`ArrowLeft`, `ArrowRight`, `Play`/`Pause`, `CornersOut`/`CornersIn`); title slide ✨ replaced with `Sparkle` icon. Body overflow/background moved from a `<style>` string into a `useEffect` with cleanup so styles do not bleed to other routes on unmount. Viewport uses `100svh`. `prefers-reduced-motion` guard added for all slide, heart, word-cloud, and progress-bar animations. Decorative `::before` quote mark removed.
- **Admin mobile responsiveness** — tab bar scrolls horizontally on small screens instead of overflowing the viewport. RSVP guest rows wrap actions to a second line on narrow screens. Budget category rows reflow to a two-column grid on mobile with the progress bar spanning full width. Category section meta text wraps below the title row using CSS `order`. Vendor cards wrap actions below the company name on small screens. Stat pills no longer force equal width (fixes label wrapping on the days-to-go pill).

---

## [2026-07-10] — feat/wedding-day-runsheet

### Added

- **Wedding day runsheet** — new 📋 Runsheet tab in the admin panel (visible in both Planning and D-Day modes). Spreadsheet-style inline editor with five columns: Time (free text), Event, Duration, Involved, and Comments. Rows can be reordered by drag-and-drop, deleted, and added with a single click. Changes auto-save with an 800 ms debounce.
- **Shareable read-only runsheet page** (`/runsheet/:slug`) — couple can publish the runsheet via a toggle; a copy-link button generates the URL for coordinators, emcees, and vendors to follow along without logging in.
- **Helper access** — helpers in D-Day mode see the runsheet read-only so they can coordinate on the day.
- **Migration `0013_runsheet.sql`** — adds `runsheet` (JSONB) and `is_runsheet_published` (boolean) columns to the `weddings` singleton; recreates `get_wedding_config` to include them; adds `upsert_runsheet` and `get_public_runsheet` RPCs.

### Fixed

- **Runsheet data visible after mode switch without reload** — `saveRunsheet` now updates the in-memory `wedding` state after a successful DB write, so switching from Planning to D-Day mode no longer shows a blank runsheet.

---

## [2026-07-09] — fix/issue-103-remaining (#104)

### Fixed

- **#4 — Enter key no longer bypasses brute-force lockout** — `pinLocked` is now checked in the `unlock()` guard; pressing Enter in the password input during a 60-second lockout is silently ignored, matching the disabled-button behaviour.
- **#10 — PIN fail counter resets on role switch** — clicking Back now resets `pinFailCount` and `pinLocked`, so failed attempts against the Couple screen no longer count toward the Bridal Team lockout.
- **#8 — Editing a vendor no longer corrupts milestone rows on delete** — `VendorModal` now assigns a stable `_key` (`crypto.randomUUID()`) to every DB-loaded milestone on open, so `MilestoneEditor` never falls back to array-index keys; deleting the middle item no longer mismaps the surviving rows.
- **#13 — RSVP language switcher respects available translations** — `LanguageSwitcher` on `/rsvp` now receives `availableLocales` (derived from `wedding.content_translations`), matching the fix already applied to the Wedding Page; guests no longer see untranslated language options.
- **#14 — Zero budget cap no longer displays as blank** — `CategoryManagerModal` uses `cap ?? ""` instead of `cap || ""`, so a cap of `0` renders as `0` rather than an empty field.
- **#15 — Image size guard in `generate-theme.js` is now reachable** — `MAX_BASE64_CHARS` lowered from 7 000 000 to 3 300 000 (~3.3 MB base64 ≈ 4.4 MB body), just under Vercel's 4.5 MB request limit; the previous value made the guard dead code.
- **#12 — Default helper email rename documented** — `.env.example` now includes a migration note for deployments that used the old default `helpers@wedding.local` (with an `s`) before it was standardised to `helper@wedding.local`.

---

## [2026-07-09] — chore: sync fork with upstream

### Added

- **Budget & Vendors tab (from upstream #96)** — brought into the fork. See the
  `feat/budget-vendors (#96)` entry below for the full feature list.
- Upstream bug fixes **#91, #93, #94, #95** (see the `fix/bugs-91-92-93-94-95 (#97)`
  entry below). #91/#95 the fork had already fixed independently; the merge keeps the
  fork's equivalent implementations.

### Changed

- **Role enforcement stays on the fork's `is_helper()` model.** Upstream #96/#97 shipped a
  parallel role system (`0009_role_rls.sql`, a JWT-claim `public.app_role()`). The fork keeps
  its own email-based `public.is_helper()` (migration `0010_role_enforcement.sql`, #92) as the
  single source of truth, so upstream's `0009_role_rls.sql` was **not** applied and the app no
  longer writes an `app_role` claim into the JWT.
- **Vendors migration renumbered** `0008_vendors_budget.sql` → `0011_vendors_budget.sql` so it
  runs after `0010`. Its vendor RLS and the newly-hardened `weddings` writes are gated on
  `not is_helper()` (couple-only) instead of `app_role() = 'couple'`. `get_wedding_config()` is
  recreated as the **union** of the fork's columns (`hero_focal_point`, `enable_smart_rsvp`,
  `primary_meal_event_id`) and upstream's (`overall_budget_cap`, `budget_categories`).
- **`weddings` writes are now couple-only** — the old `"public"` policy allowed anon/helper
  writes; replaced with open reads + `not is_helper()` writes (parity with upstream's hardening,
  expressed in the fork's role model).

---

## [2026-07-09] — fix/bugs-91-92-93-94-95 (#97)

### Fixed

- **#91 — PIN lockout no longer fires on transient errors** — only wrong-password responses (Supabase status 400 / "invalid credentials") burn an attempt; network/connection errors show a retry prompt without touching the counter.
- **#92 — Role-based access enforced at the DB layer** — _upstream shipped this as `0009_role_rls.sql` (`public.app_role()`, a JWT `user_metadata.app_role` claim). **The fork does not use that migration**; it enforces the same guarantee via its own email-based `public.is_helper()` (`0010_role_enforcement.sql`), so helpers cannot INSERT/DELETE guests or write to `tables`, `weddings`, `submissions`, or `vendors`. See the sync entry above._
- **#93 — Guest-load error no longer blocks unrelated tabs** — Wedding Page, Wishes Wrapped, Budget, and Submissions tabs all render normally when the guest fetch fails, since they load their data independently.
- **#94 — `saveEdit` no longer shows "RSVP updated" on failure** — `updateGuest` now returns `true`/`false`; `saveEdit` keeps the editor open on `false`. Same fix applied to `SeatingTab.generateSuggestion`, which had the same oversight.
- **#95 — `.ics` calendar invite is now RFC 5545-compliant** — adds required `UID` (stable, derived from `wedding.id + date`) and `DTSTAMP` fields; sets `DTEND` to the day after `DTSTART` (exclusive, as the spec requires for all-day events).

---

## [2026-07-09] — feat/budget-vendors (#96)

### Added

- **Budget & Vendors tab** (couple-only) — new admin tab for tracking wedding vendors and spend; hidden from bridal team helpers.
- **Vendor management** — add, edit, and delete vendors per category. Fields: company name, contact person, phone, email, website, notes, contract total, status, payment milestones, and D-Day arrival time.
- **Two vendor statuses** — *Enquiring* (exploring/not committed; contributes $0 to budget totals) and *Booked* (confirmed; `quoted_price` counts toward committed spend).
- **Contract total field** — direct dollar input for the agreed vendor price, separate from milestone payment tracking.
- **Payment milestones** — optional breakdown of how a contract is paid in instalments, each with label, amount, due date, and paid checkbox. Overdue milestones are flagged in red.
- **Fully Paid checkbox** — overrides milestone totals; marks vendor as fully settled (paid = quoted_price) without requiring individual milestone ticks.
- **Budget summary card** — three-segment progress bar (paid · to pay · available) against the overall cap, plus a category planning section showing total allocated across category caps vs the overall budget.
- **13 default budget categories** — Venue, Photography/Videography, Live Band/DJ, Gown Rental, Pre-wedding Shoot, Florist/Decor, Catering, Emcee, Hair & Makeup, Wedding Cake, Invitations/Stationery, Transport, Miscellaneous; couple can rename, reorder, add, or remove.
- **Per-category budget caps** — optional cap per category; bars turn amber >80% and red when exceeded.
- **D-Day arrival time** — per-vendor field for day-of logistics, collapsed by default in the modal to reduce cognitive load.
- **`vendors` table with RLS**, `upsert_budget_config` RPC, and updated `get_wedding_config` returning `overall_budget_cap` and `budget_categories` (`0008_vendors_budget.sql`).
- **239 unit tests** covering `vendorCommitted`, `vendorPaid`, `computeVendorMilestones`, `computeCategoryStats`, `computeOverallStats` (`src/lib/budgetUtils.test.js`).

### Fixed

- Migration constraint order corrected: `DROP CONSTRAINT` now runs before `UPDATE status` so existing rows don't violate the old check on re-run.
- Vendor modal stays open on a failed save — user can retry without losing edits.
- `setSaving` wrapped in `try/finally` in VendorModal and CategoryManagerModal — Save button can never get permanently stuck.
- `totalToPayOut` clamped to `Math.max(0, …)` — prevents negative bar segment when an enquiring vendor has `is_fully_paid` set.
- Polling interval no longer restarts on every AdminApp re-render (`showToast` removed from `loadVendors` dependency array).
- Default category seeding now depends on `isCouple` alongside `wedding?.id` — seeds correctly when role resolves after the wedding row loads.
- Overdue milestone warning suppressed when `is_fully_paid` is true — no more contradictory "Fully paid" + overdue badges on the same card.
- Blank-label category rows show a skip count toast instead of being silently discarded.
- Milestone rows use stable `crypto.randomUUID()` keys on add — deleting a middle row no longer reuses the wrong DOM node.

---

## [2026-07-08] — feat/role-based-access (#89)

### Added

- **Role-based access — Couple vs Bridal Team** — the login screen now has a two-step flow: users pick a role (Couple or Bridal Team) then enter their password. Each role authenticates against its own Supabase Auth account (`VITE_COUPLE_EMAIL` / `VITE_HELPER_EMAIL`).
- **New `VITE_COUPLE_EMAIL` env var** — couple's Supabase Auth account is now explicitly configured. `VITE_HELPER_EMAIL` is repurposed to the bridal team account (previously it was the couple's account, confusingly named).
- **Bridal Team view** — locked to D-Day mode with only guest check-in, angbao recording, lucky draw, and read-only seating chart visible. Hidden: mode toggle, Wedding Setup, Submissions tab, Import/Export/Backup buttons, guest add/edit/delete, guest notes, angbao total stat pill.
- **Sign-out button** — added to the header (non-demo) so either role can hand a device back to the other without a page reload clearing state.
- **Session restore** — on page reload, role is re-derived from `session.user.email` via `getRole()`; unrecognised accounts are signed out (fail-closed).
- **`/api/generate-theme` updated** — auth allowlist now accepts both couple and helper emails (previously only one email was checked).
- **User guide updated** — new auth accounts table in setup section, updated env var docs, revised security section.

---

## [2026-07-08] — fix/language-switcher-hide-empty-locales (#85)

### Fixed

- **Public wedding page** — language switcher now only shows locales where the couple has actually provided translated content (at least one non-empty translatable field or Q&A answer). Previously all six registered locales were always shown, leaving guests able to switch to a language with entirely empty content. English is always shown; the switcher hides entirely when no other locale has content.

---

## [2026-07-08] — fix/ux-audit-high-priority (#84)

### Fixed

**Admin dashboard**
- First guest load failure now shows a distinct ⚠️ error state with a Retry button instead of the empty "No guests found" layout (#1)
- PIN screen locks for 60 seconds after 3 failed attempts and shows a clear rate-limit message (#2)
- Import CSV and Add Guest buttons are now hidden on tabs where they don't apply (Seating, Wedding Page, Wishes Wrapped) (#3)
- RSVP inline-edit Save button shows "Saving…" and disables during the async write to prevent double-submit (#4)
- Delete button has extra left margin separating it from Edit / Link to reduce mis-taps on mobile (#5)
- Unassigned guest pool in Seating now waits for tables to finish loading before rendering, preventing drag to non-existent targets (#6)
- Deleting an empty table now shows an undo toast, consistent with guest deletion (#7)
- Gear icon has `aria-label="Wedding Setup"` for screen readers (#8)
- D-Day filter tabs show live guest counts next to each label, e.g. Pending (42) (#9)
- Wedding date field is now marked required (`*`) with a hint; save is blocked when blank to prevent silent breakage of the calendar invite and countdown (#10)
- Header shows `♡ —` instead of the fallback "Wedding Planner" text while the wedding record is still fetching (#12)
- Add/edit guest modal shows an inline error on the name field when save is attempted with it empty (#13)

**Guest RSVP page**
- Email is no longer required when a guest is declining attendance (#14)
- Generic error no longer leaks raw Supabase `err.message` (table names, Postgres error codes) to guests — all 6 locales updated to a fixed friendly message (#15)
- Token pre-fill loading replaced with a centred spinner so the card doesn't appear blank on slow connections (#16)
- "Add to Calendar" `.ics` download link shown on the confirmation screen for attending guests; built client-side with no external dependency (#17)
- Name-search dropdown is now fully keyboard-navigable (↑ ↓ Enter Escape) with proper ARIA `listbox` / `option` roles (#18)
- `get_wedding_config` fetch failure now surfaces "Could not load event details — please try refreshing" instead of silently rendering blank couple name / date / venue (#19)
- "Closer to bride/groom" field is hidden when the guest is declining (#20)

**Public wedding page**
- Loading state uses a dedicated `.wp-loading` style with a pulsing `✦` and `aria-live="polite"` — visually distinct from the not-found layout (#21)
- Section fade-in animations now respect `prefers-reduced-motion` (WCAG 2.1 §2.3.3) (#22)
- Bride & groom name order unified to bride-first across the hero display and bottom CTA (#23)
- RSVP button shows a hint ("Use the personal link in your invitation for a faster experience") when no token is present in the URL (#24)
- Venue links now render both a Google Maps and an Apple Maps button instead of a single Google-only link (#25)

---

## [2026-07-04] — feat/72-draw-number-search (#72)

### Added

- **Lucky-draw number search (D-Day)** — the admin D-Day search bar now understands lucky-draw numbers. Type `#123` for an exact draw-number lookup, or a bare `#` to list every guest that has a draw number assigned; any other query still does a case-insensitive substring match on name **or** table number.
- Matching logic lives in a small pure module `src/lib/guestSearch.js` (`parseGuestSearch` / `guestMatchesSearch`, unit-tested). It is deliberately separate from `src/lib/nameMatch.js`, which does `pg_trgm` fuzzy matching for the public RSVP RPC — admin search is exact/substring. No database change.

---

## [2026-07-04] — feat/71-section-photos (#71)

### Added

- **Section photo galleries** — couples can insert optional photo bands between the public wedding-page sections. Five slots are available (**After hero photo**, **After Our Story**, **After Fun Q&A**, **After Event details**, **After Plan your journey**); each slot toggles on/off, picks a column count (1–4), and holds up to 12 photo URLs. Edited under **Wedding Setup → Wedding Page**, rendered as a **masonry** layout on `/wedding/:slug` so portrait and landscape shots aren't cropped.
- Slot list + a defensive normalizer are the single source of truth in `src/lib/sectionPhotos.js` (`SECTION_PHOTO_SLOTS`, `normalizeSectionPhotos`, unit-tested) so the admin editor and the public page always agree on shape.

> New migration `0007_section_photos.sql`: adds `weddings.section_photos jsonb` (default `'{}'`) and threads it through `get_wedding_config` / `upsert_wedding_page` / `get_public_wedding`. A `weddings_section_photos_size` check constraint (`pg_column_size < 200000`) is the authoritative server-side cap, since a caller can bypass the client-side limits. Run it in the Supabase SQL editor.

---

## [2026-07-04] — feat/60-ai-theme-image (#60)

### Added

- **AI theme from a photo** — under **Wedding Setup → Wedding Page → Page Theme**, upload a picture (flowers, invitation, venue…) and a vision LLM derives a cohesive color palette, applied to the public wedding page + RSVP form as a new **"Custom"** theme alongside Minimal / Garden / Traditional. The palette is stored in a new `weddings.theme_tokens jsonb` column and applied as CSS-variable overrides; an incomplete/invalid palette falls back to the Minimal preset.
- New serverless endpoint `api/generate-theme.js` + provider layer `api/_lib/themeProvider.js`. Provider is switchable like the email layer via `THEME_AI_PROVIDER` = `anthropic` (default) / `openai` / `nvidia`; the couple's API key is a **server-only** env var (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `NVIDIA_API_KEY`), never `VITE_`-prefixed.
- **NVIDIA model override + 401 diagnosis (#66, #68)** — a follow-up added the `NVIDIA_MODEL` env var to pin the NVIDIA NIM model to route to (NVIDIA hosts many models; a wrong/unentitled one surfaces as a 401/403). It takes precedence over `THEME_AI_MODEL` for the nvidia provider; default `meta/llama-3.2-90b-vision-instruct`.
- Colors only by design: the model output is sanitized to hex-only tokens (`src/lib/themeTokens.js`, unit-tested) on the server and again at render, so it can't inject CSS/markup. The endpoint requires the authenticated helper (Supabase token whose email matches `HELPER_EMAIL`/`VITE_HELPER_EMAIL`), applies a best-effort per-helper rate limit, and passes the image as base64 (no SSRF).

> New migration `0006_ai_theme.sql`: adds `theme_tokens` and threads it through `get_wedding_config` / `upsert_wedding_page` / `get_public_wedding`. Run it in the Supabase SQL editor.

---

## [2026-07-04] — feat/63-multi-language (#63)

### Added

- **More public-page languages** — beyond English + Traditional Chinese, the guest-facing pages now also offer **Simplified Chinese (zh-CN), Bahasa Melayu (ms), Japanese (ja), and Korean (ko)**. The top-right selector switches to a dropdown once there are more than three languages; the choice is remembered per browser and sniffed from the browser language on first visit.
- Full UI-chrome catalogs `src/i18n/locales/{zh-CN,ms,ja,ko}.js`, each mirroring `en.js` key-for-key (enforced by a data-driven `i18n.test.js` that now checks every registered locale). The couple can author content translations per language — the Wedding Page **Translations** editor gained a language picker, and auto-translate targets the selected language.

### Notes

- The i18n engine (`content.js`, `api/translate.js`, `content_translations`) was already locale-generic, so no schema change was needed. Native-speaker proofreading of the new catalogs is welcome.

---

## [2026-07-04] — feat/59-deepl-translation (#59)

### Changed

- **Auto-translate now prefers DeepL Free** for more natural output, falling back to **MyMemory** for languages DeepL doesn't support (e.g. Malay) or when no key is set. The `/api/translate` caller contract is unchanged. Set the **server-only** `DEEPL_API_KEY` to enable DeepL; `MYMEMORY_EMAIL` still raises the MyMemory quota.
- Provider logic extracted to `api/_lib/translate.js` (unit-tested): locale→DeepL code map, batched DeepL requests, MyMemory chunking to respect its ~500-byte per-request cap, an 8s upstream timeout, and blank-on-failure so the couple can fill gaps manually.
- **DeepL Pro endpoint support (#67)** — a follow-up added the `DEEPL_API_URL` env var. Leave it blank for a Free key (default `https://api-free.deepl.com/v2/translate`); set it to `https://api.deepl.com/v2/translate` for a Pro/paid key (whose key does **not** end in `:fx`), otherwise the Free host rejects it with 403. DeepL failures are now surfaced instead of silently blanking.

---

## [2026-07-03] — feat/53-content-translations (#53, Phase 2)

### Added

- **Couple-content translations (中文)** — the couple can now translate their own wedding-page/RSVP text (love story, dress code, venue, getting-there, notices, and each Fun Fact Q&A) into Traditional Chinese under **Wedding Setup → Wedding Page → 中文 translations**. When a guest switches the public page to 中文, translated fields are shown; any blank field falls back to English per-field.
- **Auto-translate** — an "Auto-translate from English" button drafts all fields via a free translation API (MyMemory) through a same-origin `/api/translate` proxy (no API key; optional `MYMEMORY_EMAIL` raises the quota). Drafts are fully editable before saving.
- New `weddings.content_translations jsonb` column (shape `{ "<locale>": { <field>…, fun_qa: [{id,q,answer}] } }`), threaded through `get_wedding_config`, `get_public_wedding`, and `upsert_wedding_page`. A `localizeWedding()` helper applies the overrides on the public pages (unit-tested).

> Migration `0004_weddings.sql` was updated in place (idempotent). Re-run it in the Supabase SQL editor.

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
