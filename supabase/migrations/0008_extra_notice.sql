-- ─────────────────────────────────────────────────────────────────────────────
-- 0008_extra_notice.sql — general "Extra Notice" for the RSVP page (#125)
--
-- The "Note to Guests" card only had Parking & Smoking notices. This adds a
-- general free-text notice with identical behaviour: 500-char cap, hidden on
-- the RSVP form when blank, translatable via content_translations.
--
-- Idempotent: guarded column add; the two touched functions are dropped and
-- recreated (upsert_wedding_page's signature grows a parameter, and
-- get_wedding_config's return type grows a column — neither is replaceable
-- in place).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Column ─────────────────────────────────────────────────────────────────
alter table public.weddings
  add column if not exists extra_notice text default '' check (char_length(extra_notice) <= 500);

-- ── 2. upsert_wedding_page — append p_extra_notice (18th parameter) ───────────
-- Superseded 17-arg signature from 0003_weddings_page.sql.
drop function if exists public.upsert_wedding_page(
  text, text, text, text, jsonb, date, boolean, text, text, text, boolean, text, text, jsonb, jsonb, jsonb, text
);

create function public.upsert_wedding_page(
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

-- ── 3. get_wedding_config — expose extra_notice (append-only return column) ───
-- Same visibility rationale as 0004: anon-callable, public display config only.
drop function if exists public.get_wedding_config();

create function public.get_wedding_config()
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
  is_runsheet_published   boolean,
  extra_notice            text
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
    -- Draft runsheets are couple-internal coordination data: anon callers get
    -- an empty list until the couple flips the publish toggle. auth.role() is
    -- 'authenticated' for any signed-in account (couple or helper) and
    -- 'anon' / null for the public key alone.
    case
      when coalesce(is_runsheet_published, false)
        or coalesce(auth.role(), '') = 'authenticated'
      then coalesce(runsheet, '[]'::jsonb)
      else '[]'::jsonb
    end,
    coalesce(is_runsheet_published, false),
    coalesce(extra_notice, '')
  from public.weddings
  limit 1;
$$;

-- Stays anon-callable: the PUBLIC RSVP form (RsvpPage.jsx) reads it to render the
-- couple's names/venue/theme and the enable_* flags. It is a read of non-secret
-- display config only (no guest data), so anon read is intentional, not a leak.
grant execute on function public.get_wedding_config() to anon, authenticated;
