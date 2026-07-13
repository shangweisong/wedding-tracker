-- ─────────────────────────────────────────────────────────────────────────────
-- 0009_open_rsvp.sql — open RSVP self-registration (#126)
--
-- Adds an opt-in mode where guests are NOT cross-checked against the guest
-- list: they type their name free-text on the public RSVP form and a guest
-- row is created for them. The mode is gated by a mandatory PIN chosen by the
-- couple (shared on the invitation), verified server-side — the pin value is
-- never exposed to anon callers. Hosts cross-check self-registered guests
-- (flagged via guests.self_registered) after the deadline.
--
-- Idempotent: guarded column adds; touched functions are dropped and
-- recreated (upsert_wedding_config's signature grows two parameters and
-- get_wedding_config's return type grows a column — neither is replaceable
-- in place).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Columns ────────────────────────────────────────────────────────────────
alter table public.weddings
  add column if not exists enable_open_rsvp boolean not null default false;

-- The pin is a shared low-entropy secret (like a wifi password on the
-- invitation card), not an account credential — stored plainly, but only ever
-- read back through couple-only RPCs.
alter table public.weddings
  add column if not exists rsvp_pin text not null default ''
    check (char_length(rsvp_pin) <= 20);

alter table public.guests
  add column if not exists self_registered boolean not null default false;

-- ── 2. Failed-PIN attempt log (brute-force rate limit) ────────────────────────
-- Single-tenant, so a global sliding window is enough: after 20 wrong PINs in
-- 15 minutes the form locks for everyone until attempts age out. A determined
-- attacker can at most lock the open form (annoying), not brute-force a PIN
-- (10k 4-digit combinations would take weeks at 20 tries / 15 min).
-- RLS with no policies: only the security-definer RPC (owner) touches it.
create table if not exists public.open_rsvp_pin_attempts (
  id           bigint generated always as identity primary key,
  attempted_at timestamptz not null default now()
);
alter table public.open_rsvp_pin_attempts enable row level security;

-- ── 3. register_open_rsvp — anon, finds-or-creates a guest, returns its token ─
-- Called by the public form at submit time; the returned rsvp_token then feeds
-- the existing submit_rsvp / submit_rsvp_events flow unchanged. Idempotent:
-- the same cleaned name always resolves to the same guest row (re-submissions
-- update instead of duplicating, and retries after a failed submit are safe).
--
-- Returns jsonb — {'token': uuid} on success, {'error': code} for PIN failures.
-- PIN failures are RETURNED rather than RAISED on purpose: an exception would
-- roll back the attempt-log insert and the rate limit above would never
-- accumulate. Config errors (disabled / bad name / row cap) still raise.
--
-- Name-reuse note: matching an existing primary guest by name hands back that
-- guest's real token. That is the same surface the long-standing anon
-- find_guest_by_name RPC already exposes WITHOUT any PIN (type a name, get the
-- token), so open mode is strictly tighter — and reuse is what keeps
-- re-submissions from duplicating pre-invited guests who use the open form.

drop function if exists public.register_open_rsvp(text, text);

create function public.register_open_rsvp(p_name text, p_pin text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_smart   boolean;
  v_pin     text;
  v_name    text;
  v_id      uuid;
  v_token   uuid;
begin
  select coalesce(w.enable_open_rsvp, false),
         coalesce(w.enable_smart_rsvp, false),
         trim(coalesce(w.rsvp_pin, ''))
    into v_enabled, v_smart, v_pin
    from public.weddings w
    limit 1;

  -- The PIN is mandatory for open mode; enabled-with-blank-pin (only reachable
  -- by editing the row outside upsert_wedding_config) fails closed.
  if not coalesce(v_enabled, false) or v_pin = '' then
    raise exception 'open rsvp disabled';
  end if;

  if (select count(*) from public.open_rsvp_pin_attempts
      where attempted_at > now() - interval '15 minutes') >= 20 then
    return jsonb_build_object('error', 'too_many_attempts');
  end if;

  if trim(coalesce(p_pin, '')) <> v_pin then
    delete from public.open_rsvp_pin_attempts
      where attempted_at < now() - interval '1 day';
    insert into public.open_rsvp_pin_attempts default values;
    return jsonb_build_object('error', 'invalid_pin');
  end if;

  v_name := left(trim(coalesce(p_name, '')), 120);
  if char_length(v_name) < 1 then
    raise exception 'invalid name';
  end if;

  -- Reuse an existing primary guest with the same cleaned name
  -- (case-insensitive) instead of inserting a duplicate.
  select g.id, g.rsvp_token
    into v_id, v_token
    from public.guests g
   where g.primary_guest_id is null
     and lower(trim(g.name)) = lower(v_name)
   order by g.created_at
   limit 1;

  if v_id is null then
    -- Cheap abuse guard on top of the PIN: cap total self-registered rows.
    if (select count(*) from public.guests where self_registered) >= 1000 then
      raise exception 'guest limit reached';
    end if;

    insert into public.guests (name, self_registered)
    values (v_name, true)
    returning id, rsvp_token into v_id, v_token;
  end if;

  -- Smart mode: a self-registered guest is invited to all active events so
  -- submit_rsvp_events accepts their answers. Only when the guest has no
  -- invitation rows at all — a matched pre-invited guest keeps the couple's
  -- curated set. Per the enrollment contract (0004 §2), seed status/meal from
  -- the guest's legacy answer so the mirror trigger can't regress a
  -- previously-confirmed guest to pending.
  if v_smart and not exists (
    select 1 from public.guest_event_rsvps ger where ger.guest_id = v_id
  ) then
    insert into public.guest_event_rsvps
      (guest_id, event_id, invited, status, meal_choice, responded_at)
    select v_id, e.id, true, g.rsvp_status, g.meal_choice, g.rsvp_at
      from public.wedding_events e
     cross join public.guests g
     where e.is_active and g.id = v_id
    on conflict (guest_id, event_id) do nothing;
  end if;

  return jsonb_build_object('token', v_token);
end;
$$;

-- Anon-callable by design: it exposes nothing beyond a token for the caller's
-- own typed name (strictly less than find_guest_by_name reveals, and only
-- behind the PIN), and every write it performs is bounded and sanitized.
revoke all on function public.register_open_rsvp(text, text) from public;
grant execute on function public.register_open_rsvp(text, text) to anon, authenticated;

-- ── 4. get_wedding_config — expose enable_open_rsvp (append-only column) ──────
-- Body copied from 0008; the pin itself is deliberately NOT selected — anon
-- callers only learn that open mode is on (the form then always asks for the
-- pin, since it is mandatory).
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
  extra_notice            text,
  enable_open_rsvp        boolean
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
    coalesce(extra_notice, ''),
    coalesce(enable_open_rsvp, false)
  from public.weddings
  limit 1;
$$;

-- Stays anon-callable: the PUBLIC RSVP form (RsvpPage.jsx) reads it to render the
-- couple's names/venue/theme and the enable_* flags. It is a read of non-secret
-- display config only (no guest data, no pin), so anon read is intentional.
grant execute on function public.get_wedding_config() to anon, authenticated;

-- ── 5. upsert_wedding_config — append p_enable_open_rsvp + p_rsvp_pin ─────────
-- Superseded 10-arg signature from 0004_smart_rsvp.sql.
drop function if exists public.upsert_wedding_config(
  text, text, date, text, text, text, text, text, boolean, uuid
);

create function public.upsert_wedding_config(
  p_bride_name        text,
  p_groom_name        text,
  p_wedding_date      date,
  p_venue_name        text,
  p_venue_address     text,
  p_ceremony_time     text,
  p_dinner_time       text,
  p_tea_ceremony_time text default null,
  p_enable_smart_rsvp boolean default false,
  p_primary_meal_event_id uuid default null,
  p_enable_open_rsvp  boolean default false,
  p_rsvp_pin          text default ''
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

  -- The PIN is mandatory whenever open mode is enabled (#126): a blank pin
  -- would leave the form open to anyone who finds the URL.
  if coalesce(p_enable_open_rsvp, false)
     and trim(coalesce(p_rsvp_pin, '')) = '' then
    raise exception 'rsvp pin required';
  end if;

  insert into public.weddings (
    bride_name, groom_name, wedding_date,
    venue_name, venue_address,
    ceremony_time, dinner_time, tea_ceremony_time,
    enable_smart_rsvp, primary_meal_event_id,
    enable_open_rsvp, rsvp_pin,
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
    coalesce(p_enable_smart_rsvp, false),
    p_primary_meal_event_id,
    coalesce(p_enable_open_rsvp, false),
    left(trim(coalesce(p_rsvp_pin, '')), 20),
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
    enable_smart_rsvp = excluded.enable_smart_rsvp,
    primary_meal_event_id = excluded.primary_meal_event_id,
    enable_open_rsvp  = excluded.enable_open_rsvp,
    rsvp_pin          = excluded.rsvp_pin,
    updated_at        = now();
end;
$$;

revoke all on function public.upsert_wedding_config(
  text, text, date, text, text, text, text, text, boolean, uuid, boolean, text
) from public, anon;
grant execute on function public.upsert_wedding_config(
  text, text, date, text, text, text, text, text, boolean, uuid, boolean, text
) to authenticated;

-- ── 6. get_open_rsvp_admin_config — couple-only pin readback ──────────────────
-- Mirrors get_budget_config (0006): served separately from get_wedding_config
-- so anon (and the helper) can never see the pin; the couple needs it to
-- pre-fill the Wedding Setup form.
drop function if exists public.get_open_rsvp_admin_config();

create function public.get_open_rsvp_admin_config()
returns table (rsvp_pin text)
language sql
security definer
set search_path = public
as $$
  select coalesce(rsvp_pin, '')
  from public.weddings
  where not (select public.is_helper())
  limit 1;
$$;

revoke all on function public.get_open_rsvp_admin_config() from public, anon;
grant execute on function public.get_open_rsvp_admin_config() to authenticated;
