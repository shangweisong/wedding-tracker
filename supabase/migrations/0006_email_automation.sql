-- Phase 3: Email automation (confirmation email + .ics + 90/30-day reminders)
--
-- Run this ONCE in the Supabase SQL Editor after 0001-0005 are applied.
-- Idempotent — safe to re-run.
--
-- After running this file, finish setup with two manual steps (cannot be
-- done from a migration — they depend on your deployed Vercel URL and a
-- secret you generate yourself):
--
--   select vault.create_secret('https://<your-app>.vercel.app/api/send-rsvp-email', 'rsvp_email_webhook_url');
--   select vault.create_secret('<a-long-random-string>', 'rsvp_email_webhook_secret');
--
-- The second value must also be set as the `RSVP_WEBHOOK_SECRET` env var on
-- the Vercel project — it's how api/send-rsvp-email.js verifies the request
-- actually came from this trigger and not a random caller.
--
-- Until both secrets exist, the trigger below silently no-ops (guests can
-- still RSVP normally; emails just won't send yet).

-- ── 1. NEW COLUMNS ON `guests` ────────────────────────────────────────────────

alter table public.guests
  add column if not exists email text not null default ''
    check (char_length(email) <= 254);

alter table public.guests
  add column if not exists last_reminder_sent_at timestamptz;

-- ── 2. RPC UPDATES — add `email` to the public RSVP surface ──────────────────

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
  email              text
)
language sql
security definer
set search_path = public
as $$
  select
    id, name, rsvp_status, meal_choice,
    plus_one_name, dietary_notes, relationship_group, friend_subgroup, party, rsvp_message,
    email
  from public.guests
  where rsvp_token = p_token;
$$;

grant execute on function public.get_guest_by_rsvp_token(uuid) to anon, authenticated;

drop function if exists public.submit_rsvp(uuid, text, text, text, text, text, text, text, text);

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
  p_email              text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid_groups  text[] := array['family', 'colleagues', 'friends', 'other', ''];
  v_valid_friends text[] := array['army', 'primary_school', 'secondary_school', 'tertiary', 'university', 'other', ''];
  v_valid_parties text[] := array['bride', 'groom', ''];
begin
  if p_status not in ('confirmed', 'declined') then
    raise exception 'invalid rsvp status: %', p_status;
  end if;

  update public.guests set
    rsvp_status        = p_status,
    rsvp_at             = now(),
    meal_choice         = left(coalesce(p_meal_choice, ''), 60),
    plus_one_name       = left(coalesce(p_plus_one_name, ''), 120),
    dietary_notes       = left(coalesce(p_dietary_notes, ''), 500),
    relationship_group  = case
      when p_relationship_group = any(v_valid_groups) then p_relationship_group
      else relationship_group
    end,
    friend_subgroup     = case
      when p_relationship_group = 'friends' and p_friend_subgroup = any(v_valid_friends)
        then p_friend_subgroup
      when p_relationship_group = any(v_valid_groups) and p_relationship_group != 'friends'
        then ''
      else friend_subgroup
    end,
    party               = case
      when p_party = any(v_valid_parties) and p_party != '' then p_party
      else party
    end,
    rsvp_message        = left(coalesce(p_message, ''), 500),
    email               = case
      when p_email != '' then left(coalesce(p_email, ''), 254)
      else email
    end
  where rsvp_token = p_token;

  if not found then
    raise exception 'invalid rsvp token';
  end if;
end;
$$;

grant execute on function public.submit_rsvp(uuid, text, text, text, text, text, text, text, text, text) to anon, authenticated;

drop function if exists public.submit_rsvp_by_name(text, text, text, text, text, text, text, text);

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
  v_valid_groups  text[] := array['family', 'colleagues', 'friends', 'other', ''];
  v_valid_friends text[] := array['army', 'primary_school', 'secondary_school', 'tertiary', 'university', 'other', ''];
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
    rsvp_status         = p_status,
    rsvp_at             = now(),
    meal_choice         = left(coalesce(p_meal_choice,   ''), 60),
    dietary_notes       = left(coalesce(p_dietary_notes, ''), 500),
    rsvp_message        = left(coalesce(p_message,       ''), 500),
    relationship_group  = case
      when p_relationship_group = any(v_valid_groups) then p_relationship_group
      else relationship_group
    end,
    friend_subgroup     = case
      when p_relationship_group = 'friends' and p_friend_subgroup = any(v_valid_friends)
        then p_friend_subgroup
      when p_relationship_group = any(v_valid_groups) and p_relationship_group != 'friends'
        then ''
      else friend_subgroup
    end,
    party               = case
      when p_party = any(v_valid_parties) and p_party != '' then p_party
      else party
    end,
    email               = case
      when p_email != '' then left(coalesce(p_email, ''), 254)
      else email
    end
  where id = v_match_id;
end;
$$;

grant execute on function public.submit_rsvp_by_name(text, text, text, text, text, text, text, text, text)
  to anon, authenticated;

-- ── 3. RSVP-STATUS-CHANGE WEBHOOK (confirmation email trigger) ───────────────
--
-- Fires server-side on any UPDATE to `guests` that flips `rsvp_status` into
-- 'confirmed' or 'declined' — regardless of whether the change came from the
-- public RSVP RPCs above or an admin edit in RsvpTab. Reads the webhook URL
-- + shared secret from Supabase Vault (see the setup comment at the top of
-- this file); no-ops if either secret hasn't been created yet.

create extension if not exists pg_net;

create or replace function public.notify_rsvp_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  if new.rsvp_status is distinct from old.rsvp_status
     and new.rsvp_status in ('confirmed', 'declined')
     and new.email != '' then

    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'rsvp_email_webhook_url';
    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'rsvp_email_webhook_secret';

    if v_url is not null and v_secret is not null then
      perform net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', v_secret
        ),
        body    := jsonb_build_object('guest_id', new.id)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guests_rsvp_status_webhook on public.guests;

create trigger guests_rsvp_status_webhook
  after update on public.guests
  for each row execute function public.notify_rsvp_status_change();
