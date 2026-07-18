-- Manual verification for the D-Day angbao features (migration 0012):
-- reusable lucky-draw numbers (#150) and the merged check-in + angbao RPC
-- semantics (#151).
--
-- Run by hand after applying migrations, in the Supabase SQL editor or `psql`
-- against a local `supabase start` stack (same convention as
-- role_rls_verification.sql — there is no automated DB harness in CI). The
-- whole script runs in one rolled-back transaction and asserts loudly: if it
-- completes with no error, every check passed. Role-level checks (who may CALL
-- these RPCs / projections) live in role_rls_verification.sql — this file
-- asserts semantics only.

begin;

-- ── 1. Lucky-draw pool: dense allocation, release, reuse (#150) ───────────────
do $$
declare
  a uuid; b uuid; c uuid;
  n int;
begin
  insert into public.guests (name) values ('Draw Test A') returning id into a;
  insert into public.guests (name) values ('Draw Test B') returning id into b;
  insert into public.guests (name) values ('Draw Test C') returning id into c;

  -- Work on a clean pool so lowest-free is deterministic within this txn.
  update public.guests set draw_number = null where draw_number is not null;

  -- Dense allocation: 1, 2, 3.
  n := public.assign_draw_number(a);
  assert n = 1, format('first mint: expected 1, got %s', n);
  n := public.assign_draw_number(b);
  assert n = 2, format('second mint: expected 2, got %s', n);
  n := public.assign_draw_number(c);
  assert n = 3, format('third mint: expected 3, got %s', n);

  -- Assign-once while held: re-minting B returns its existing number.
  n := public.assign_draw_number(b);
  assert n = 2, format('re-mint while held: expected 2, got %s', n);

  -- Release B: number cleared...
  perform public.release_draw_number(b);
  select draw_number into n from public.guests where id = b;
  assert n is null, format('release: expected null, got %s', n);

  -- ...and 2 is the lowest free number, so the next mint reuses it.
  n := public.assign_draw_number(b);
  assert n = 2, format('reuse after release: expected 2, got %s', n);

  -- Backfill semantics (0012 §1): an unmarked guest with a stale number is
  -- cleared, a marked guest keeps theirs.
  update public.guests set angbao_given = false where id = b;   -- stale: has #2, not given
  update public.guests set angbao_given = true  where id = c;   -- legit: has #3, given
  update public.guests
    set draw_number = null
    where angbao_given = false and draw_number is not null;
  select draw_number into n from public.guests where id = b;
  assert n is null, 'backfill: stale number should be cleared';
  select draw_number into n from public.guests where id = c;
  assert n = 3, 'backfill: held number of a given angbao must survive';

  raise notice 'draw-number pool: all assertions passed';
end;
$$;

-- ── 2. Merged check-in + angbao RPC semantics (#151) ──────────────────────────
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

  -- The released number is reusable (§1 pool) and a re-receive mints again.
  select * into r from public.set_guest_angbao_received(a, true);
  assert r.draw_number is not null, 're-receive: a fresh number should be minted';

  -- Projection shape (#151): angbao_given is exposed, angbao_amount is NOT.
  assert (select to_jsonb(t) ? 'angbao_given' from public.get_checkin_guests() t limit 1),
    'projection: angbao_given must be included';
  assert not (select to_jsonb(t) ? 'angbao_amount' from public.get_checkin_guests() t limit 1),
    'projection: angbao_amount must stay excluded';

  raise notice 'merged check-in + angbao: all assertions passed';
end;
$$;

rollback;  -- scratch guests and every change above are undone
