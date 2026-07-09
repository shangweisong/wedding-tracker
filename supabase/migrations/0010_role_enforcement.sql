-- Wedding Tracker — role enforcement at the database layer (#92).
--
-- Run AFTER 0001–0009. Idempotent. Splits the single `authenticated` Postgres
-- role into two EFFECTIVE roles by JWT email:
--   • COUPLE  — full access (unchanged).
--   • HELPER  — the shared bridal-team account: D-Day check-in only. No insert /
--               update / delete on guests, tables, events, or RSVPs; no access to
--               the financial `submissions` table at all.
--
-- Before this migration the couple/helper split lived ONLY in the React UI
-- (`role !== "helper"` gates). Both accounts authenticated into the same
-- `authenticated` role with `using (true)` policies, so a helper could bypass the
-- hidden buttons via DevTools / the SDK and read or mutate everything. This moves
-- the split into RLS so it is a real boundary, not a UX affordance.
--
-- FAIL-OPEN by design: if the helper email is not configured, EVERYONE keeps full
-- access — zero lockout risk to the couple. The couple can NEVER be classified as
-- a helper, even under a misconfigured or erroring config row.
--
-- Postgres RLS filters ROWS, not columns, so the helper can still SELECT every
-- column of `guests` (incl. notes / angbao_amount). Hiding those reads behind a
-- projection view/RPC is tracked as a follow-up; #92 closes the WRITE bypass and
-- the financial-table read.

-- ── 1. Locked-down config table ───────────────────────────────────────────────
-- RLS on with NO policy → anon and authenticated are denied entirely. Only the
-- table owner (SQL editor) and `service_role` (which bypass RLS) can write. This
-- is deliberately NOT the anon-writable `weddings` table, so a helper cannot
-- re-designate who the helper is and escalate.
create table if not exists public.app_config (
  key   text primary key,
  value text not null default ''
);

alter table public.app_config enable row level security;
-- (No `create policy` → default-deny for every non-owner role.)

-- Seed defaults idempotently. Deployments override with a service-role UPDATE to
-- their real addresses (keep in sync with VITE_HELPER_EMAIL / VITE_COUPLE_EMAIL):
--   update public.app_config set value = lower('team@example.com')  where key = 'helper_email';
--   update public.app_config set value = lower('bride@example.com') where key = 'couple_email';
insert into public.app_config (key, value) values
  ('helper_email', lower('helper@wedding.local')),
  ('couple_email', lower('couple@wedding.local'))
on conflict (key) do nothing;

-- ── 2. is_helper() ────────────────────────────────────────────────────────────
-- TRUE only when the caller's JWT email equals the configured helper email AND is
-- not the couple. FALSE for the couple, unknown emails, an unconfigured helper, or
-- on ANY internal error (fail-open — never lock the couple out of their own data).
create or replace function public.is_helper()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email  text := lower(auth.email());
  v_helper text;
  v_couple text;
begin
  if v_email is null or v_email = '' then
    return false;
  end if;

  select lower(value) into v_helper from public.app_config where key = 'helper_email';
  select lower(value) into v_couple from public.app_config where key = 'couple_email';

  -- Unconfigured helper → nobody is restricted (fail-open, full access for all).
  if v_helper is null or v_helper = '' then
    return false;
  end if;

  -- The couple can NEVER be treated as a helper, even under a bad config row.
  if v_couple is not null and v_couple <> '' and v_email = v_couple then
    return false;
  end if;

  return v_email = v_helper;
exception
  when others then
    -- Fail OPEN (never block the couple), but surface it: a permission/ownership
    -- regression that silently degraded the whole split to "everyone is couple"
    -- should at least show up in the Postgres logs.
    raise warning 'is_helper() failed open: %', sqlerrm;
    return false;
end;
$$;

revoke all on function public.is_helper() from public;
-- RLS policy expressions are evaluated as the querying role, so it needs EXECUTE.
grant execute on function public.is_helper() to authenticated;

-- ── 3. RLS rewrite: reads stay open, writes become couple-only ─────────────────
-- Pattern per table: SELECT to authenticated using (true); INSERT/UPDATE/DELETE
-- gated on `not (select public.is_helper())`. Policy names are preserved from 0001/0003/
-- 0009 so the drop-if-exists blocks fully supersede the originals.

-- guests
drop policy if exists "helpers_select" on public.guests;
drop policy if exists "helpers_insert" on public.guests;
drop policy if exists "helpers_update" on public.guests;
drop policy if exists "helpers_delete" on public.guests;
create policy "helpers_select" on public.guests
  for select to authenticated using (true);
create policy "helpers_insert" on public.guests
  for insert to authenticated with check (not (select public.is_helper()));
create policy "helpers_update" on public.guests
  for update to authenticated using (not (select public.is_helper())) with check (not (select public.is_helper()));
create policy "helpers_delete" on public.guests
  for delete to authenticated using (not (select public.is_helper()));

-- tables (seating) — helper is read-only
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

-- wedding_events — helper is read-only (needed so the D-Day timeline renders)
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

-- guest_event_rsvps — helper is read-only
drop policy if exists "helpers_select" on public.guest_event_rsvps;
drop policy if exists "helpers_insert" on public.guest_event_rsvps;
drop policy if exists "helpers_update" on public.guest_event_rsvps;
drop policy if exists "helpers_delete" on public.guest_event_rsvps;
create policy "helpers_select" on public.guest_event_rsvps
  for select to authenticated using (true);
create policy "helpers_insert" on public.guest_event_rsvps
  for insert to authenticated with check (not (select public.is_helper()));
create policy "helpers_update" on public.guest_event_rsvps
  for update to authenticated using (not (select public.is_helper())) with check (not (select public.is_helper()));
create policy "helpers_delete" on public.guest_event_rsvps
  for delete to authenticated using (not (select public.is_helper()));

-- submissions (financial: ang-bao amounts + receipts) — helper gets NO access.
-- The anon INSERT policy (public RSVP form) is unchanged.
drop policy if exists "anon_insert_submission" on public.submissions;
drop policy if exists "helpers_all_submissions" on public.submissions;
create policy "anon_insert_submission" on public.submissions
  for insert to anon
  with check (status = 'pending' and matched_guest_id is null);
create policy "helpers_all_submissions" on public.submissions
  for all to authenticated
  using (not (select public.is_helper())) with check (not (select public.is_helper()));

-- receipts storage bucket (private): holds ang-bao receipt images — the same
-- financial confidentiality tier as `submissions`. 0002 granted SELECT to every
-- `authenticated` user; without this the helper could still `.list()`/`.download()`
-- raw receipts via the Storage API even though the `submissions` table is now
-- denied to them. Re-scope the read to non-helpers (the couple) to match.
drop policy if exists "receipts_auth_select" on storage.objects;
create policy "receipts_auth_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and not (select public.is_helper()));

-- ── 4. set_guest_checkin RPC ──────────────────────────────────────────────────
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
