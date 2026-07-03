-- Wedding Setup + Public Wedding Page
--
-- Consolidated from: 0007_wedding_setup, 0008_wedding_page,
--                    0009_tea_ceremony, 0010_getting_there,
--                    0006_themes
--
-- Creates the `weddings` singleton table with all columns in their final form,
-- the wedding-photos storage bucket, and all four RPCs at their final signatures.

-- ── 1. `weddings` TABLE ───────────────────────────────────────────────────────

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
  content_translations jsonb default '{}',
  updated_at        timestamptz not null default now()
);

-- Singleton enforcement: only one row can ever exist.
create unique index if not exists weddings_singleton_idx on public.weddings ((true));

alter table public.weddings enable row level security;

drop policy if exists "public" on public.weddings;
create policy "public" on public.weddings for all using (true) with check (true);

-- theme column may be absent on existing DBs that ran the old 0004.
alter table public.weddings add column if not exists theme text default 'minimal';

-- Opt-in playful RSVP dropdown options — absent on existing DBs (#42).
alter table public.weddings add column if not exists enable_fun_rsvp_options boolean default false;

-- Display-only RSVP notices — absent on existing DBs (#40).
alter table public.weddings add column if not exists smoking_notice text default '';
alter table public.weddings add column if not exists parking_notice text default '';

-- Per-locale content translations — absent on existing DBs (#53 Phase 2).
alter table public.weddings add column if not exists content_translations jsonb default '{}';

-- ── 2. STORAGE BUCKET (hero photos) ──────────────────────────────────────────

insert into storage.buckets (id, name, public)
  values ('wedding-photos', 'wedding-photos', true)
  on conflict do nothing;

drop policy if exists "anon upload wedding photos" on storage.objects;
create policy "anon upload wedding photos" on storage.objects
  for insert with check (bucket_id = 'wedding-photos');

drop policy if exists "anon update wedding photos" on storage.objects;
create policy "anon update wedding photos" on storage.objects
  for update using (bucket_id = 'wedding-photos')
  with check (bucket_id = 'wedding-photos');

drop policy if exists "anon delete wedding photos" on storage.objects;
create policy "anon delete wedding photos" on storage.objects
  for delete using (bucket_id = 'wedding-photos');

drop policy if exists "public view wedding photos" on storage.objects;
create policy "public view wedding photos" on storage.objects
  for select using (bucket_id = 'wedding-photos');

-- ── 3. RPCs ───────────────────────────────────────────────────────────────────

-- 3a. Read all wedding config (admin + public page fields).
drop function if exists public.get_wedding_config();

create or replace function public.get_wedding_config()
returns table (
  id                uuid,
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
  fun_qa            jsonb,
  rsvp_deadline     date,
  is_published      boolean,
  meal_options      text,
  getting_there     text,
  theme             text,
  enable_fun_rsvp_options boolean,
  smoking_notice    text,
  parking_notice    text,
  content_translations jsonb
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
    coalesce(content_translations, '{}'::jsonb)
  from public.weddings
  limit 1;
$$;

grant execute on function public.get_wedding_config() to anon, authenticated;

-- 3b. Upsert core event details (Wedding Setup modal).
drop function if exists public.upsert_wedding_config(text, text, date, text, text, text, text);
drop function if exists public.upsert_wedding_config(text, text, date, text, text, text, text, text);

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

grant execute on function public.upsert_wedding_config(text, text, date, text, text, text, text, text)
  to anon, authenticated;

-- 3c. Upsert public page fields (Wedding Page tab).
drop function if exists public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text);
drop function if exists public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text, text);
drop function if exists public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text, text, text);
drop function if exists public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text, text, text, boolean);
drop function if exists public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text, text, text, boolean, text, text);

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

grant execute on function public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text, text, text, boolean, text, text, jsonb)
  to anon, authenticated;

-- 3d. Public page lookup by slug (used by /wedding/:slug route).
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
  fun_qa            jsonb,
  rsvp_deadline     date,
  is_published      boolean,
  meal_options      text,
  getting_there     text,
  theme             text,
  content_translations jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    bride_name,
    groom_name,
    wedding_date,
    venue_name,
    venue_address,
    to_char(ceremony_time,     'HH24:MI'),
    to_char(dinner_time,       'HH24:MI'),
    to_char(tea_ceremony_time, 'HH24:MI'),
    slug,
    coalesce(love_story, ''),
    coalesce(dress_code, ''),
    coalesce(hero_image_url, ''),
    coalesce(fun_qa, '[]'::jsonb),
    rsvp_deadline,
    coalesce(is_published, false),
    coalesce(meal_options, ''),
    coalesce(getting_there, ''),
    coalesce(theme, 'minimal'),
    coalesce(content_translations, '{}'::jsonb)
  from public.weddings
  where slug = p_slug
  limit 1;
$$;

grant execute on function public.get_public_wedding(text) to anon, authenticated;
