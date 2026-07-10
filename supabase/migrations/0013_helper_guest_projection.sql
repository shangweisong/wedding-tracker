-- 0013 — Hide couple-only guest columns from the helper (#99).
--
-- RLS filters rows, not columns: with `helpers_select ... using (true)` (0010)
-- the helper could `select *` from public.guests via the SDK/DevTools and read
-- couple-only fields the UI hides — private `notes`, the financial
-- `angbao_amount`/`angbao_given`, guest contact details (`email`, `phone`),
-- and `rsvp_token` (which would let a helper open any guest's personalised
-- RSVP link). 0010's header tracked this as a known follow-up.
--
-- Fix, in two parts:
--   1. `get_checkin_guests()` — a security-definer projection returning only
--      the columns the helper's D-Day views actually render.
--   2. Tighten the guests select policy to couple-only; the helper's reads all
--      go through the projection from now on.
--
-- Lockout safety: public.is_helper() (0010) FAILS OPEN (returns false on any
-- internal error), so `not is_helper()` degrades to "everyone keeps select" —
-- the couple can never be locked out. For a helper, PostgREST returns an empty
-- array (not an error) on a denied select, so a stale frontend degrades to an
-- empty list rather than a crash.

-- ── 1. D-Day projection RPC ────────────────────────────────────────────────────
-- Column set = what the helper UI consumes (guest cards, tables view, search):
--   • rsvp_status is REQUIRED — the D-Day list filters on `confirmed`.
--   • primary_guest_id is REQUIRED — the header stats count primaries via
--     `!g.primary_guest_id`; without it every plus-one would inflate the
--     helper's headcounts. It is only the parent-row FK, not sensitive.
--   • draw_number stays: the lucky draw is a helper-run D-Day activity
--     (assign_draw_number is helper-callable) and `#123` search needs it.
--   • Everything else (notes, angbao_*, rsvp_token, email, phone, dietary,
--     meal/plus-one/grouping fields, timestamps) is omitted.
-- All rows are returned (not just confirmed) so the "Arrived x/y" stat keeps
-- its meaning; filtering stays client-side. Ordered by name for parity with
-- the couple's `sb.select("guests")`.
create or replace function public.get_checkin_guests()
returns table (
  id               uuid,
  name             text,
  table_number     text,
  rsvp_status      text,
  checked_in       boolean,
  checked_in_at    timestamptz,
  is_vip           boolean,
  party            text,
  draw_number      int,
  primary_guest_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  -- Columns are alias-qualified so they can never collide with the
  -- `returns table` output names.
  select g.id, g.name, g.table_number, g.rsvp_status, g.checked_in,
         g.checked_in_at, g.is_vip, g.party, g.draw_number, g.primary_guest_id
  from public.guests g
  order by g.name asc;
$$;

revoke all on function public.get_checkin_guests() from public, anon;
grant execute on function public.get_checkin_guests() to authenticated;

comment on function public.get_checkin_guests() is
  'Helper-safe guest projection for D-Day (check-in list, tables, lucky draw). RLS cannot hide columns, so the helper''s guests reads route through this instead of a direct select (#99). Keep couple-only columns (notes, angbao_*, rsvp_token, contact details) OUT of this projection.';

-- ── 2. Guests select policy → couple-only ─────────────────────────────────────
-- Same name/style as 0010; the helper's list now comes from the projection.
drop policy if exists "helpers_select" on public.guests;
create policy "helpers_select" on public.guests
  for select to authenticated using (not (select public.is_helper()));

-- ── 3. guest_event_rsvps select policy → couple-only ──────────────────────────
-- Hiding guests.meal_choice/dietary_notes is pointless while this table stays
-- helper-readable: its rows carry per-(guest, event) meal_choice/dietary_notes
-- keyed by guest_id, which joins straight back to the projection's `id`. No
-- helper view reads it — it only feeds the couple's RSVP targeting grid — and
-- a denied select returns an empty array, so a helper session degrades
-- gracefully. Writes were already couple-only (0010).
drop policy if exists "helpers_select" on public.guest_event_rsvps;
create policy "helpers_select" on public.guest_event_rsvps
  for select to authenticated using (not (select public.is_helper()));
