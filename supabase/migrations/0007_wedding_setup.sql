-- Wedding Setup admin tab: replaces the server-only env vars
-- (WEDDING_DATE/CEREMONY_TIME/DINNER_TIME/VENUE_NAME/VENUE_ADDRESS/COUPLE_NAMES)
-- with a singleton `weddings` table the couple fills in through the admin UI.
--
-- Run this ONCE in the Supabase SQL Editor after 0001-0006 are applied.
-- Idempotent — safe to re-run.

-- ── 1. TABLE ───────────────────────────────────────────────────────────────────

create table if not exists public.weddings (
  id uuid primary key default gen_random_uuid(),
  bride_name text not null default '' check (char_length(bride_name) <= 120),
  groom_name text not null default '' check (char_length(groom_name) <= 120),
  wedding_date date,
  venue_name text not null default '' check (char_length(venue_name) <= 200),
  venue_address text not null default '' check (char_length(venue_address) <= 500),
  ceremony_time time,
  dinner_time time,
  updated_at timestamptz not null default now()
);

-- Singleton enforcement: only one row can ever exist in this table.
create unique index if not exists weddings_singleton_idx on public.weddings ((true));

alter table public.weddings enable row level security;

drop policy if exists "public" on public.weddings;
create policy "public" on public.weddings for all using (true) with check (true);

-- ── 2. RPCs ────────────────────────────────────────────────────────────────────

drop function if exists public.get_wedding_config();

create or replace function public.get_wedding_config()
returns table (
  id            uuid,
  bride_name    text,
  groom_name    text,
  wedding_date  date,
  venue_name    text,
  venue_address text,
  ceremony_time text,
  dinner_time   text
)
language sql
security definer
set search_path = public
as $$
  select
    id, bride_name, groom_name, wedding_date, venue_name, venue_address,
    to_char(ceremony_time, 'HH24:MI'),
    to_char(dinner_time, 'HH24:MI')
  from public.weddings
  limit 1;
$$;

grant execute on function public.get_wedding_config() to anon, authenticated;

drop function if exists public.upsert_wedding_config(text, text, date, text, text, text, text);

create or replace function public.upsert_wedding_config(
  p_bride_name    text,
  p_groom_name    text,
  p_wedding_date  date,
  p_venue_name    text,
  p_venue_address text,
  p_ceremony_time text,
  p_dinner_time   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.weddings (
    bride_name, groom_name, wedding_date, venue_name, venue_address,
    ceremony_time, dinner_time, updated_at
  ) values (
    left(coalesce(p_bride_name, ''), 120),
    left(coalesce(p_groom_name, ''), 120),
    p_wedding_date,
    left(coalesce(p_venue_name, ''), 200),
    left(coalesce(p_venue_address, ''), 500),
    p_ceremony_time::time,
    p_dinner_time::time,
    now()
  )
  on conflict ((true)) do update set
    bride_name    = excluded.bride_name,
    groom_name    = excluded.groom_name,
    wedding_date  = excluded.wedding_date,
    venue_name    = excluded.venue_name,
    venue_address = excluded.venue_address,
    ceremony_time = excluded.ceremony_time,
    dinner_time   = excluded.dinner_time,
    updated_at    = now();
end;
$$;

grant execute on function public.upsert_wedding_config(text, text, date, text, text, text, text)
  to anon, authenticated;
