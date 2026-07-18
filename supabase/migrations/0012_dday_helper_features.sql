-- 0012_dday_helper_features.sql — reusable lucky-draw pool, merged check-in +
-- angbao dashboard, wishes projection
--
-- Consolidated from: 0012_draw_number_release (#150),
--                    0013_merged_checkin_angbao (#151),
--                    0014_wishes_projection (#149)
--
-- The three D-Day/helper features shipped together in July 2026. The #92/#99
-- financial boundary stands throughout: helpers gain the angbao-received
-- BOOLEAN and read-only wishes — amounts, totals, notes, submissions and
-- receipts remain couple-only, and helper guest reads still route through
-- security-definer projections.

-- ── 1. Reusable lucky-draw numbers (#150) ─────────────────────────────────────
-- Before this migration, draw numbers were assign-once off a sequence:
-- unmarking an angbao kept the number forever, so an accidental "Received"
-- permanently consumed a raffle ticket. Now the numbers are a reusable pool:
--   * assign_draw_number hands out the LOWEST free positive integer (numbers
--     stay dense 1..N, matching physical ticket stubs) — still only while the
--     guest's draw_number is null;
--   * release_draw_number returns a guest's number to the pool (called when the
--     angbao is unmarked); a re-mark simply mints again and may legitimately
--     receive the same number back.
--
-- The advisory lock serialises concurrent mints so two helpers confirming at
-- the same instant can't compute the same "lowest free" value; the unique
-- constraint on guests.draw_number (0001_core.sql) remains as a backstop.
-- SECURITY DEFINER so the update works regardless of the caller's grants
-- (helpers have no direct UPDATE on guests since #92).
drop function if exists public.assign_draw_number(uuid);
create function public.assign_draw_number(p_guest_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtext('assign_draw_number'));
  update public.guests
    set draw_number = (
      select min(s.n)
      from generate_series(
        1,
        (select count(*) from public.guests where draw_number is not null) + 1
      ) as s(n)
      where not exists (
        select 1 from public.guests g where g.draw_number = s.n
      )
    )
    where id = p_guest_id and draw_number is null;
  select draw_number into n from public.guests where id = p_guest_id;
  return n;
end;
$$;

revoke all on function public.assign_draw_number(uuid) from public;
grant execute on function public.assign_draw_number(uuid) to authenticated;

-- Re-apply the intent marker from 0005 (dropped with the old function above).
comment on function public.assign_draw_number(uuid) is
  'Intentionally helper-callable: mints the lowest free lucky-draw number during D-Day check-in (0012). Writes no financial data. Do not add an is_helper() gate.';

-- Narrow security-definer write in the set_guest_checkin mould (0005): touches
-- only draw_number, parameterised id, granted to both signed-in roles.
drop function if exists public.release_draw_number(uuid);
create function public.release_draw_number(p_guest_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.guests set draw_number = null where id = p_guest_id;
$$;

revoke all on function public.release_draw_number(uuid) from public;
grant execute on function public.release_draw_number(uuid) to authenticated;

comment on function public.release_draw_number(uuid) is
  'Returns a guest''s lucky-draw number to the reusable pool when their angbao is unmarked (#150). Writes no financial data.';

-- One-time backfill: clear the stale numbers the assign-once era left behind
-- (guests unmarked while keeping their number). Idempotent: re-running matches
-- nothing new.
update public.guests
  set draw_number = null
  where angbao_given = false and draw_number is not null;

-- Retire the sequence — allocation no longer uses draw_number_seq
-- (0001_core.sql still creates it on a fresh reset; harmless, dropped again
-- here).
drop sequence if exists public.draw_number_seq;

-- ── 2. set_guest_angbao_received (#151) ───────────────────────────────────────
-- The D-Day Guest List and Angbao Tracker merge into one dashboard, and
-- helpers (reception desk) may mark whether a guest's angbao was received —
-- the boolean ONLY. One atomic call:
--   * received=true  → sets angbao_given, auto-checks the guest in (a guest
--     handing over an angbao is by definition present; checked_in_at is only
--     stamped if not already set), and mints the lowest free lucky-draw number
--     (assign_draw_number above).
--   * received=false → clears the flag, zeroes the amount (same semantic as the
--     couple's old toggle — an unmarked angbao has no countable amount), and
--     releases the draw number back to the pool (release_draw_number above).
--     The guest STAYS checked in: un-receiving says nothing about presence.
-- Returns the resulting draw_number + checked_in_at so the client can reconcile
-- its optimistic update with server truth.
drop function if exists public.set_guest_angbao_received(uuid, boolean);
create function public.set_guest_angbao_received(p_guest_id uuid, p_received boolean)
returns table (draw_number int, checked_in_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_received then
    update public.guests g
      set angbao_given  = true,
          checked_in    = true,
          checked_in_at = coalesce(g.checked_in_at, now())
      where g.id = p_guest_id;
    perform public.assign_draw_number(p_guest_id);
  else
    update public.guests g
      set angbao_given  = false,
          angbao_amount = 0
      where g.id = p_guest_id;
    perform public.release_draw_number(p_guest_id);
  end if;
  return query
    select g.draw_number, g.checked_in_at
    from public.guests g
    where g.id = p_guest_id;
end;
$$;

revoke all on function public.set_guest_angbao_received(uuid, boolean) from public, anon;
grant execute on function public.set_guest_angbao_received(uuid, boolean) to authenticated;

comment on function public.set_guest_angbao_received(uuid, boolean) is
  'Intentionally helper-callable (#151): toggles the angbao-received boolean, auto-checks-in and mints/releases the lucky-draw number. Touches no financial data beyond zeroing the amount of an UNMARKED angbao — it can never set or reveal an amount. Do not add an is_helper() gate.';

-- ── 3. get_checkin_guests + angbao_given (#151) ───────────────────────────────
-- Append-only recreate (0009/0010/0011 convention): the merged dashboard shows
-- the received boolean to helpers. angbao_amount and every other couple-only
-- column (notes, rsvp_token, contact details, …) stay OUT of the projection.
drop function if exists public.get_checkin_guests();
create function public.get_checkin_guests()
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
  primary_guest_id uuid,
  angbao_given     boolean
)
language sql
stable
security definer
set search_path = public
as $$
  -- Columns are alias-qualified so they can never collide with the
  -- `returns table` output names.
  select g.id, g.name, g.table_number, g.rsvp_status, g.checked_in,
         g.checked_in_at, g.is_vip, g.party, g.draw_number, g.primary_guest_id,
         g.angbao_given
  from public.guests g
  order by g.name asc;
$$;

revoke all on function public.get_checkin_guests() from public, anon;
grant execute on function public.get_checkin_guests() to authenticated;

comment on function public.get_checkin_guests() is
  'Helper-safe guest projection for D-Day (check-in list, tables, lucky draw, angbao-received flag since #151). RLS cannot hide columns, so the helper''s guests reads route through this instead of a direct select (#99). Keep couple-only columns (notes, angbao_amount, rsvp_token, contact details) OUT of this projection.';

-- ── 4. get_wishes_guests (#149) ───────────────────────────────────────────────
-- Wishes Wrapped (and its /wishes-wrapped presentation) is driven by guests'
-- RSVP well-wish messages — columns the helper deliberately cannot read via
-- get_checkin_guests. This dedicated read-only projection exposes EXACTLY the
-- fields the Wrapped charts consume and nothing else: no contact details,
-- notes, tokens, or financial columns. Granted to authenticated only — the
-- messages are shown on a projector at the event, but they are still not for
-- the anonymous public RSVP surface.
drop function if exists public.get_wishes_guests();
create function public.get_wishes_guests()
returns table (
  id                 uuid,
  name               text,
  party              text,
  relationship_group text,
  rsvp_status        text,
  rsvp_message       text
)
language sql
stable
security definer
set search_path = public
as $$
  -- Alias-qualified so columns can never collide with the output names.
  select g.id, g.name, g.party, g.relationship_group, g.rsvp_status, g.rsvp_message
  from public.guests g
  order by g.name asc;
$$;

revoke all on function public.get_wishes_guests() from public, anon;
grant execute on function public.get_wishes_guests() to authenticated;

comment on function public.get_wishes_guests() is
  'Intentionally helper-callable (#149): read-only wishes projection for the D-Day Wishes Wrapped presentation. Exposes name/side/relationship-group/RSVP status/well-wish message only — keep contact details, notes, tokens and financial columns OUT.';
