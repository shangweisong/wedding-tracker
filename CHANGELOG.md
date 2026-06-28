# Changelog

All notable changes to Wedding Tracker are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
