-- 0006_planning_features.sql — vendors/budget, runsheet, planning checklist
--
-- Consolidated from: 0011_vendors_budget, 0013_runsheet, 0014_planning_checklist,
--                    0015_guard_config_rpcs (§3 budget grants),
--                    0017_guard_runsheet (§1 upsert_runsheet + §3 comment),
--                    0018_checklist_reminders,
--                    0013_floorplans (§2 upsert_floorplans; the weddings
--                    column lives in 0003_weddings_page.sql)
--
-- The weddings columns these features live on (overall_budget_cap,
-- budget_categories, runsheet, is_runsheet_published, checklist) are created
-- with the table in 0003_weddings_page.sql; this file holds the vendors table
-- and the feature RPCs at their final, couple-gated bodies.
--
-- One intentional hardening over the original 0014: the checklist RPCs now get
-- the same `revoke ... from public, anon` the budget RPCs received in 0015 —
-- 0014 only ran `grant ... to authenticated`, which left the default PUBLIC
-- execute grant in place, so the anon key alone could read AND overwrite the
-- checklist (is_helper() is false for an unauthenticated caller). Same hole
-- class as #101.

-- ── 1. vendors table ──────────────────────────────────────────────────────────
-- Statuses: 'enquiring' (exploring/quoted, not committed) | 'booked' (committed).
-- is_fully_paid overrides milestone totals when the vendor is fully settled.

create table if not exists public.vendors (
  id            uuid        primary key default gen_random_uuid(),
  category_key  text        not null default ''   check (char_length(category_key) <= 80),
  company_name  text        not null               check (char_length(company_name) between 1 and 200),
  contact_name  text        not null default ''   check (char_length(contact_name) <= 120),
  phone         text        not null default ''   check (char_length(phone) <= 30),
  email         text        not null default ''   check (char_length(email) <= 200),
  website       text        not null default ''   check (char_length(website) <= 500),
  notes         text        not null default ''   check (char_length(notes) <= 2000),
  status        text        not null default 'enquiring'
                            check (status in ('enquiring', 'booked')),
  quoted_price  numeric     not null default 0    check (quoted_price >= 0 and quoted_price <= 100000000),
  is_fully_paid boolean     not null default false,
  milestones    jsonb       not null default '[]'::jsonb,
  arrival_time  time,
  key_dates     jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vendors_milestones_size'
  ) then
    alter table public.vendors
      add constraint vendors_milestones_size
      check (pg_column_size(milestones) < 100000);
  end if;
end $$;

-- Idempotent column/constraint fixes (for DBs where the table already existed):

-- quoted_price (added after initial deploy)
alter table public.vendors
  add column if not exists quoted_price numeric not null default 0
    check (quoted_price >= 0 and quoted_price <= 100000000);

-- is_fully_paid (added when Paid In Full status was replaced by this checkbox)
alter table public.vendors
  add column if not exists is_fully_paid boolean not null default false;

-- Migrate old status values and replace the check constraint.
-- DROP first so the UPDATE can write 'enquiring' without violating the old constraint.
alter table public.vendors drop constraint if exists vendors_status_check;
update public.vendors set status = 'enquiring' where status in ('enquired', 'quoted', 'paid');
alter table public.vendors
  add constraint vendors_status_check check (status in ('enquiring', 'booked'));

-- Reuse the set_updated_at trigger function defined in 0001_core.sql.
drop trigger if exists vendors_set_updated_at on public.vendors;
create trigger vendors_set_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

-- ── 2. RLS for vendors ────────────────────────────────────────────────────────
-- Vendor/budget data is financial — the same confidentiality tier as `submissions`.
-- Reads stay open to any authenticated user (RLS filters rows, not columns, and the
-- Budget tab is UI-gated to the couple), but INSERT/UPDATE/DELETE are couple-only
-- via public.is_helper() (0001_core.sql). Anon has no policy at all.

alter table public.vendors enable row level security;

drop policy if exists "vendors_select" on public.vendors;
create policy "vendors_select" on public.vendors
  for select to authenticated using (true);

drop policy if exists "vendors_insert" on public.vendors;
create policy "vendors_insert" on public.vendors
  for insert to authenticated with check (not (select public.is_helper()));

drop policy if exists "vendors_update" on public.vendors;
create policy "vendors_update" on public.vendors
  for update to authenticated
  using (not (select public.is_helper())) with check (not (select public.is_helper()));

drop policy if exists "vendors_delete" on public.vendors;
create policy "vendors_delete" on public.vendors
  for delete to authenticated using (not (select public.is_helper()));

-- ── 3. get_budget_config — authenticated, couple-only budget read ─────────────
-- The admin Budget tab reads the couple's cap + category allocations here instead
-- of via get_wedding_config, so anon never receives budget data. Gated to the
-- couple (is_helper() → no rows) to match the couple-only vendor/weddings writes.
drop function if exists public.get_budget_config();

create or replace function public.get_budget_config()
returns table (
  overall_budget_cap numeric,
  budget_categories  jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(overall_budget_cap, 0),
    coalesce(budget_categories, '[]'::jsonb)
  from public.weddings
  where not (select public.is_helper())
  limit 1;
$$;

-- Strip the implicit PUBLIC execute grant (Postgres grants EXECUTE on new
-- functions to PUBLIC by default, and revoking from a specific role never
-- removes a PUBLIC grant) — otherwise the anon key alone could call this.
revoke all on function public.get_budget_config() from public, anon;
grant execute on function public.get_budget_config() to authenticated;

-- ── 4. upsert_budget_config — couple-only budget write ────────────────────────
-- Separate from upsert_wedding_config so saving budget caps never risks
-- blanking the core wedding event fields.

create or replace function public.upsert_budget_config(
  p_overall_budget_cap  numeric,
  p_budget_categories   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- security definer bypasses RLS, so the couple-only gate must be enforced here
  -- too — otherwise a helper could call this RPC directly and mutate the budget,
  -- defeating the `not is_helper()` write policies on vendors/weddings.
  if (select public.is_helper()) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  insert into public.weddings (
    bride_name, groom_name,
    overall_budget_cap, budget_categories,
    updated_at
  ) values (
    '', '',
    coalesce(p_overall_budget_cap, 0),
    coalesce(p_budget_categories, '[]'::jsonb),
    now()
  )
  on conflict ((true)) do update set
    overall_budget_cap = coalesce(p_overall_budget_cap, public.weddings.overall_budget_cap),
    budget_categories  = coalesce(p_budget_categories,  public.weddings.budget_categories),
    updated_at         = now();
end;
$$;

revoke all on function public.upsert_budget_config(numeric, jsonb) from public, anon;
grant execute on function public.upsert_budget_config(numeric, jsonb) to authenticated;

-- ── 5. upsert_runsheet — couple-only runsheet write ───────────────────────────
-- Security definer bypasses the weddings_write RLS policy, so the role gate
-- lives inside the function; grants are authenticated-only (the anon key must
-- not be able to overwrite the couple's wedding-day runsheet).

drop function if exists public.upsert_runsheet(jsonb, boolean);

create or replace function public.upsert_runsheet(
  p_runsheet              jsonb,
  p_is_runsheet_published boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Couple-only: security definer bypasses the weddings_write RLS policy, so
  -- the role gate must live inside the function (same pattern as the other
  -- upsert_* config RPCs).
  if (select public.is_helper()) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  insert into public.weddings (bride_name, groom_name, runsheet, is_runsheet_published, updated_at)
  values ('', '', coalesce(p_runsheet, '[]'::jsonb), coalesce(p_is_runsheet_published, false), now())
  on conflict ((true)) do update set
    runsheet              = coalesce(excluded.runsheet, '[]'::jsonb),
    is_runsheet_published = coalesce(excluded.is_runsheet_published, false),
    updated_at            = now();
end;
$$;

revoke all on function public.upsert_runsheet(jsonb, boolean) from public, anon;
grant execute on function public.upsert_runsheet(jsonb, boolean) to authenticated;

-- ── 6. get_public_runsheet — public /runsheet/:slug page ──────────────────────

drop function if exists public.get_public_runsheet(text);

create or replace function public.get_public_runsheet(p_slug text)
returns table (
  bride_name            text,
  groom_name            text,
  wedding_date          date,
  venue_name            text,
  runsheet              jsonb,
  is_runsheet_published boolean
)
language sql
security definer
set search_path = public
as $$
  select
    bride_name,
    groom_name,
    wedding_date,
    coalesce(venue_name, ''),
    coalesce(runsheet, '[]'::jsonb),
    coalesce(is_runsheet_published, false)
  from public.weddings
  where slug = p_slug
    and coalesce(is_runsheet_published, false) = true
  limit 1;
$$;

grant execute on function public.get_public_runsheet(text) to anon, authenticated;

comment on function public.get_public_runsheet(text) is
  'Intentionally anon-callable: read-only, published-runsheets-only surface for the public /runsheet/:slug page. Do not add an is_helper() gate.';

-- ── 7. get_checklist_config — authenticated, couple-only read ─────────────────
-- Mirrors get_budget_config: served separately from get_wedding_config so anon
-- never receives checklist data.
--
-- Task shape: { id, text, category, dueOffsetDays, assignee, done,
--               reminders: [{ id, offsetDays }] }
--   dueOffsetDays is days relative to weddings.wedding_date (negative = before)
--   so deadlines recompute automatically when the wedding date changes.
--   assignee is 'both' | 'bride' | 'groom'.

drop function if exists public.get_checklist_config();

create or replace function public.get_checklist_config()
returns table (
  checklist jsonb
)
language sql
security definer
set search_path = public
as $$
  select coalesce(checklist, '[]'::jsonb)
  from public.weddings
  where not (select public.is_helper())
  limit 1;
$$;

revoke all on function public.get_checklist_config() from public, anon;
grant execute on function public.get_checklist_config() to authenticated;

-- ── 8. upsert_checklist_config — couple-only write ────────────────────────────

create or replace function public.upsert_checklist_config(
  p_checklist jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- security definer bypasses RLS, so the couple-only gate must be enforced here
  -- too — otherwise a helper could call this RPC directly and mutate the checklist.
  if (select public.is_helper()) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  insert into public.weddings (bride_name, groom_name, checklist, updated_at)
  values ('', '', coalesce(p_checklist, '[]'::jsonb), now())
  on conflict ((true)) do update set
    checklist  = coalesce(excluded.checklist, '[]'::jsonb),
    updated_at = now();
end;
$$;

revoke all on function public.upsert_checklist_config(jsonb) from public, anon;
grant execute on function public.upsert_checklist_config(jsonb) to authenticated;

-- ── 9. Checklist reminder log — dedup store for reminder emails (#113) ────────
-- Reminder *config* lives inside weddings.checklist: each task may carry
-- `reminders: [{ id, offsetDays }]`, offsetDays relative to the task's due date.
-- Sent *state* lives here, written only by the send-reminders cron via the
-- service-role client. Keeping the two stores' writers disjoint (client writes
-- the JSONB config, cron writes log rows) means a stale admin tab re-saving the
-- whole checklist array can never wipe sent-state and trigger duplicate emails.
--
-- No FK: task/reminder ids live inside the JSONB, so there is nothing to
-- reference. Rows for deleted tasks/reminders are harmless orphans at
-- singleton-wedding scale — deliberately not pruned; the cron could clean
-- them up later if it ever matters.

create table if not exists public.checklist_reminder_log (
  task_id     uuid not null,
  reminder_id uuid not null,
  sent_at     timestamptz not null default now(),
  -- Composite PK doubles as the dedup lookup index and makes the cron's
  -- bulk upsert (ignoreDuplicates) idempotent on retry.
  primary key (task_id, reminder_id)
);

-- Deny-by-default: RLS on with no policies. Only the cron's service-role
-- client (which bypasses RLS) reads or writes this table — anon and
-- authenticated get nothing. The UI shows reminder config, not send
-- history, so no client-facing RPC is needed.
alter table public.checklist_reminder_log enable row level security;

-- Explicit grant: service_role bypasses RLS but still needs table
-- privileges, and newer Supabase environments no longer give service_role
-- default DML on public tables (verified on supabase CLI 2.109: new tables
-- come up with only TRUNCATE/REFERENCES/TRIGGER for service_role). Without
-- this the cron's dedup reads/writes fail with 42501.
grant select, insert on public.checklist_reminder_log to service_role;

-- ── 10. upsert_floorplans — couple-only floorplans write (#162) ───────────────
-- The couple uploads floorplan/layout snapshot images (venue floorplan, stage
-- layout, …) for day-of verification; the helper views them read-only via the
-- weddings_select policy (0003). Images live in the PUBLIC wedding-photos
-- bucket under the floorplans/ prefix (couple-only writes per the 0003
-- policies); this RPC persists the metadata array (weddings.floorplans, 0003).
-- Security definer bypasses the weddings_write RLS policy, so the role gate
-- lives inside the function; grants are authenticated-only (the anon key must
-- not be able to overwrite the couple's floorplans). Same pattern as
-- upsert_runsheet (§5).

drop function if exists public.upsert_floorplans(jsonb);

create or replace function public.upsert_floorplans(p_floorplans jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select public.is_helper()) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  insert into public.weddings (bride_name, groom_name, floorplans, updated_at)
  values ('', '', coalesce(p_floorplans, '[]'::jsonb), now())
  on conflict ((true)) do update set
    floorplans = coalesce(excluded.floorplans, '[]'::jsonb),
    updated_at = now();
end;
$$;

revoke all on function public.upsert_floorplans(jsonb) from public, anon;
grant execute on function public.upsert_floorplans(jsonb) to authenticated;
