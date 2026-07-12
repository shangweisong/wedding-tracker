-- 0005_roles_security.sql — role enforcement at the database layer (#92, #99)
--
-- Consolidated from: 0001_init (§RLS guests), 0002_draw_and_submissions
--                    (submissions/receipts policies), 0003_rsvp_seating
--                    (tables policies), 0009_smart_rsvp (event-table policies),
--                    0010_role_enforcement, 0015_guard_config_rpcs (§4 comments),
--                    0016_helper_guest_projection
--
-- Splits the single `authenticated` Postgres role into two EFFECTIVE roles by
-- JWT email (`app_config` + `is_helper()`, defined in 0001_core.sql):
--   • COUPLE  — full access.
--   • HELPER  — the shared bridal-team account: D-Day check-in only. No insert /
--               update / delete on guests, tables, events, or RSVPs; no access to
--               the financial `submissions` table at all; guest reads go through
--               the `get_checkin_guests()` projection (RLS cannot hide columns).
--
-- FAIL-OPEN by design: if the helper email is not configured, EVERYONE keeps full
-- access — zero lockout risk to the couple. The couple can NEVER be classified as
-- a helper, even under a misconfigured or erroring config row.
--
-- This file is the single home of the RLS policies for guests / tables /
-- wedding_events / guest_event_rsvps / submissions and the receipts bucket —
-- the final state, not the 0001/0003/0009 `using (true)` originals.

-- ── 1. guests ─────────────────────────────────────────────────────────────────
-- SELECT couple-only (#99): the helper's D-Day reads route through the
-- get_checkin_guests() projection below, which omits couple-only columns
-- (notes, angbao_*, rsvp_token, contact details).

-- Remove the legacy wide-open policy if a previous deployment created it.
drop policy if exists "public"          on public.guests;
drop policy if exists "helpers_select"  on public.guests;
drop policy if exists "helpers_insert"  on public.guests;
drop policy if exists "helpers_update"  on public.guests;
drop policy if exists "helpers_delete"  on public.guests;
create policy "helpers_select" on public.guests
  for select to authenticated using (not (select public.is_helper()));
create policy "helpers_insert" on public.guests
  for insert to authenticated with check (not (select public.is_helper()));
create policy "helpers_update" on public.guests
  for update to authenticated using (not (select public.is_helper())) with check (not (select public.is_helper()));
create policy "helpers_delete" on public.guests
  for delete to authenticated using (not (select public.is_helper()));

-- ── 2. tables (seating) — helper is read-only ─────────────────────────────────
drop policy if exists "helpers_select" on public.tables;
drop policy if exists "helpers_insert" on public.tables;
drop policy if exists "helpers_update" on public.tables;
drop policy if exists "helpers_delete" on public.tables;
create policy "helpers_select" on public.tables
  for select to authenticated using (true);
create policy "helpers_insert" on public.tables
  for insert to authenticated with check (not (select public.is_helper()));
create policy "helpers_update" on public.tables
  for update to authenticated using (not (select public.is_helper())) with check (not (select public.is_helper()));
create policy "helpers_delete" on public.tables
  for delete to authenticated using (not (select public.is_helper()));

-- ── 3. wedding_events — helper is read-only (D-Day timeline must render) ──────
drop policy if exists "helpers_select" on public.wedding_events;
drop policy if exists "helpers_insert" on public.wedding_events;
drop policy if exists "helpers_update" on public.wedding_events;
drop policy if exists "helpers_delete" on public.wedding_events;
create policy "helpers_select" on public.wedding_events
  for select to authenticated using (true);
create policy "helpers_insert" on public.wedding_events
  for insert to authenticated with check (not (select public.is_helper()));
create policy "helpers_update" on public.wedding_events
  for update to authenticated using (not (select public.is_helper())) with check (not (select public.is_helper()));
create policy "helpers_delete" on public.wedding_events
  for delete to authenticated using (not (select public.is_helper()));

-- ── 4. guest_event_rsvps — couple-only (reads AND writes) ─────────────────────
-- SELECT couple-only (#99): hiding guests.meal_choice/dietary_notes would be
-- pointless while this table stays helper-readable — its rows carry per-(guest,
-- event) meal_choice/dietary_notes keyed by guest_id, which joins straight back
-- to the projection's `id`. No helper view reads it, and a denied select
-- returns an empty array, so a helper session degrades gracefully.
drop policy if exists "helpers_select" on public.guest_event_rsvps;
drop policy if exists "helpers_insert" on public.guest_event_rsvps;
drop policy if exists "helpers_update" on public.guest_event_rsvps;
drop policy if exists "helpers_delete" on public.guest_event_rsvps;
create policy "helpers_select" on public.guest_event_rsvps
  for select to authenticated using (not (select public.is_helper()));
create policy "helpers_insert" on public.guest_event_rsvps
  for insert to authenticated with check (not (select public.is_helper()));
create policy "helpers_update" on public.guest_event_rsvps
  for update to authenticated using (not (select public.is_helper())) with check (not (select public.is_helper()));
create policy "helpers_delete" on public.guest_event_rsvps
  for delete to authenticated using (not (select public.is_helper()));

-- ── 5. submissions (financial: ang-bao amounts + receipts) ────────────────────
-- Helper gets NO access. Anonymous guests may ONLY insert a fresh, unmatched,
-- pending row — they cannot read it back, edit it, approve it, or see anyone
-- else's. This is the only public table write in the whole app.
drop policy if exists "anon_insert_submission" on public.submissions;
drop policy if exists "helpers_all_submissions" on public.submissions;
create policy "anon_insert_submission" on public.submissions
  for insert to anon
  with check (status = 'pending' and matched_guest_id is null);
create policy "helpers_all_submissions" on public.submissions
  for all to authenticated
  using (not (select public.is_helper())) with check (not (select public.is_helper()));

-- ── 6. receipts storage bucket (private) ──────────────────────────────────────
-- Holds ang-bao receipt images — the same financial confidentiality tier as
-- `submissions`. anon: upload only (no select/list/update/delete). Reads are
-- couple-only (signed URLs), matching the submissions table denial.
drop policy if exists "receipts_anon_insert" on storage.objects;
create policy "receipts_anon_insert" on storage.objects
  for insert to anon
  with check (bucket_id = 'receipts');

drop policy if exists "receipts_auth_select" on storage.objects;
create policy "receipts_auth_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and not (select public.is_helper()));

-- ── 7. set_guest_checkin RPC ──────────────────────────────────────────────────
-- The helper's main D-Day guest write. (The lucky-draw flow also writes one guest
-- column via the pre-existing `assign_draw_number` security-definer RPC.) This one
-- covers check-in. SECURITY DEFINER bypasses the helper's
-- now-denied UPDATE on `guests`, but the body can ONLY touch the two check-in
-- columns — no dynamic SQL, parameterised id, search_path pinned. Returns the
-- server `checked_in_at` so the optimistic client reconciles the exact timestamp.
-- Granted to `authenticated` (both roles) so check-in is a single client code path.
create or replace function public.set_guest_checkin(p_guest_id uuid, p_checked_in boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_at timestamptz;
begin
  update public.guests
     set checked_in    = p_checked_in,
         checked_in_at = case when p_checked_in then now() else null end
   where id = p_guest_id
  returning checked_in_at into v_at;
  return v_at;  -- null when no such guest, or when un-checking
end;
$$;

revoke all on function public.set_guest_checkin(uuid, boolean) from public;
grant execute on function public.set_guest_checkin(uuid, boolean) to authenticated;

-- ── 8. get_checkin_guests — helper-safe D-Day projection (#99) ────────────────
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

-- ── 9. Audit trail: security-definer write RPCs that stay open to the helper ──
-- Reviewed alongside #101. Every other client-callable security-definer write
-- is either gated (upsert_wedding_config / upsert_wedding_page / upsert_runsheet
-- / upsert_budget_config / upsert_checklist_config) or part of the anon RSVP
-- surface by design (submit_rsvp*). These two are the helper's sanctioned D-Day
-- writes and intentionally carry NO is_helper() gate:
comment on function public.set_guest_checkin(uuid, boolean) is
  'Intentionally helper-callable: the helper''s one sanctioned guest write (D-Day check-in). Do not add an is_helper() gate.';
comment on function public.assign_draw_number(uuid) is
  'Intentionally helper-callable: mints the assign-once lucky-draw number during D-Day check-in (0001_core). Writes no financial data. Do not add an is_helper() gate.';
