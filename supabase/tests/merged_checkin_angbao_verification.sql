-- Manual verification for the merged check-in + angbao dashboard (#151;
-- migration 0013). Same convention as draw_number_verification.sql: run by
-- hand (Supabase SQL editor or psql against a local stack) after applying
-- migrations; one rolled-back transaction; completes silently only if every
-- assertion passes. Role-level checks (who may CALL the RPC / projection) live
-- in role_rls_verification.sql — this file asserts the RPC's semantics.

begin;

do $$
declare
  a uuid; b uuid;
  r record;
  first_checkin timestamptz;
begin
  insert into public.guests (name) values ('Merge Test A') returning id into a;
  insert into public.guests (name) values ('Merge Test B') returning id into b;

  -- Clean draw pool so mint results are deterministic within this txn.
  update public.guests set draw_number = null where draw_number is not null;

  -- Receiving an angbao auto-checks the guest in and mints a number.
  select * into r from public.set_guest_angbao_received(a, true);
  assert r.draw_number is not null, 'receive: draw number should be minted';
  assert r.checked_in_at is not null, 'receive: guest should be auto-checked-in';
  assert (select angbao_given from public.guests where id = a), 'receive: flag should be set';
  assert (select checked_in from public.guests where id = a), 'receive: checked_in should be true';

  -- Receiving for an ALREADY checked-in guest keeps the original timestamp.
  perform public.set_guest_checkin(b, true);
  select checked_in_at into strict first_checkin from public.guests where id = b;
  select * into r from public.set_guest_angbao_received(b, true);
  assert r.checked_in_at = first_checkin,
    'receive on checked-in guest: checked_in_at must not be re-stamped';

  -- Clearing zeroes the amount, releases the number, but KEEPS the check-in.
  update public.guests set angbao_amount = 88 where id = a;
  select * into r from public.set_guest_angbao_received(a, false);
  assert r.draw_number is null, 'clear: draw number should be released';
  assert not (select angbao_given from public.guests where id = a), 'clear: flag should be cleared';
  assert (select angbao_amount from public.guests where id = a) = 0, 'clear: amount should be zeroed';
  assert (select checked_in from public.guests where id = a), 'clear: guest must stay checked in';

  -- The released number is reusable (#150 pool) and a re-receive mints again.
  select * into r from public.set_guest_angbao_received(a, true);
  assert r.draw_number is not null, 're-receive: a fresh number should be minted';

  -- Projection shape (#151): angbao_given is exposed, angbao_amount is NOT.
  assert (select to_jsonb(t) ? 'angbao_given' from public.get_checkin_guests() t limit 1),
    'projection: angbao_given must be included';
  assert not (select to_jsonb(t) ? 'angbao_amount' from public.get_checkin_guests() t limit 1),
    'projection: angbao_amount must stay excluded';

  raise notice 'merged_checkin_angbao_verification: all assertions passed';
end;
$$;

rollback;
