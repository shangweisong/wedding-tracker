-- 0009_role_rls.sql — Enforce couple vs helper roles at the DB layer.
--
-- The app embeds app_role in JWT user_metadata via supabase.auth.updateUser()
-- immediately after sign-in. Policies here check that claim and restrict
-- destructive or financial operations to the couple account only.
--
-- Threat model: prevents accidental or curious helper actions against the DB
-- (e.g. via DevTools / JS console). The setup wizard (#88) will harden this
-- further by setting app_metadata (service-role only, not user-writable).

-- ── Role helper ──────────────────────────────────────────────────────────────
-- public.app_role() reads app_role from JWT user_metadata. Defaults to 'helper'
-- (least privilege) so an unauthenticated or uninitialized session never gains
-- couple access. Lives in public (not auth) — Supabase blocks custom auth-schema fns.
create or replace function public.app_role() returns text
  language sql stable
as $$
  select coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'app_role', ''),
    'helper'
  )
$$;

-- ── guests ────────────────────────────────────────────────────────────────────
-- Helpers can SELECT and UPDATE (check-in, angbao) but cannot add or remove guests.
drop policy if exists "helpers_select" on public.guests;
drop policy if exists "helpers_insert" on public.guests;
drop policy if exists "helpers_update" on public.guests;
drop policy if exists "helpers_delete" on public.guests;

create policy "guests_select"
  on public.guests for select
  to authenticated using (true);

create policy "guests_insert"
  on public.guests for insert
  to authenticated
  with check (public.app_role() = 'couple');

create policy "guests_update"
  on public.guests for update
  to authenticated using (true) with check (true);

create policy "guests_delete"
  on public.guests for delete
  to authenticated
  using (public.app_role() = 'couple');

-- ── tables (seating) ─────────────────────────────────────────────────────────
-- Seating configuration is couple-managed; helpers only need to read table
-- assignments (for the check-in grid).
drop policy if exists "helpers_select" on public.tables;
drop policy if exists "helpers_insert" on public.tables;
drop policy if exists "helpers_update" on public.tables;
drop policy if exists "helpers_delete" on public.tables;

create policy "tables_select"
  on public.tables for select
  to authenticated using (true);

create policy "tables_insert"
  on public.tables for insert
  to authenticated
  with check (public.app_role() = 'couple');

create policy "tables_update"
  on public.tables for update
  to authenticated
  using (public.app_role() = 'couple') with check (public.app_role() = 'couple');

create policy "tables_delete"
  on public.tables for delete
  to authenticated
  using (public.app_role() = 'couple');

-- ── submissions ───────────────────────────────────────────────────────────────
-- Helpers can read and update (approve/match) submissions but cannot delete them.
drop policy if exists "helpers_all_submissions" on public.submissions;

create policy "submissions_select"
  on public.submissions for select
  to authenticated using (true);

create policy "submissions_update"
  on public.submissions for update
  to authenticated using (true) with check (true);

create policy "submissions_delete"
  on public.submissions for delete
  to authenticated
  using (public.app_role() = 'couple');

-- ── weddings (config) ────────────────────────────────────────────────────────
-- The existing "public" policy allowed anon writes — replace with split policies.
drop policy if exists "public" on public.weddings;

-- Anonymous SELECT stays open so WeddingPage.jsx works without auth.
create policy "weddings_select"
  on public.weddings for select
  using (true);

-- All writes require the couple role.
create policy "weddings_write"
  on public.weddings for all
  to authenticated
  using (public.app_role() = 'couple')
  with check (public.app_role() = 'couple');

-- ── vendors (financial data) ─────────────────────────────────────────────────
-- Helpers have no access to vendor/budget data — the Budget tab is couple-only.
drop policy if exists "vendors_select" on public.vendors;
drop policy if exists "vendors_insert" on public.vendors;
drop policy if exists "vendors_update" on public.vendors;
drop policy if exists "vendors_delete" on public.vendors;

create policy "vendors_couple_all"
  on public.vendors for all
  to authenticated
  using (public.app_role() = 'couple')
  with check (public.app_role() = 'couple');

-- ── Harden security-definer write RPCs ───────────────────────────────────────
-- These functions are SECURITY DEFINER (bypass RLS). Adding an explicit role
-- check inside the function body closes the gap left by the table-level policies.

create or replace function public.upsert_wedding_config(
  p_bride_name        text,
  p_groom_name        text,
  p_wedding_date      date,
  p_venue_name        text,
  p_venue_address     text,
  p_ceremony_time     text,
  p_dinner_time       text,
  p_tea_ceremony_time text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.app_role() <> 'couple' then
    raise exception 'permission denied: couple role required'
      using errcode = 'insufficient_privilege';
  end if;
  insert into public.weddings (
    bride_name, groom_name, wedding_date,
    venue_name, venue_address,
    ceremony_time, dinner_time, tea_ceremony_time,
    updated_at
  ) values (
    left(coalesce(p_bride_name, ''), 120),
    left(coalesce(p_groom_name, ''), 120),
    p_wedding_date,
    left(coalesce(p_venue_name, ''), 200),
    left(coalesce(p_venue_address, ''), 500),
    p_ceremony_time::time,
    p_dinner_time::time,
    case when p_tea_ceremony_time = '' then null else p_tea_ceremony_time::time end,
    now()
  )
  on conflict ((true)) do update set
    bride_name        = excluded.bride_name,
    groom_name        = excluded.groom_name,
    wedding_date      = excluded.wedding_date,
    venue_name        = excluded.venue_name,
    venue_address     = excluded.venue_address,
    ceremony_time     = excluded.ceremony_time,
    dinner_time       = excluded.dinner_time,
    tea_ceremony_time = excluded.tea_ceremony_time,
    updated_at        = now();
end;
$$;

create or replace function public.upsert_wedding_page(
  p_slug            text,
  p_love_story      text,
  p_dress_code      text,
  p_hero_image_url  text,
  p_fun_qa          jsonb,
  p_rsvp_deadline   date,
  p_is_published    boolean,
  p_meal_options    text,
  p_getting_there   text default '',
  p_theme           text default 'minimal',
  p_enable_fun_rsvp_options boolean default false,
  p_smoking_notice  text default '',
  p_parking_notice  text default '',
  p_content_translations jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.app_role() <> 'couple' then
    raise exception 'permission denied: couple role required'
      using errcode = 'insufficient_privilege';
  end if;
  insert into public.weddings (
    bride_name, groom_name,
    slug, love_story, dress_code, hero_image_url,
    fun_qa, rsvp_deadline, is_published, meal_options,
    getting_there, theme, enable_fun_rsvp_options,
    smoking_notice, parking_notice, content_translations, updated_at
  ) values (
    '', '',
    p_slug,
    left(coalesce(p_love_story, ''), 5000),
    left(coalesce(p_dress_code, ''), 200),
    left(coalesce(p_hero_image_url, ''), 500),
    coalesce(p_fun_qa, '[]'::jsonb),
    p_rsvp_deadline,
    coalesce(p_is_published, false),
    left(coalesce(p_meal_options, ''), 200),
    left(coalesce(p_getting_there, ''), 2000),
    coalesce(p_theme, 'minimal'),
    coalesce(p_enable_fun_rsvp_options, false),
    left(coalesce(p_smoking_notice, ''), 500),
    left(coalesce(p_parking_notice, ''), 500),
    coalesce(p_content_translations, '{}'::jsonb),
    now()
  )
  on conflict ((true)) do update set
    slug           = coalesce(p_slug, public.weddings.slug),
    love_story     = left(coalesce(p_love_story, ''), 5000),
    dress_code     = left(coalesce(p_dress_code, ''), 200),
    hero_image_url = left(coalesce(p_hero_image_url, ''), 500),
    fun_qa         = coalesce(p_fun_qa, '[]'::jsonb),
    rsvp_deadline  = p_rsvp_deadline,
    is_published   = coalesce(p_is_published, false),
    meal_options   = left(coalesce(p_meal_options, ''), 200),
    getting_there  = left(coalesce(p_getting_there, ''), 2000),
    theme          = coalesce(p_theme, 'minimal'),
    enable_fun_rsvp_options = coalesce(p_enable_fun_rsvp_options, false),
    smoking_notice = left(coalesce(p_smoking_notice, ''), 500),
    parking_notice = left(coalesce(p_parking_notice, ''), 500),
    content_translations = coalesce(p_content_translations, '{}'::jsonb),
    updated_at     = now();
end;
$$;

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
  if public.app_role() <> 'couple' then
    raise exception 'permission denied: couple role required'
      using errcode = 'insufficient_privilege';
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
