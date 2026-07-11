-- Wedding Day Runsheet
--
-- Adds runsheet (JSONB array of timeline items) and is_runsheet_published to the
-- weddings singleton, updates get_wedding_config to expose them, and provides
-- upsert_runsheet for admin saves and get_public_runsheet for the public /runsheet/:slug page.

-- ── 1. New columns ────────────────────────────────────────────────────────────

alter table public.weddings
  add column if not exists runsheet              jsonb   default '[]'::jsonb,
  add column if not exists is_runsheet_published boolean default false;

-- ── 2. Recreate get_wedding_config (adds runsheet columns) ───────────────────
-- Must drop old version first (Postgres requires exact signature match on replace).
-- Column order in returns table MUST match the select list exactly.

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
  hero_focal_point        text,
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
  enable_smart_rsvp       boolean,
  primary_meal_event_id   uuid,
  runsheet                jsonb,
  is_runsheet_published   boolean
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
    coalesce(hero_focal_point, 'center'),
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
    coalesce(enable_smart_rsvp, false),
    primary_meal_event_id,
    coalesce(runsheet, '[]'::jsonb),
    coalesce(is_runsheet_published, false)
  from public.weddings
  limit 1;
$$;

grant execute on function public.get_wedding_config() to anon, authenticated;

-- ── 3. upsert_runsheet ────────────────────────────────────────────────────────

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
  insert into public.weddings (bride_name, groom_name, runsheet, is_runsheet_published, updated_at)
  values ('', '', coalesce(p_runsheet, '[]'::jsonb), coalesce(p_is_runsheet_published, false), now())
  on conflict ((true)) do update set
    runsheet              = coalesce(excluded.runsheet, '[]'::jsonb),
    is_runsheet_published = coalesce(excluded.is_runsheet_published, false),
    updated_at            = now();
end;
$$;

grant execute on function public.upsert_runsheet(jsonb, boolean) to anon, authenticated;

-- ── 4. get_public_runsheet ────────────────────────────────────────────────────

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
