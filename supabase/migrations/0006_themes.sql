-- Add page theme to weddings + update the 3 RPCs that read/write it.

alter table public.weddings add column if not exists theme text default 'minimal';

-- ─── get_wedding_config (admin + RSVP page) ───────────────────────────────────
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
  theme             text
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
    coalesce(theme, 'minimal')
  from public.weddings
  limit 1;
$$;

grant execute on function public.get_wedding_config() to anon, authenticated;

-- ─── upsert_wedding_page (Wedding Page tab save) ──────────────────────────────
drop function if exists public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text, text);

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
  p_theme           text default 'minimal'
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
    getting_there, theme, updated_at
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
    updated_at     = now();
end;
$$;

grant execute on function public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text, text, text)
  to anon, authenticated;

-- ─── get_public_wedding (public /wedding/:slug route) ─────────────────────────
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
  theme             text
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
    coalesce(theme, 'minimal')
  from public.weddings
  where slug = p_slug
  limit 1;
$$;

grant execute on function public.get_public_wedding(text) to anon, authenticated;
