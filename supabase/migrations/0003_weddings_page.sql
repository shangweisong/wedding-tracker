-- 0003_weddings_page.sql — Wedding Setup + public wedding page
--
-- Consolidated from: 0004_weddings, 0006_ai_theme, 0007_section_photos,
--                    0008_hero_focal_point, 0011_vendors_budget (§1 weddings
--                    columns + §8 weddings policies), 0013_runsheet (§1 columns),
--                    0014_planning_checklist (§1 column),
--                    0015_guard_config_rpcs (§2 upsert_wedding_page),
--                    0019_wedding_photos_policies,
--                    0008_extra_notice (column + final upsert_wedding_page),
--                    0009_open_rsvp (§1 weddings columns),
--                    0011_photowall (§1 weddings columns + final get_public_wedding),
--                    0013_floorplans (§1 column + size guard)
--
-- Creates the `weddings` singleton table with all columns in their final form,
-- the wedding-photos storage bucket, and the page RPCs at their final
-- signatures. The config RPCs that expose smart-RSVP fields
-- (get_wedding_config / upsert_wedding_config) live in 0004_smart_rsvp.sql,
-- after the tables/columns they read are created. Budget / runsheet /
-- checklist RPCs live in 0006_planning_features.sql.

-- ── 1. `weddings` TABLE ───────────────────────────────────────────────────────
-- `primary_meal_event_id` is intentionally absent here: it references
-- wedding_events (created in 0004_smart_rsvp.sql), which itself references this
-- table — the column is added there to break the circular dependency.

create table if not exists public.weddings (
  id                uuid        primary key default gen_random_uuid(),
  -- Core event details
  bride_name        text        not null default '' check (char_length(bride_name) <= 120),
  groom_name        text        not null default '' check (char_length(groom_name) <= 120),
  wedding_date      date,
  venue_name        text        not null default '' check (char_length(venue_name) <= 200),
  venue_address     text        not null default '' check (char_length(venue_address) <= 500),
  ceremony_time     time,
  dinner_time       time,
  tea_ceremony_time time,
  -- Public wedding page
  slug              text        unique,
  love_story        text        default '',
  dress_code        text        default '',
  hero_image_url    text        default '',
  fun_qa            jsonb       default '[]',
  rsvp_deadline     date,
  is_published      boolean     default false,
  meal_options      text        default '',
  getting_there     text        default '',
  theme             text        default 'minimal',
  -- Opt-in playful RSVP dropdown options ("It's complicated" / "It's a secret") — #42
  enable_fun_rsvp_options boolean default false,
  -- Display-only notices shown to guests on the RSVP form (#40)
  smoking_notice    text        default '' check (char_length(smoking_notice) <= 500),
  parking_notice    text        default '' check (char_length(parking_notice) <= 500),
  -- Per-locale translations of the couple's own content (#53 Phase 2):
  -- { "<locale>": { love_story, dress_code, venue_name, venue_address,
  --   getting_there, smoking_notice, parking_notice, fun_qa: [{id,q,answer}] } }
  content_translations jsonb    default '{}',
  -- AI-generated custom theme palette, applied when theme = 'custom' (#60)
  theme_tokens      jsonb       not null default '{}'::jsonb,
  -- Optional photo galleries between page sections (#71)
  section_photos    jsonb       not null default '{}'::jsonb,
  -- Hero image crop anchor — one of a 9-point background-position grid (#75)
  hero_focal_point  text        not null default 'center',
  -- Smart RSVP master switch (#78); the designated meal event column is added
  -- in 0004_smart_rsvp.sql
  enable_smart_rsvp boolean     not null default false,
  -- Budget planning (couple-only; served via get_budget_config, 0006)
  overall_budget_cap numeric    not null default 0
    check (overall_budget_cap >= 0 and overall_budget_cap <= 100000000),
  budget_categories jsonb       not null default '[]'::jsonb,
  -- Wedding-day runsheet (timeline items) + publish toggle
  runsheet          jsonb       default '[]'::jsonb,
  is_runsheet_published boolean default false,
  -- Planning checklist (couple-only; served via get_checklist_config, 0006)
  checklist         jsonb       not null default '[]'::jsonb,
  -- General extra notice shown to guests on the RSVP form (#125)
  extra_notice      text        default '' check (char_length(extra_notice) <= 500),
  -- Open RSVP self-registration (#126): master switch + mandatory PIN. The pin
  -- is a shared low-entropy secret (like a wifi password on the invitation
  -- card), not an account credential — stored plainly, but only ever read back
  -- through the couple-only get_open_rsvp_admin_config (0008_open_rsvp.sql).
  enable_open_rsvp  boolean     not null default false,
  rsvp_pin          text        not null default '' check (char_length(rsvp_pin) <= 20),
  -- Guest photowall (#138): master switch + dedicated pin (NOT rsvp_pin, so the
  -- photowall can run while open RSVP is off and vice versa; same nature as
  -- rsvp_pin, read back only through get_photowall_admin_config, 0009_photowall.sql)
  enable_photowall  boolean     not null default false,
  photowall_pin     text        not null default '' check (char_length(photowall_pin) <= 20),
  -- Venue floorplan/layout snapshots (#162): [{ id, path, url, label, created_at }],
  -- capped client-side at 6 entries / 80-char labels (src/lib/floorplan.js) and
  -- bounded by weddings_floorplans_size below as the authoritative guard.
  -- Deliberately NOT exposed via get_wedding_config (anon-callable — would leak
  -- the floorplans to the public RSVP page); the admin app selects it directly.
  floorplans        jsonb       not null default '[]'::jsonb,
  updated_at        timestamptz not null default now()
);

-- Singleton enforcement: only one row can ever exist.
create unique index if not exists weddings_singleton_idx on public.weddings ((true));

-- Idempotent column accretion for DBs whose `weddings` table predates any of
-- the columns above (`create table if not exists` no-ops there).
alter table public.weddings add column if not exists theme text default 'minimal';
alter table public.weddings add column if not exists enable_fun_rsvp_options boolean default false;
alter table public.weddings add column if not exists smoking_notice text default '';
alter table public.weddings add column if not exists parking_notice text default '';
alter table public.weddings add column if not exists content_translations jsonb default '{}';
alter table public.weddings add column if not exists theme_tokens jsonb not null default '{}'::jsonb;
alter table public.weddings add column if not exists section_photos jsonb not null default '{}'::jsonb;
alter table public.weddings add column if not exists hero_focal_point text not null default 'center';
alter table public.weddings add column if not exists enable_smart_rsvp boolean not null default false;
alter table public.weddings
  add column if not exists overall_budget_cap numeric not null default 0
    check (overall_budget_cap >= 0 and overall_budget_cap <= 100000000);
alter table public.weddings add column if not exists budget_categories jsonb not null default '[]'::jsonb;
alter table public.weddings
  add column if not exists runsheet              jsonb   default '[]'::jsonb,
  add column if not exists is_runsheet_published boolean default false;
alter table public.weddings add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table public.weddings
  add column if not exists extra_notice text default '' check (char_length(extra_notice) <= 500);
alter table public.weddings add column if not exists enable_open_rsvp boolean not null default false;
alter table public.weddings
  add column if not exists rsvp_pin text not null default ''
    check (char_length(rsvp_pin) <= 20);
alter table public.weddings add column if not exists enable_photowall boolean not null default false;
alter table public.weddings
  add column if not exists photowall_pin text not null default ''
    check (char_length(photowall_pin) <= 20);
alter table public.weddings
  add column if not exists floorplans jsonb not null default '[]'::jsonb;

-- Server-side size/whitelist guards: upsert_wedding_page used to be granted to
-- anon, so a caller could bypass the client-side normalizers. Bound the stored
-- payloads so a malformed/oversized blob can't be persisted and then served on
-- every public page load. (Postgres has no `add constraint if not exists`, so
-- guard on pg_constraint for idempotency.)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'weddings_section_photos_size'
  ) then
    alter table public.weddings
      add constraint weddings_section_photos_size
      check (pg_column_size(section_photos) < 200000);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'weddings_hero_focal_point_valid'
  ) then
    alter table public.weddings
      add constraint weddings_hero_focal_point_valid
      check (hero_focal_point in (
        'left top',    'center top',    'right top',
        'left center', 'center',        'right center',
        'left bottom', 'center bottom', 'right bottom'
      ));
  end if;
end $$;

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

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'weddings_checklist_size'
  ) then
    alter table public.weddings
      add constraint weddings_checklist_size
      check (pg_column_size(checklist) < 100000);
  end if;
end $$;

-- Floorplans size guard (#162): 6 entries × ~350 bytes ≈ 2 KB; 10 KB is headroom.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'weddings_floorplans_size'
  ) then
    alter table public.weddings
      add constraint weddings_floorplans_size
      check (pg_column_size(floorplans) < 10000);
  end if;
end $$;

-- ── 2. RLS ────────────────────────────────────────────────────────────────────
-- SELECT → authenticated only. The public pages never read this table directly
-- (RsvpPage/WeddingPage go through the anon-granted security-definer RPCs
-- get_wedding_config / get_public_wedding, which bypass RLS), so there is no
-- anon read — that would leak the budget/checklist columns.
-- Writes → couple only (not is_helper()). The security-definer upsert_* RPCs
-- bypass RLS, so admin saves are unaffected.

alter table public.weddings enable row level security;

drop policy if exists "public" on public.weddings;

drop policy if exists "weddings_select" on public.weddings;
create policy "weddings_select" on public.weddings
  for select to authenticated using (true);

drop policy if exists "weddings_write" on public.weddings;
create policy "weddings_write" on public.weddings
  for all to authenticated
  using (not (select public.is_helper())) with check (not (select public.is_helper()));

-- ── 3. STORAGE BUCKET (hero/section photos) ───────────────────────────────────
-- Public bucket (serves images on the public wedding page); writes are
-- couple-only — photos are couple content uploaded from the signed-in admin
-- console, so writes follow the same couple-only pattern as vendors/weddings.

insert into storage.buckets (id, name, public)
  values ('wedding-photos', 'wedding-photos', true)
  on conflict do nothing;

-- Legacy unrestricted policies from the original 0004 (any anon-key holder
-- could upload/overwrite/delete objects in the public bucket).
drop policy if exists "anon upload wedding photos" on storage.objects;
drop policy if exists "anon update wedding photos" on storage.objects;
drop policy if exists "anon delete wedding photos" on storage.objects;

drop policy if exists "couple upload wedding photos" on storage.objects;
create policy "couple upload wedding photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'wedding-photos' and not (select public.is_helper()));

drop policy if exists "couple update wedding photos" on storage.objects;
create policy "couple update wedding photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'wedding-photos' and not (select public.is_helper()))
  with check (bucket_id = 'wedding-photos' and not (select public.is_helper()));

drop policy if exists "couple delete wedding photos" on storage.objects;
create policy "couple delete wedding photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'wedding-photos' and not (select public.is_helper()));

-- Public read stays — the bucket serves hero/section images on the public page.
drop policy if exists "public view wedding photos" on storage.objects;
create policy "public view wedding photos" on storage.objects
  for select using (bucket_id = 'wedding-photos');

-- ── 4. upsert_wedding_page — admin write (Wedding Page tab), couple-only ──────
-- Security definer bypasses the weddings_write RLS policy, so the role gate
-- lives inside the function: raise `42501 insufficient_privilege` when the
-- caller is the helper (#101). is_helper() FAILS OPEN, so this guard can never
-- block the couple.

-- Superseded historical signatures (each feature appended a parameter).
drop function if exists public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text);
drop function if exists public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text, text);
drop function if exists public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text, text, text);
drop function if exists public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text, text, text, boolean);
drop function if exists public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text, text, text, boolean, text, text);
drop function if exists public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text, text, text, boolean, text, text, jsonb);
drop function if exists public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text, text, text, boolean, text, text, jsonb, jsonb);
drop function if exists public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text, text, text, boolean, text, text, jsonb, jsonb, jsonb);
drop function if exists public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text, text, text, boolean, text, text, jsonb, jsonb, jsonb, text);

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
  p_content_translations jsonb default '{}',
  p_theme_tokens    jsonb default '{}',
  p_section_photos  jsonb default '{}',
  p_hero_focal_point text default 'center',
  p_extra_notice    text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Couple-only: security definer bypasses the weddings_write RLS policy, so
  -- the role gate must live inside the function (same pattern as
  -- upsert_budget_config in 0006).
  if (select public.is_helper()) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  insert into public.weddings (
    bride_name, groom_name,
    slug, love_story, dress_code, hero_image_url, hero_focal_point,
    fun_qa, rsvp_deadline, is_published, meal_options,
    getting_there, theme, enable_fun_rsvp_options,
    smoking_notice, parking_notice, extra_notice, content_translations, theme_tokens,
    section_photos, updated_at
  ) values (
    '', '',
    p_slug,
    left(coalesce(p_love_story, ''), 5000),
    left(coalesce(p_dress_code, ''), 200),
    left(coalesce(p_hero_image_url, ''), 500),
    coalesce(p_hero_focal_point, 'center'),
    coalesce(p_fun_qa, '[]'::jsonb),
    p_rsvp_deadline,
    coalesce(p_is_published, false),
    left(coalesce(p_meal_options, ''), 200),
    left(coalesce(p_getting_there, ''), 2000),
    coalesce(p_theme, 'minimal'),
    coalesce(p_enable_fun_rsvp_options, false),
    left(coalesce(p_smoking_notice, ''), 500),
    left(coalesce(p_parking_notice, ''), 500),
    left(coalesce(p_extra_notice, ''), 500),
    coalesce(p_content_translations, '{}'::jsonb),
    coalesce(p_theme_tokens, '{}'::jsonb),
    coalesce(p_section_photos, '{}'::jsonb),
    now()
  )
  on conflict ((true)) do update set
    slug           = coalesce(p_slug, public.weddings.slug),
    love_story     = left(coalesce(p_love_story, ''), 5000),
    dress_code     = left(coalesce(p_dress_code, ''), 200),
    hero_image_url = left(coalesce(p_hero_image_url, ''), 500),
    hero_focal_point = coalesce(p_hero_focal_point, 'center'),
    fun_qa         = coalesce(p_fun_qa, '[]'::jsonb),
    rsvp_deadline  = p_rsvp_deadline,
    is_published   = coalesce(p_is_published, false),
    meal_options   = left(coalesce(p_meal_options, ''), 200),
    getting_there  = left(coalesce(p_getting_there, ''), 2000),
    theme          = coalesce(p_theme, 'minimal'),
    enable_fun_rsvp_options = coalesce(p_enable_fun_rsvp_options, false),
    smoking_notice = left(coalesce(p_smoking_notice, ''), 500),
    parking_notice = left(coalesce(p_parking_notice, ''), 500),
    extra_notice   = left(coalesce(p_extra_notice, ''), 500),
    content_translations = coalesce(p_content_translations, '{}'::jsonb),
    theme_tokens   = coalesce(p_theme_tokens, '{}'::jsonb),
    section_photos = coalesce(p_section_photos, '{}'::jsonb),
    updated_at     = now();
end;
$$;

revoke all on function public.upsert_wedding_page(
  text, text, text, text, jsonb, date, boolean, text, text, text, boolean, text, text, jsonb, jsonb, jsonb, text, text
) from public, anon;
grant execute on function public.upsert_wedding_page(
  text, text, text, text, jsonb, date, boolean, text, text, text, boolean, text, text, jsonb, jsonb, jsonb, text, text
) to authenticated;

-- ── 5. get_public_wedding — public page lookup by slug (/wedding/:slug) ───────
-- Column order in the returns table MUST match the select list — WeddingPage
-- reads it positionally; new fields are append-only.

drop function if exists public.get_public_wedding(text);

create or replace function public.get_public_wedding(p_slug text)
returns table (
  bride_name        text,
  groom_name        text,
  wedding_date      date,
  venue_name        text,
  venue_address     text,
  ceremony_time     text,
  dinner_time       text,
  tea_ceremony_time text,
  slug              text,
  love_story        text,
  dress_code        text,
  hero_image_url    text,
  hero_focal_point  text,
  fun_qa            jsonb,
  rsvp_deadline     date,
  is_published      boolean,
  meal_options      text,
  getting_there     text,
  theme             text,
  content_translations jsonb,
  theme_tokens      jsonb,
  section_photos    jsonb,
  enable_smart_rsvp boolean,
  enable_photowall  boolean
)
language sql
security definer
set search_path = public
as $$
  select
    bride_name, groom_name, wedding_date, venue_name, venue_address,
    to_char(ceremony_time,     'HH24:MI'),
    to_char(dinner_time,       'HH24:MI'),
    to_char(tea_ceremony_time, 'HH24:MI'),
    slug,
    coalesce(love_story, ''),
    coalesce(dress_code, ''),
    coalesce(hero_image_url, ''),
    coalesce(hero_focal_point, 'center'),
    coalesce(fun_qa, '[]'::jsonb),
    rsvp_deadline,
    coalesce(is_published, false),
    coalesce(meal_options, ''),
    coalesce(getting_there, ''),
    coalesce(theme, 'minimal'),
    coalesce(content_translations, '{}'::jsonb),
    coalesce(theme_tokens, '{}'::jsonb),
    coalesce(section_photos, '{}'::jsonb),
    coalesce(enable_smart_rsvp, false),
    coalesce(enable_photowall, false)
  from public.weddings
  where slug = p_slug
  limit 1;
$$;

grant execute on function public.get_public_wedding(text) to anon, authenticated;
