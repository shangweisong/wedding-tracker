-- ── 0013: merged check-in + angbao dashboard (#151) ───────────────────────────
-- The D-Day Guest List and Angbao Tracker merge into one dashboard, and helpers
-- (reception desk) may now mark whether a guest's angbao was received — the
-- boolean ONLY. The financial boundary from #92/#99 otherwise stands: amounts,
-- totals, notes, submissions and receipts remain couple-only, and the helper's
-- guest reads still route through the get_checkin_guests projection.

-- ── 1. set_guest_angbao_received ──────────────────────────────────────────────
-- Narrow security-definer write in the set_guest_checkin mould (0005). One
-- atomic call:
--   * received=true  → sets angbao_given, auto-checks the guest in (a guest
--     handing over an angbao is by definition present; checked_in_at is only
--     stamped if not already set), and mints the lowest free lucky-draw number
--     (assign_draw_number, 0012).
--   * received=false → clears the flag, zeroes the amount (same semantic as the
--     couple's old toggle — an unmarked angbao has no countable amount), and
--     releases the draw number back to the pool (release_draw_number, 0012).
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

-- ── 2. get_checkin_guests + angbao_given ──────────────────────────────────────
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
