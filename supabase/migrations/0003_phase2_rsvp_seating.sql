-- Phase 2: RSVP Collection + Table Assignment Planning
--
-- Run this ONCE in the Supabase SQL Editor (or via `supabase db push`) after
-- 0001_init.sql is already applied. All statements are idempotent (if not exists).
--
-- Security model:
--   - `tables` table: authenticated helpers only (same RLS pattern as `guests`).
--   - New `guests` columns: automatically inherit the existing `guests` RLS.
--   - Public RSVP access is handled by three `security definer` RPC functions
--     that are granted to `anon` — they expose only the minimum fields needed
--     for a guest to complete their RSVP, without opening the guest list to
--     the public anon key.

-- ── 1. NEW `tables` TABLE ─────────────────────────────────────────────────────

create table if not exists public.tables (
  id           uuid        primary key default gen_random_uuid(),
  table_number text        not null check (char_length(table_number) between 1 and 20),
  label        text        not null default '' check (char_length(label) <= 80),
  capacity     int         not null default 10 check (capacity between 1 and 50),
  is_locked    boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists tables_set_updated_at on public.tables;
create trigger tables_set_updated_at
  before update on public.tables
  for each row execute function public.set_updated_at();

alter table public.tables enable row level security;

drop policy if exists "helpers_select" on public.tables;
drop policy if exists "helpers_insert" on public.tables;
drop policy if exists "helpers_update" on public.tables;
drop policy if exists "helpers_delete" on public.tables;

create policy "helpers_select" on public.tables for select to authenticated using (true);
create policy "helpers_insert" on public.tables for insert to authenticated with check (true);
create policy "helpers_update" on public.tables for update to authenticated using (true) with check (true);
create policy "helpers_delete" on public.tables for delete to authenticated using (true);

-- ── 2. NEW COLUMNS ON `guests` ────────────────────────────────────────────────

-- RSVP tracking
alter table public.guests
  add column if not exists rsvp_status text not null default 'pending'
    check (rsvp_status in ('pending', 'confirmed', 'declined'));

alter table public.guests
  add column if not exists rsvp_at timestamptz;

-- Meal & dietary
alter table public.guests
  add column if not exists meal_choice text not null default ''
    check (char_length(meal_choice) <= 60);

alter table public.guests
  add column if not exists plus_one_name text not null default ''
    check (char_length(plus_one_name) <= 120);

alter table public.guests
  add column if not exists dietary_notes text not null default ''
    check (char_length(dietary_notes) <= 500);

-- Contact (for future WhatsApp / email)
alter table public.guests
  add column if not exists phone text not null default ''
    check (char_length(phone) <= 30);

-- Relationship group — includes Phase 3 options now to avoid a later migration
alter table public.guests
  add column if not exists relationship_group text not null default ''
    check (relationship_group in (
      '', 'family', 'uni_friends', 'secondary_school', 'primary_school',
      'colleagues', 'childhood_friends', 'neighbours', 'other'
    ));

-- Guest message to the couple (submitted via RSVP form)
alter table public.guests
  add column if not exists rsvp_message text not null default ''
    check (char_length(rsvp_message) <= 500);

-- Unique token for personalised RSVP links (/rsvp?token=<rsvp_token>)
-- gen_random_uuid() backfills existing rows automatically.
alter table public.guests
  add column if not exists rsvp_token uuid not null default gen_random_uuid();

create unique index if not exists guests_rsvp_token_idx
  on public.guests(rsvp_token);

-- Seating plan assignment (Phase 2 table assignment; table_number text field
-- is left unchanged for the Phase 1 wedding-day table view).
alter table public.guests
  add column if not exists table_id uuid
    references public.tables(id) on delete set null;

-- ── 3. RPC FUNCTIONS FOR PUBLIC RSVP ACCESS ───────────────────────────────────
--
-- These are the only surface exposed to `anon`. Each is `security definer`
-- (runs as the function owner, not the caller) and returns/updates only the
-- minimum fields required for a guest to complete their own RSVP.

-- 3a. Look up a guest by their personalised token.
--     Returns one row (limited fields) or zero rows if the token is unknown.
create or replace function public.get_guest_by_rsvp_token(p_token uuid)
returns table (
  id                uuid,
  name              text,
  rsvp_status       text,
  meal_choice       text,
  plus_one_name     text,
  dietary_notes     text,
  relationship_group text,
  rsvp_message      text
)
language sql
security definer
set search_path = public
as $$
  select
    id, name, rsvp_status, meal_choice,
    plus_one_name, dietary_notes, relationship_group, rsvp_message
  from public.guests
  where rsvp_token = p_token;
$$;

grant execute on function public.get_guest_by_rsvp_token(uuid) to anon, authenticated;

-- 3b. Submit an RSVP response. Validates inputs and only writes RSVP columns.
--     Raises an exception (surfaced to the caller as a 400) on bad token or
--     invalid status.
create or replace function public.submit_rsvp(
  p_token             uuid,
  p_status            text,
  p_meal_choice       text    default '',
  p_plus_one_name     text    default '',
  p_dietary_notes     text    default '',
  p_relationship_group text   default '',
  p_message           text    default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid_groups text[] := array[
    'family', 'uni_friends', 'secondary_school', 'primary_school',
    'colleagues', 'childhood_friends', 'neighbours', 'other', ''
  ];
begin
  if p_status not in ('confirmed', 'declined') then
    raise exception 'invalid rsvp status: %', p_status;
  end if;

  update public.guests set
    rsvp_status        = p_status,
    rsvp_at            = now(),
    meal_choice        = left(coalesce(p_meal_choice, ''), 60),
    plus_one_name      = left(coalesce(p_plus_one_name, ''), 120),
    dietary_notes      = left(coalesce(p_dietary_notes, ''), 500),
    relationship_group = case
      when p_relationship_group = any(v_valid_groups)
        then p_relationship_group
      else relationship_group
    end,
    rsvp_message       = left(coalesce(p_message, ''), 500)
  where rsvp_token = p_token;

  if not found then
    raise exception 'invalid rsvp token';
  end if;
end;
$$;

grant execute on function public.submit_rsvp(uuid, text, text, text, text, text, text) to anon, authenticated;

-- 3c. Partial name lookup — guests type any part of their name (first, last,
--     or full). Returns name + token only (no other guest fields), limit 5
--     to prevent enumeration abuse. Requires at least 2 characters.
create or replace function public.find_guest_by_name(p_name text)
returns table (
  id         uuid,
  name       text,
  rsvp_token uuid
)
language sql
security definer
set search_path = public
as $$
  select id, name, rsvp_token
  from public.guests
  where char_length(trim(p_name)) >= 2
    and lower(name) like '%' || lower(trim(p_name)) || '%'
  order by
    case when lower(trim(name)) = lower(trim(p_name)) then 0 else 1 end,
    name
  limit 5;
$$;

grant execute on function public.find_guest_by_name(text) to anon, authenticated;
