-- Manual RLS verification for role enforcement (#92; config-RPC guards #101;
-- helper guest projection #99; runsheet write guard).
--
-- Migration map (post-consolidation): app_config + is_helper() live in
-- 0001_core.sql; the role-aware RLS policies + check-in/projection RPCs in
-- 0005_roles_security.sql; the gated config-write RPCs in
-- 0003_weddings_page.sql (upsert_wedding_page), 0004_smart_rsvp.sql
-- (upsert_wedding_config), and 0006_planning_features.sql (budget / runsheet /
-- checklist RPCs).
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

  -- Direct guests select is DENIED (#99) — column hiding can't be
  -- done in RLS, so the helper reads the projection RPC instead:
  select count(*) as guests_direct_select from public.guests;      -- expect: 0
  select count(*) as guests_via_projection from public.get_checkin_guests();  -- expect: real count
  -- Per-event meal/dietary rows are couple-only too (0005_roles_security §4) — they join back
  -- to guests by id and would otherwise rebuild the hidden columns:
  select count(*) as event_rsvps_direct_select from public.guest_event_rsvps;  -- expect: 0
  -- (Sanity: the projection's row type has no notes/angbao_amount/rsvp_token/
  -- email/phone columns at all — `select * from public.get_checkin_guests()`
  -- to eyeball the shape. Since #151 it DOES include the angbao_given boolean;
  -- the amount and every other financial column stay excluded.)

  -- Writes must all be refused (0 rows changed, or an RLS error):
  update public.guests set notes = 'hack' where true;              -- expect: 0 rows
  delete from public.tables where true;                            -- expect: 0 rows
  update public.wedding_events set name = 'x' where true;          -- expect: 0 rows

  -- Financial table is fully hidden from the helper:
  select count(*) as submissions_visible_to_helper from public.submissions;  -- expect: 0

  -- Helper cannot re-designate who the helper is (app_config is default-deny):
  update public.app_config set value = 'attacker@evil.com' where key = 'helper_email';  -- expect: 0 rows

  -- The sanctioned helper writes, via security-definer RPCs — check-in (#92)
  -- and the angbao-received boolean (#151, returns draw_number + checked_in_at):
  select public.set_guest_checkin(
    (select id from public.guests order by created_at limit 1), true) as checked_in_at;
  select * from public.set_guest_angbao_received(
    (select id from public.guests order by created_at limit 1), true);

  -- Read-only wishes projection for the D-Day presentation (#149) —
  -- helper-callable; row type is exactly id/name/party/relationship_group/
  -- rsvp_status/rsvp_message (no contact details, notes, or financials):
  select count(*) as wishes_via_projection from public.get_wishes_guests();  -- expect: real count

  -- Config-write RPCs are security definer (bypass RLS) but internally gated
  -- (#101) — each must raise `insufficient_privilege` (42501).
  -- Uncomment ONE at a time: the raised error aborts the transaction, so after
  -- seeing it, re-run the script for the next assertion.
  -- select public.upsert_wedding_config('x','y',null,null,null,null,null);         -- expect: error 42501
  -- select public.upsert_wedding_page('slug-x',null,null,null,null,null,false,null); -- expect: error 42501
  -- select public.upsert_runsheet('[]'::jsonb, false);                              -- expect: error 42501
  -- select public.upsert_checklist_config('[]'::jsonb);                             -- expect: error 42501

  reset role;

  -- ── As ANON (public key only, not signed in) ────────────────────────────────
  set local role anon;
  set local request.jwt.claims = '{"role":"anon"}';

  -- Budget / checklist RPCs must not be executable by anon (the implicit
  -- PUBLIC execute grant is revoked). Uncomment ONE at a time (each aborts the txn):
  -- select public.get_budget_config();                             -- expect: permission denied for function
  -- select public.upsert_budget_config(1, '[]'::jsonb);            -- expect: permission denied for function
  -- select public.get_checklist_config();                          -- expect: permission denied for function
  -- select public.upsert_checklist_config('[]'::jsonb);            -- expect: permission denied for function
  -- select public.get_checkin_guests();                            -- expect: permission denied for function
  -- select * from public.get_wishes_guests();                       -- expect: permission denied for function
  -- select public.upsert_runsheet('[]'::jsonb, false);              -- expect: permission denied for function
  -- The published-runsheet read stays anon-callable BY DESIGN (public page):
  -- select * from public.get_public_runsheet('some-slug');          -- expect: succeeds (0 or 1 rows, no error)
  -- Unpublished runsheets are masked from anon in get_wedding_config (0004_smart_rsvp §8):
  select runsheet as anon_runsheet_when_unpublished
    from public.get_wedding_config();  -- expect: '[]' unless is_runsheet_published = true

  reset role;

  -- ── As the COUPLE ───────────────────────────────────────────────────────────
  set local role authenticated;
  set local request.jwt.claims = '{"role":"authenticated","email":"couple@wedding.local"}';

  select public.is_helper() as expect_false;                       -- expect: f
  select count(*) as guests_visible_to_couple from public.guests;  -- expect: real count (couple keeps select)
  update public.guests set notes = notes where true;               -- expect: succeeds
  select count(*) as submissions_visible_to_couple from public.submissions;  -- expect: real count

  -- Couple passes the config-RPC gates (rolled back with everything else):
  select public.upsert_wedding_config('Test Bride','Test Groom',null,null,null,null,null);  -- expect: succeeds

  reset role;

  -- ── Lockout guard: helper_email accidentally set to the couple's address ─────
  update public.app_config set value = 'couple@wedding.local' where key = 'helper_email';
  set local role authenticated;
  set local request.jwt.claims = '{"role":"authenticated","email":"couple@wedding.local"}';
  select public.is_helper() as still_false_couple_never_locked_out;  -- expect: f
  reset role;

rollback;  -- undo the config edits and every test write above
