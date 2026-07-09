-- Manual RLS verification for role enforcement (#92, migration 0010;
-- config-RPC guards #101, migration 0012).
--
-- There is no automated DB test harness in CI (all Vitest tests are pure unit
-- tests). Run this by hand after applying migrations, in the Supabase SQL editor
-- or `psql` against a local `supabase start` stack. Each block runs inside a
-- transaction that is rolled back, so it mutates nothing permanently.
--
-- The SQL editor connects as `postgres`, which BYPASSES RLS — so we must
-- impersonate the `authenticated` role and inject a JWT `email` claim to exercise
-- the policies the way the app does. Assertions are in the comments; eyeball the
-- results (or wrap in `do $$ ... assert ... $$` if you want it to fail loudly).

-- Seed the config to known values for the duration of these checks. (In a real
-- deployment these rows already exist from the migration / your override.)
begin;
  update public.app_config set value = 'helper@wedding.local' where key = 'helper_email';
  update public.app_config set value = 'couple@wedding.local' where key = 'couple_email';

  -- ── As the HELPER ───────────────────────────────────────────────────────────
  set local role authenticated;
  set local request.jwt.claims = '{"role":"authenticated","email":"helper@wedding.local"}';

  select public.is_helper() as expect_true;                        -- expect: t

  -- Reads allowed:
  select count(*) as guests_readable from public.guests;           -- expect: real count

  -- Writes must all be refused (0 rows changed, or an RLS error):
  update public.guests set notes = 'hack' where true;              -- expect: 0 rows
  delete from public.tables where true;                            -- expect: 0 rows
  update public.wedding_events set name = 'x' where true;          -- expect: 0 rows

  -- Financial table is fully hidden from the helper:
  select count(*) as submissions_visible_to_helper from public.submissions;  -- expect: 0

  -- Helper cannot re-designate who the helper is (app_config is default-deny):
  update public.app_config set value = 'attacker@evil.com' where key = 'helper_email';  -- expect: 0 rows

  -- The ONE allowed helper write, via the security-definer RPC (returns a ts):
  select public.set_guest_checkin(
    (select id from public.guests order by created_at limit 1), true) as checked_in_at;

  -- Config-write RPCs are security definer (bypass RLS) but internally gated
  -- (#101, 0012) — each must raise `insufficient_privilege` (42501).
  -- Uncomment ONE at a time: the raised error aborts the transaction, so after
  -- seeing it, re-run the script for the next assertion.
  -- select public.upsert_wedding_config('x','y',null,null,null,null,null);         -- expect: error 42501
  -- select public.upsert_wedding_page('slug-x',null,null,null,null,null,false,null); -- expect: error 42501

  reset role;

  -- ── As ANON (public key only, not signed in) ────────────────────────────────
  set local role anon;
  set local request.jwt.claims = '{"role":"anon"}';

  -- Budget RPCs must not be executable by anon (0012 revoked the implicit
  -- PUBLIC grant left by 0011). Uncomment ONE at a time (each aborts the txn):
  -- select public.get_budget_config();                             -- expect: permission denied for function
  -- select public.upsert_budget_config(1, '[]'::jsonb);            -- expect: permission denied for function

  reset role;

  -- ── As the COUPLE ───────────────────────────────────────────────────────────
  set local role authenticated;
  set local request.jwt.claims = '{"role":"authenticated","email":"couple@wedding.local"}';

  select public.is_helper() as expect_false;                       -- expect: f
  update public.guests set notes = notes where true;               -- expect: succeeds
  select count(*) as submissions_visible_to_couple from public.submissions;  -- expect: real count

  -- Couple passes the 0012 gates (rolled back with everything else):
  select public.upsert_wedding_config('Test Bride','Test Groom',null,null,null,null,null);  -- expect: succeeds

  reset role;

  -- ── Lockout guard: helper_email accidentally set to the couple's address ─────
  update public.app_config set value = 'couple@wedding.local' where key = 'helper_email';
  set local role authenticated;
  set local request.jwt.claims = '{"role":"authenticated","email":"couple@wedding.local"}';
  select public.is_helper() as still_false_couple_never_locked_out;  -- expect: f
  reset role;

rollback;  -- undo the config edits and every test write above
