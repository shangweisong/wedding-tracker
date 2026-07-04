-- 0006_ai_theme.sql — AI-generated custom theme (#60)
-- Adds a `theme_tokens` JSONB column holding a color-only palette (derived from
-- an uploaded image by a vision LLM via api/generate-theme.js) and threads it
-- through the read/write RPCs. Applied on the public page when theme = 'custom'.
-- Idempotent & consolidated, consistent with migrations 0001–0005.

-- ── 1. Column ─────────────────────────────────────────────────────────────────
alter table public.weddings
  add column if not exists theme_tokens jsonb not null default '{}'::jsonb;

-- ── 2. RPCs (recreate with theme_tokens) ──────────────────────────────────────

-- 2a. Admin read.
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
  content_translations jsonb,
  theme_tokens      jsonb
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
    coalesce(theme_tokens, '{}'::jsonb)
  from public.weddings
  limit 1;
$$;

grant execute on function public.get_wedding_config() to anon, authenticated;

-- 2b. Admin write (Wedding Page tab). Adds p_theme_tokens.
drop function if exists public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text, text, text, boolean, text, text, jsonb);

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
  p_theme_tokens    jsonb default '{}'
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
    smoking_notice, parking_notice, content_translations, theme_tokens, updated_at
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
    coalesce(p_theme_tokens, '{}'::jsonb),
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
    theme_tokens   = coalesce(p_theme_tokens, '{}'::jsonb),
    updated_at     = now();
end;
$$;

grant execute on function public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text, text, text, boolean, text, text, jsonb, jsonb)
  to anon, authenticated;

-- 2c. Public page lookup by slug.
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
  content_translations jsonb,
  theme_tokens      jsonb
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
    coalesce(content_translations, '{}'::jsonb),
    coalesce(theme_tokens, '{}'::jsonb)
  from public.weddings
  where slug = p_slug
  limit 1;
$$;

grant execute on function public.get_public_wedding(text) to anon, authenticated;
