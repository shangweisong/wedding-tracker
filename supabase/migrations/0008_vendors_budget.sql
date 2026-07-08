-- 0008_vendors_budget.sql — Budget categories, overall cap, and vendor management
-- Adds two columns to the weddings singleton, creates the vendors table with RLS,
-- recreates get_wedding_config with new budget columns, and adds a dedicated
-- upsert_budget_config RPC. Idempotent — safe to re-run.

-- ── 1. New columns on weddings ────────────────────────────────────────────────

alter table public.weddings
  add column if not exists overall_budget_cap numeric not null default 0
    check (overall_budget_cap >= 0 and overall_budget_cap <= 100000000);

alter table public.weddings
  add column if not exists budget_categories jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'weddings_budget_categories_size'
  ) then
    alter table public.weddings
      add constraint weddings_budget_categories_size
      check (pg_column_size(budget_categories) < 50000);
  end if;
end $$;

-- ── 2. vendors table ──────────────────────────────────────────────────────────
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

-- ── 3. Idempotent column/constraint fixes (for DBs where table already existed) ─

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

-- ── 4. Trigger ────────────────────────────────────────────────────────────────
-- Reuse the set_updated_at trigger function defined in 0001_init.sql.
drop trigger if exists vendors_set_updated_at on public.vendors;
create trigger vendors_set_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

-- ── 5. RLS for vendors ────────────────────────────────────────────────────────
-- Same pattern as guests: authenticated role only — anon key cannot touch vendor data.

alter table public.vendors enable row level security;

drop policy if exists "vendors_select" on public.vendors;
create policy "vendors_select" on public.vendors
  for select to authenticated using (true);

drop policy if exists "vendors_insert" on public.vendors;
create policy "vendors_insert" on public.vendors
  for insert to authenticated with check (true);

drop policy if exists "vendors_update" on public.vendors;
create policy "vendors_update" on public.vendors
  for update to authenticated using (true) with check (true);

drop policy if exists "vendors_delete" on public.vendors;
create policy "vendors_delete" on public.vendors
  for delete to authenticated using (true);

-- ── 6. Recreate get_wedding_config (adds budget columns to return type) ───────
-- Must drop the 0007 version first (Postgres requires an exact signature match).

drop function if exists public.get_wedding_config();

create or replace function public.get_wedding_config()
returns table (
  id                      uuid,
  bride_name              text,
  groom_name              text,
  wedding_date            date,
  venue_name              text,
  venue_address           text,
  ceremony_time           text,
  dinner_time             text,
  tea_ceremony_time       text,
  slug                    text,
  love_story              text,
  dress_code              text,
  hero_image_url          text,
  fun_qa                  jsonb,
  rsvp_deadline           date,
  is_published            boolean,
  meal_options            text,
  getting_there           text,
  theme                   text,
  enable_fun_rsvp_options boolean,
  smoking_notice          text,
  parking_notice          text,
  content_translations    jsonb,
  theme_tokens            jsonb,
  section_photos          jsonb,
  overall_budget_cap      numeric,
  budget_categories       jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    id,
    bride_name,
    groom_name,
    wedding_date,
    venue_name,
    venue_address,
    to_char(ceremony_time,     'HH24:MI'),
    to_char(dinner_time,       'HH24:MI'),
    to_char(tea_ceremony_time, 'HH24:MI'),
    coalesce(slug, ''),
    coalesce(love_story, ''),
    coalesce(dress_code, ''),
    coalesce(hero_image_url, ''),
    coalesce(fun_qa, '[]'::jsonb),
    rsvp_deadline,
    coalesce(is_published, false),
    coalesce(meal_options, ''),
    coalesce(getting_there, ''),
    coalesce(theme, 'minimal'),
    coalesce(enable_fun_rsvp_options, false),
    coalesce(smoking_notice, ''),
    coalesce(parking_notice, ''),
    coalesce(content_translations, '{}'::jsonb),
    coalesce(theme_tokens, '{}'::jsonb),
    coalesce(section_photos, '{}'::jsonb),
    coalesce(overall_budget_cap, 0),
    coalesce(budget_categories, '[]'::jsonb)
  from public.weddings
  limit 1;
$$;

grant execute on function public.get_wedding_config() to anon, authenticated;

-- ── 7. Dedicated budget-config write RPC ─────────────────────────────────────
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

-- Authenticated only — budget data is internal, not public.
grant execute on function public.upsert_budget_config(numeric, jsonb) to authenticated;
