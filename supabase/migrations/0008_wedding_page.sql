-- Phase 3.3 — Public Wedding Page
-- Adds page-specific columns to `weddings` and the supporting RPCs.
-- Run in Supabase SQL Editor after migrations 0001–0007.

-- ── 1. NEW COLUMNS ─────────────────────────────────────────────────────────────

alter table public.weddings
  add column if not exists slug            text unique,
  add column if not exists love_story      text    default '',
  add column if not exists dress_code      text    default '',
  add column if not exists hero_image_url  text    default '',
  add column if not exists fun_qa          jsonb   default '[]',
  add column if not exists rsvp_deadline   date,
  add column if not exists is_published    boolean default false,
  add column if not exists meal_options    text    default '';

-- ── 2. STORAGE BUCKET ──────────────────────────────────────────────────────────

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

-- ── 3. UPDATE get_wedding_config() — now returns page fields too ────────────────

drop function if exists public.get_wedding_config();

create or replace function public.get_wedding_config()
returns table (
  id              uuid,
  bride_name      text,
  groom_name      text,
  wedding_date    date,
  venue_name      text,
  venue_address   text,
  ceremony_time   text,
  dinner_time     text,
  slug            text,
  love_story      text,
  dress_code      text,
  hero_image_url  text,
  fun_qa          jsonb,
  rsvp_deadline   date,
  is_published    boolean,
  meal_options    text
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
    to_char(ceremony_time, 'HH24:MI'),
    to_char(dinner_time,   'HH24:MI'),
    coalesce(slug, ''),
    coalesce(love_story, ''),
    coalesce(dress_code, ''),
    coalesce(hero_image_url, ''),
    coalesce(fun_qa, '[]'::jsonb),
    rsvp_deadline,
    coalesce(is_published, false),
    coalesce(meal_options, '')
  from public.weddings
  limit 1;
$$;

grant execute on function public.get_wedding_config() to anon, authenticated;

-- ── 4. upsert_wedding_config() — unchanged signature, backward compatible ───────
-- (The old 7-param function is kept as-is; no change needed here.)

-- ── 5. NEW RPC: upsert_wedding_page ─────────────────────────────────────────────

drop function if exists public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text);

create or replace function public.upsert_wedding_page(
  p_slug            text,
  p_love_story      text,
  p_dress_code      text,
  p_hero_image_url  text,
  p_fun_qa          jsonb,
  p_rsvp_deadline   date,
  p_is_published    boolean,
  p_meal_options    text
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
    updated_at
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
    updated_at     = now();
end;
$$;

grant execute on function public.upsert_wedding_page(text, text, text, text, jsonb, date, boolean, text)
  to anon, authenticated;

-- ── 6. PUBLIC PAGE LOOKUP BY SLUG ───────────────────────────────────────────────

drop function if exists public.get_public_wedding(text);

create or replace function public.get_public_wedding(p_slug text)
returns table (
  bride_name      text,
  groom_name      text,
  wedding_date    date,
  venue_name      text,
  venue_address   text,
  ceremony_time   text,
  dinner_time     text,
  slug            text,
  love_story      text,
  dress_code      text,
  hero_image_url  text,
  fun_qa          jsonb,
  rsvp_deadline   date,
  is_published    boolean,
  meal_options    text
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
    to_char(ceremony_time, 'HH24:MI'),
    to_char(dinner_time,   'HH24:MI'),
    slug,
    coalesce(love_story, ''),
    coalesce(dress_code, ''),
    coalesce(hero_image_url, ''),
    coalesce(fun_qa, '[]'::jsonb),
    rsvp_deadline,
    coalesce(is_published, false),
    coalesce(meal_options, '')
  from public.weddings
  where slug = p_slug
  limit 1;
$$;

grant execute on function public.get_public_wedding(text) to anon, authenticated;
