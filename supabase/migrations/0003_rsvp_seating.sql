-- RSVP Collection + Table Assignment Planning
--
-- Consolidated from: 0003_phase2_rsvp_seating, 0004_fuzzy_rsvp_by_name,
--                    0005_phase3_relationship_taxonomy, 0006_email_automation (columns + RPCs only)
--
-- Email webhook trigger is intentionally excluded — see 0005_email_automation.sql
-- (optional, apply only after Resend + Vercel are configured).
--
-- Security model:
--   - `tables` table: authenticated helpers only.
--   - New `guests` columns: inherit existing guests RLS automatically.
--   - Public RSVP access is via three security-definer RPCs granted to anon —
--     they expose only the minimum fields needed for a guest to complete their RSVP.

-- ── 1. TRIGRAM EXTENSION (fuzzy name search) ──────────────────────────────────

create extension if not exists pg_trgm;

-- ── 2. `tables` TABLE ─────────────────────────────────────────────────────────

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

-- ── 3. NEW COLUMNS ON `guests` ────────────────────────────────────────────────

alter table public.guests
  add column if not exists rsvp_status text not null default 'pending'
    check (rsvp_status in ('pending', 'confirmed', 'declined'));

alter table public.guests
  add column if not exists rsvp_at timestamptz;

alter table public.guests
  add column if not exists meal_choice text not null default ''
    check (char_length(meal_choice) <= 60);

alter table public.guests
  add column if not exists plus_one_name text not null default ''
    check (char_length(plus_one_name) <= 120);

alter table public.guests
  add column if not exists dietary_notes text not null default ''
    check (char_length(dietary_notes) <= 500);

alter table public.guests
  add column if not exists phone text not null default ''
    check (char_length(phone) <= 30);

-- Final two-tier taxonomy: broad category + friend subtype.
-- (Replaces the earlier flat enum that included uni_friends, secondary_school, etc.)
alter table public.guests
  add column if not exists relationship_group text not null default ''
    check (relationship_group in ('', 'family', 'colleagues', 'friends', 'other', 'complicated'));

alter table public.guests
  add column if not exists friend_subgroup text not null default ''
    check (friend_subgroup in (
      '', 'army', 'primary_school', 'secondary_school', 'tertiary', 'university', 'other', 'secret'
    ));

-- Re-assert the taxonomy CHECKs so existing DBs (where the columns already
-- exist, making `add column if not exists` a no-op) pick up newly-allowed
-- values — e.g. the opt-in "fun" RSVP options 'complicated' / 'secret' (#42).
alter table public.guests drop constraint if exists guests_relationship_group_check;
alter table public.guests
  add constraint guests_relationship_group_check
    check (relationship_group in ('', 'family', 'colleagues', 'friends', 'other', 'complicated'));

alter table public.guests drop constraint if exists guests_friend_subgroup_check;
alter table public.guests
  add constraint guests_friend_subgroup_check
    check (friend_subgroup in (
      '', 'army', 'primary_school', 'secondary_school', 'tertiary', 'university', 'other', 'secret'
    ));

-- "Do you want to give a speech?" — three-state answer collected on the RSVP
-- form: '' (unanswered), 'yes', or 'no' (#40).
alter table public.guests
  add column if not exists wants_to_speak text not null default ''
    check (wants_to_speak in ('', 'yes', 'no'));

-- Plus-x: additional guests a primary RSVPs for become their own guest rows,
-- linked back to the primary. NULL for primary guests. Cascade so removing a
-- primary removes the party they registered (#38).
alter table public.guests
  add column if not exists primary_guest_id uuid
    references public.guests(id) on delete cascade;

create index if not exists guests_primary_guest_id_idx
  on public.guests(primary_guest_id);

-- Backfill the legacy single plus_one_name into a child guest row, then clear
-- it so children are the single source of truth. Idempotent: both steps skip
-- primaries that already have a matching child (#38).
insert into public.guests (name, primary_guest_id, party, rsvp_status)
select left(trim(g.plus_one_name), 120), g.id, g.party, g.rsvp_status
from public.guests g
where g.primary_guest_id is null
  and coalesce(trim(g.plus_one_name), '') <> ''
  and not exists (
    select 1 from public.guests c
    where c.primary_guest_id = g.id
      and lower(trim(c.name)) = lower(trim(g.plus_one_name))
  );

update public.guests g set plus_one_name = ''
where g.primary_guest_id is null
  and coalesce(trim(g.plus_one_name), '') <> ''
  and exists (
    select 1 from public.guests c
    where c.primary_guest_id = g.id
      and lower(trim(c.name)) = lower(trim(g.plus_one_name))
  );

alter table public.guests
  add column if not exists rsvp_message text not null default ''
    check (char_length(rsvp_message) <= 500);

-- Unique token for personalised RSVP links (/rsvp?token=<rsvp_token>)
alter table public.guests
  add column if not exists rsvp_token uuid not null default gen_random_uuid();

create unique index if not exists guests_rsvp_token_idx
  on public.guests(rsvp_token);

alter table public.guests
  add column if not exists table_id uuid
    references public.tables(id) on delete set null;

-- Email — collected at RSVP time, used for calendar invite + reminder emails.
alter table public.guests
  add column if not exists email text not null default ''
    check (char_length(email) <= 254);

-- Tracks last reminder send to prevent duplicate 90/30-day nudges.
alter table public.guests
  add column if not exists last_reminder_sent_at timestamptz;

-- Constrain party to valid values (column already exists from 0001_init.sql).
alter table public.guests drop constraint if exists guests_party_check;
alter table public.guests
  add constraint guests_party_check check (party in ('', 'bride', 'groom'));

-- ── 4. RSVP RPC FUNCTIONS ─────────────────────────────────────────────────────

-- 4a. Look up a guest by their personalised token.
drop function if exists public.get_guest_by_rsvp_token(uuid);

create or replace function public.get_guest_by_rsvp_token(p_token uuid)
returns table (
  id                 uuid,
  name               text,
  rsvp_status        text,
  meal_choice        text,
  plus_one_name      text,
  dietary_notes      text,
  relationship_group text,
  friend_subgroup    text,
  party              text,
  rsvp_message       text,
  email              text,
  wants_to_speak     text,
  plus_one_names     text[]
)
language sql
security definer
set search_path = public
as $$
  select
    g.id, g.name, g.rsvp_status, g.meal_choice,
    g.plus_one_name, g.dietary_notes, g.relationship_group, g.friend_subgroup, g.party, g.rsvp_message,
    g.email, g.wants_to_speak,
    coalesce(
      array(
        select c.name from public.guests c
        where c.primary_guest_id = g.id
        order by c.name
      ),
      '{}'
    )
  from public.guests g
  where g.rsvp_token = p_token;
$$;

grant execute on function public.get_guest_by_rsvp_token(uuid) to anon, authenticated;

-- 4b. Submit an RSVP via personalised token.
drop function if exists public.submit_rsvp(uuid, text, text, text, text, text, text);
drop function if exists public.submit_rsvp(uuid, text, text, text, text, text, text, text, text);
drop function if exists public.submit_rsvp(uuid, text, text, text, text, text, text, text, text, text);
drop function if exists public.submit_rsvp(uuid, text, text, text, text, text, text, text, text, text, text);

create or replace function public.submit_rsvp(
  p_token              uuid,
  p_status             text,
  p_meal_choice        text default '',
  p_plus_one_name      text default '',
  p_dietary_notes      text default '',
  p_relationship_group text default '',
  p_friend_subgroup    text default '',
  p_party              text default '',
  p_message            text default '',
  p_email              text default '',
  p_wants_to_speak     text default '',
  p_plus_one_names     text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid_groups  text[] := array['family', 'colleagues', 'friends', 'other', 'complicated', ''];
  v_valid_friends text[] := array['army', 'primary_school', 'secondary_school', 'tertiary', 'university', 'other', 'secret', ''];
  v_valid_parties text[] := array['bride', 'groom', ''];
  v_primary_id    uuid;
  v_party         text;
  v_clean         text[];
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
      when p_relationship_group = any(v_valid_groups) then p_relationship_group
      else relationship_group
    end,
    friend_subgroup    = case
      when p_relationship_group = 'friends' and p_friend_subgroup = any(v_valid_friends)
        then p_friend_subgroup
      when p_relationship_group = any(v_valid_groups) and p_relationship_group != 'friends'
        then ''
      else friend_subgroup
    end,
    party              = case
      when p_party = any(v_valid_parties) and p_party != '' then p_party
      else party
    end,
    rsvp_message       = left(coalesce(p_message, ''), 500),
    email              = case
      when p_email != '' then left(coalesce(p_email, ''), 254)
      else email
    end,
    wants_to_speak     = case
      when p_wants_to_speak in ('', 'yes', 'no') then p_wants_to_speak
      else wants_to_speak
    end
  where rsvp_token = p_token;

  if not found then
    raise exception 'invalid rsvp token';
  end if;

  -- ── Plus-x reconciliation (#38) ──────────────────────────────────────────
  -- Resolve the primary and the party it should be filed under.
  select id,
         case when p_party = any(v_valid_parties) and p_party != '' then p_party else party end
    into v_primary_id, v_party
  from public.guests where rsvp_token = p_token;

  -- Clean requested names: trim, drop blanks, cap length, dedupe, cap at 6.
  select coalesce(array_agg(nm), '{}')
    into v_clean
  from (
    select distinct left(trim(n), 120) as nm
    from unnest(coalesce(p_plus_one_names, '{}')) as t(n)
    where trim(coalesce(n, '')) <> ''
  ) d;
  if array_length(v_clean, 1) > 6 then
    v_clean := v_clean[1:6];
  end if;

  -- Remove children no longer listed (preserves table/check-in for kept names).
  delete from public.guests
  where primary_guest_id = v_primary_id
    and lower(trim(name)) <> all (select lower(x) from unnest(v_clean) as x);

  -- Keep kept children's party in sync with the primary's current side.
  update public.guests
  set party = v_party
  where primary_guest_id = v_primary_id;

  -- Add newly-listed names not already present as a child of this primary.
  insert into public.guests (name, primary_guest_id, party, rsvp_status)
  select nm, v_primary_id, v_party, p_status
  from unnest(v_clean) as nm
  where lower(trim(nm)) not in (
    select lower(trim(name)) from public.guests where primary_guest_id = v_primary_id
  );
end;
$$;

grant execute on function public.submit_rsvp(uuid, text, text, text, text, text, text, text, text, text, text, text[]) to anon, authenticated;

-- 4c. Fuzzy name-based RSVP submission (fallback when no token link).
--     Raises: 'not_found' | 'ambiguous' | 'invalid_status'
--     Known issue: substring fallback can report 'ambiguous' when a guest's
--     full name is a prefix of another guest's name. See GitHub issue #18.
drop function if exists public.submit_rsvp_by_name(text, text, text, text, text);
drop function if exists public.submit_rsvp_by_name(text, text, text, text, text, text, text, text);
drop function if exists public.submit_rsvp_by_name(text, text, text, text, text, text, text, text, text);

create or replace function public.submit_rsvp_by_name(
  p_name               text,
  p_status             text,
  p_meal_choice        text default '',
  p_dietary_notes      text default '',
  p_message            text default '',
  p_relationship_group text default '',
  p_friend_subgroup    text default '',
  p_party              text default '',
  p_email              text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids           uuid[];
  v_match_id      uuid;
  v_valid_groups  text[] := array['family', 'colleagues', 'friends', 'other', 'complicated', ''];
  v_valid_friends text[] := array['army', 'primary_school', 'secondary_school', 'tertiary', 'university', 'other', 'secret', ''];
  v_valid_parties text[] := array['bride', 'groom', ''];
begin
  if p_status not in ('confirmed', 'declined') then
    raise exception 'invalid_status';
  end if;

  select array_agg(id)
  into v_ids
  from public.guests
  where similarity(lower(trim(name)), lower(trim(p_name))) >= 0.4
     or lower(name) like '%' || lower(trim(p_name)) || '%';

  if v_ids is null or array_length(v_ids, 1) = 0 then
    raise exception 'not_found';
  end if;

  if array_length(v_ids, 1) > 1 then
    raise exception 'ambiguous';
  end if;

  v_match_id := v_ids[1];

  update public.guests set
    rsvp_status        = p_status,
    rsvp_at            = now(),
    meal_choice        = left(coalesce(p_meal_choice,   ''), 60),
    dietary_notes      = left(coalesce(p_dietary_notes, ''), 500),
    rsvp_message       = left(coalesce(p_message,       ''), 500),
    relationship_group = case
      when p_relationship_group = any(v_valid_groups) then p_relationship_group
      else relationship_group
    end,
    friend_subgroup    = case
      when p_relationship_group = 'friends' and p_friend_subgroup = any(v_valid_friends)
        then p_friend_subgroup
      when p_relationship_group = any(v_valid_groups) and p_relationship_group != 'friends'
        then ''
      else friend_subgroup
    end,
    party              = case
      when p_party = any(v_valid_parties) and p_party != '' then p_party
      else party
    end,
    email              = case
      when p_email != '' then left(coalesce(p_email, ''), 254)
      else email
    end
  where id = v_match_id;
end;
$$;

grant execute on function public.submit_rsvp_by_name(text, text, text, text, text, text, text, text, text)
  to anon, authenticated;

-- 4d. Partial name lookup for the no-token RSVP flow.
--     Returns name + token only (no other guest data), max 5 results.
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
    and primary_guest_id is null  -- plus-ones don't self-RSVP (#38)
    and lower(name) like '%' || lower(trim(p_name)) || '%'
  order by
    case when lower(trim(name)) = lower(trim(p_name)) then 0 else 1 end,
    name
  limit 5;
$$;

grant execute on function public.find_guest_by_name(text) to anon, authenticated;
