-- 0004_smart_rsvp.sql — Smart RSVP: per-event attendance tracking (#78)
--
-- Consolidated from: 0009_smart_rsvp,
--                    0015_guard_config_rpcs (§1 upsert_wedding_config),
--                    0017_guard_runsheet (§2 get_wedding_config),
--                    0010_event_audiences (audience_groups + final
--                    get_public_events / get_guest_by_rsvp_token),
--                    0008/0009/0011 config-RPC growth (final get_wedding_config /
--                    upsert_wedding_config bodies from 0011_photowall)
--
-- Adds a couple-defined event list (`wedding_events`) and a per-body × per-event
-- RSVP junction (`guest_event_rsvps`), so guests can RSVP to each event (tea
-- ceremony, solemnisation, banquet…) individually instead of a single wedding-wide
-- yes/no. Gated by `weddings.enable_smart_rsvp`; when OFF the app behaves exactly
-- as before (no events, no junction rows, legacy scalar columns untouched).
--
-- Design:
--   * Eligibility (`invited`) is primary-authoritative; plus-one child guest rows
--     inherit the primary's invited event set. Each body carries its own per-event
--     status + meal_choice, so per-event headcount = count of confirmed rows,
--     consistent with the legacy "headcount = confirmed guest rows".
--   * Legacy `guests.rsvp_status` / `meal_choice` / `rsvp_at` are kept as DERIVED
--     mirror columns, written by a trigger on `guest_event_rsvps`, so seating,
--     wishes-wrapped, emails, and existing RSVP stats keep working unchanged.
--
-- Security model: both new tables are `authenticated`-only (policies in
-- 0005_roles_security.sql). `anon` reaches events only through security-definer
-- RPCs — `get_public_events` (active events by slug, no guest data),
-- `get_guest_by_rsvp_token` (token-scoped), and `submit_rsvp_events` (validates
-- every event_id is in the party's invited set).
--
-- This file also holds the final get_wedding_config / upsert_wedding_config:
-- both expose the smart-RSVP fields, so they must be created after the tables
-- and columns defined here.

-- ── 1. `wedding_events` TABLE ─────────────────────────────────────────────────

create table if not exists public.wedding_events (
  id                   uuid        primary key default gen_random_uuid(),
  wedding_id           uuid        not null references public.weddings(id) on delete cascade,
  name                 text        not null default '' check (char_length(name) <= 120),
  event_date           date,                 -- null → inherit weddings.wedding_date
  start_time           time,
  location             text        not null default '' check (char_length(location) <= 300),
  requires_meal        boolean     not null default false,
  requires_headcount   boolean     not null default true,
  is_active            boolean     not null default true,  -- soft-delete / hide
  sort_order           int         not null default 0,
  content_translations jsonb       not null default '{}',  -- { "<locale>": { name, location } }
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Covers both "all events for a wedding" and the active/ordered timeline read;
-- a standalone (wedding_id) index would be a redundant prefix of this one.
create index if not exists wedding_events_active_sort_idx
  on public.wedding_events(wedding_id, is_active, sort_order);

drop trigger if exists wedding_events_set_updated_at on public.wedding_events;
create trigger wedding_events_set_updated_at
  before update on public.wedding_events
  for each row execute function public.set_updated_at();

alter table public.wedding_events enable row level security;
-- Policies: 0005_roles_security.sql.

-- Relationship-targeted events (#131): restrict an event to relationship groups
-- (family/friends/colleagues/other); an empty array means "everyone". The
-- filter is applied client-side on the public RSVP form as a declutter — it is
-- NOT a security boundary (relationship_group is guest-selected on the form);
-- the real per-guest gate stays guest_event_rsvps.invited.
alter table public.wedding_events
  add column if not exists audience_groups text[] not null default '{}';

alter table public.wedding_events
  drop constraint if exists wedding_events_audience_groups_check;
alter table public.wedding_events
  add constraint wedding_events_audience_groups_check
  check (audience_groups <@ array['family','friends','colleagues','other']::text[]);

-- ── 2. `guest_event_rsvps` JUNCTION (per body × per event) ─────────────────────
--
-- Enrollment contract (for the Phase 4 targeting UI): when first materializing a
-- primary's invited rows for a guest who already answered under the legacy flow,
-- seed the new row's `status` (and `meal_choice`) from that guest's current
-- `guests.rsvp_status` / `meal_choice` rather than the `pending` default —
-- otherwise the mirror trigger will regress an already-confirmed guest to pending.

create table if not exists public.guest_event_rsvps (
  guest_id      uuid        not null references public.guests(id)         on delete cascade,
  event_id      uuid        not null references public.wedding_events(id) on delete cascade,
  invited       boolean     not null default false,       -- eligibility (primary-authoritative)
  status        text        not null default 'pending'
                  check (status in ('pending', 'confirmed', 'declined')),
  meal_choice   text        not null default '' check (char_length(meal_choice) <= 60),
  dietary_notes text        not null default '' check (char_length(dietary_notes) <= 500),
  responded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (guest_id, event_id)
);

-- guest_id is already covered by the (guest_id, event_id) PK prefix; this index
-- serves lookups/filters by event (e.g. per-event stats).
create index if not exists ger_event_status_idx  on public.guest_event_rsvps(event_id, status);

drop trigger if exists guest_event_rsvps_set_updated_at on public.guest_event_rsvps;
create trigger guest_event_rsvps_set_updated_at
  before update on public.guest_event_rsvps
  for each row execute function public.set_updated_at();

alter table public.guest_event_rsvps enable row level security;
-- Policies: 0005_roles_security.sql.

-- ── 3. DESIGNATED MEAL EVENT ON `weddings` ────────────────────────────────────
-- (enable_smart_rsvp itself is created with the table in 0003_weddings_page.sql;
-- this FK column must wait until wedding_events exists.)

-- Which event feeds the legacy `guests.meal_choice` mirror (e.g. the banquet).
alter table public.weddings
  add column if not exists primary_meal_event_id uuid
    references public.wedding_events(id) on delete set null;

-- ── 4. BACK-COMPAT MIRROR (guest_event_rsvps → legacy guests columns) ──────────

-- Recompute one guest's legacy scalar RSVP fields from its per-event rows.
-- No invited rows → leave the legacy columns untouched (covers flag-OFF and
-- untargeted guests, whose legacy values remain the source of truth).
create or replace function public.recompute_guest_rsvp_mirror(p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meal_event uuid;
  v_count      int;
  v_status     text;
  v_meal       text := '';
  v_dietary    text := '';
  v_at         timestamptz;
begin
  if p_guest_id is null then
    return;
  end if;

  select count(*) into v_count
  from public.guest_event_rsvps
  where guest_id = p_guest_id and invited;

  if v_count = 0 then
    return;
  end if;

  -- confirmed if any invited event is confirmed; declined if every invited event
  -- is declined; otherwise pending.
  select case
           when count(*) filter (where status = 'confirmed') > 0 then 'confirmed'
           when count(*) filter (where status = 'declined') = v_count then 'declined'
           else 'pending'
         end,
         max(responded_at)
    into v_status, v_at
  from public.guest_event_rsvps
  where guest_id = p_guest_id and invited;

  -- Legacy meal_choice / dietary_notes mirror the designated meal event's row.
  select primary_meal_event_id into v_meal_event from public.weddings limit 1;
  if v_meal_event is not null then
    select coalesce(meal_choice, ''), coalesce(dietary_notes, '')
      into v_meal, v_dietary
    from public.guest_event_rsvps
    where guest_id = p_guest_id and event_id = v_meal_event and invited;
    v_meal    := coalesce(v_meal, '');
    v_dietary := coalesce(v_dietary, '');
  end if;

  -- When no meal event is designated (misconfiguration), preserve the existing
  -- legacy meal/dietary values rather than wiping them.
  update public.guests set
    rsvp_status   = v_status,
    meal_choice   = case when v_meal_event is null then meal_choice   else left(v_meal, 60)     end,
    dietary_notes = case when v_meal_event is null then dietary_notes else left(v_dietary, 500) end,
    rsvp_at       = v_at
  where id = p_guest_id;
end;
$$;

-- Internal mirror helper — never called directly by clients (the trigger below
-- is the only caller). Revoke the implicit PUBLIC execute grant so anon cannot
-- invoke it on an arbitrary guest id (mirrors 0001_core's assign_draw_number revoke).
revoke execute on function public.recompute_guest_rsvp_mirror(uuid) from public;

create or replace function public.tg_guest_event_rsvps_mirror()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_guest_rsvp_mirror(old.guest_id);
    return old;
  end if;
  perform public.recompute_guest_rsvp_mirror(new.guest_id);
  if tg_op = 'UPDATE' and new.guest_id is distinct from old.guest_id then
    perform public.recompute_guest_rsvp_mirror(old.guest_id);
  end if;
  return new;
end;
$$;

drop trigger if exists guest_event_rsvps_mirror on public.guest_event_rsvps;
create trigger guest_event_rsvps_mirror
  after insert or update or delete on public.guest_event_rsvps
  for each row execute function public.tg_guest_event_rsvps_mirror();

-- ── 5. PUBLIC PAGE: active events by slug (anon) ──────────────────────────────

drop function if exists public.get_public_events(text);

create or replace function public.get_public_events(p_slug text)
returns table (
  id                 uuid,
  name               text,
  event_date         date,
  start_time         text,
  location           text,
  requires_meal      boolean,
  requires_headcount boolean,
  sort_order         int,
  content_translations jsonb,
  audience_groups    text[]
)
language sql
security definer
set search_path = public
as $$
  select
    e.id,
    e.name,
    e.event_date,
    to_char(e.start_time, 'HH24:MI'),
    e.location,
    e.requires_meal,
    e.requires_headcount,
    e.sort_order,
    coalesce(e.content_translations, '{}'::jsonb),
    coalesce(e.audience_groups, '{}')
  from public.wedding_events e
  join public.weddings w on w.id = e.wedding_id
  where w.slug = p_slug and e.is_active and coalesce(w.enable_smart_rsvp, false)
  order by e.sort_order, e.start_time;
$$;

grant execute on function public.get_public_events(text) to anon, authenticated;

-- ── 6. TOKEN LOOKUP: guest + invited_events + event_responses ──────────────────
-- Append-only (existing columns keep their positions — RsvpPage reads by name).

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
  plus_one_names     text[],
  invited_events     jsonb,
  event_responses    jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    g.id, g.name, g.rsvp_status, g.meal_choice,
    g.plus_one_name, g.dietary_notes, g.relationship_group, g.friend_subgroup,
    g.party, g.rsvp_message, g.email, g.wants_to_speak,
    coalesce(
      array(select c.name from public.guests c where c.primary_guest_id = g.id order by c.name),
      '{}'
    ),
    -- invited_events: the party's invited, active events (ordered).
    coalesce((
      select jsonb_agg(ev order by ord, st)
      from (
        select jsonb_build_object(
                 'id', e.id, 'name', e.name, 'event_date', e.event_date,
                 'start_time', to_char(e.start_time, 'HH24:MI'), 'location', e.location,
                 'requires_meal', e.requires_meal, 'requires_headcount', e.requires_headcount,
                 'sort_order', e.sort_order,
                 'content_translations', coalesce(e.content_translations, '{}'::jsonb),
                 'audience_groups', to_jsonb(coalesce(e.audience_groups, '{}'))
               ) as ev,
               e.sort_order as ord, e.start_time as st
        from public.guest_event_rsvps ger
        join public.wedding_events e on e.id = ger.event_id
        where ger.guest_id = g.id and ger.invited and e.is_active
          and coalesce((select enable_smart_rsvp from public.weddings limit 1), false)
      ) s
    ), '[]'::jsonb),
    -- event_responses: current per-body per-event answers (primary + children).
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'body_name', b.name, 'is_primary', b.is_primary,
               'event_id', ger.event_id, 'status', ger.status,
               'meal_choice', ger.meal_choice, 'dietary_notes', ger.dietary_notes
             ))
      from (
        select g.id as id, g.name as name, true as is_primary
        union all
        select c.id, c.name, false from public.guests c where c.primary_guest_id = g.id
      ) b
      join public.guest_event_rsvps ger on ger.guest_id = b.id and ger.invited
      join public.wedding_events e on e.id = ger.event_id and e.is_active
      where coalesce((select enable_smart_rsvp from public.weddings limit 1), false)
    ), '[]'::jsonb)
  from public.guests g
  where g.rsvp_token = p_token;
$$;

grant execute on function public.get_guest_by_rsvp_token(uuid) to anon, authenticated;

-- ── 7. SUBMIT: per-event RSVP (smart mode) ────────────────────────────────────
-- Distinct name (not an overload of submit_rsvp) to avoid resolution ambiguity.
-- The legacy submit_rsvp remains for the flag-OFF single-attendance path.

drop function if exists public.submit_rsvp_events(uuid, text, text, text, text, text, text, text[], jsonb);

create or replace function public.submit_rsvp_events(
  p_token              uuid,
  p_email              text   default '',
  p_message            text   default '',
  p_wants_to_speak     text   default '',
  p_relationship_group text   default '',
  p_friend_subgroup    text   default '',
  p_party              text   default '',
  p_plus_one_names     text[] default '{}',
  p_event_responses    jsonb  default '[]'
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
  v_invited       uuid[];
  v_invited_all   uuid[];
  v_resp          jsonb;
  v_body_name     text;
  v_event_id      uuid;
  v_status        text;
  v_meal          text;
  v_dietary       text;
  v_target_id     uuid;
  v_requires_meal boolean;
  v_enabled       boolean;
  v_meal_event    uuid;
begin
  -- 1. Resolve the primary + the party side it should be filed under.
  select id,
         case when p_party = any(v_valid_parties) and p_party <> '' then p_party else party end
    into v_primary_id, v_party
  from public.guests where rsvp_token = p_token;

  if v_primary_id is null then
    raise exception 'invalid rsvp token';
  end if;

  -- Reject a malformed payload before iterating (a non-array would otherwise
  -- error inside jsonb_array_elements), then bound its size (cheap DoS guard).
  if jsonb_typeof(coalesce(p_event_responses, '[]'::jsonb)) <> 'array' then
    raise exception 'event responses must be an array';
  end if;
  if jsonb_array_length(coalesce(p_event_responses, '[]'::jsonb)) > 100 then
    raise exception 'too many event responses';
  end if;

  -- Smart-RSVP submit is a no-op unless the feature is enabled (the public form
  -- uses the legacy submit_rsvp when OFF). Load the flag + designated meal event.
  select coalesce(enable_smart_rsvp, false), primary_meal_event_id
    into v_enabled, v_meal_event
  from public.weddings limit 1;
  if not coalesce(v_enabled, false) then
    return;
  end if;

  -- 2. Update the primary's non-event fields (attendance is mirrored from events).
  update public.guests set
    email = case when p_email <> '' then left(p_email, 254) else email end,
    rsvp_message = left(coalesce(p_message, ''), 500),
    wants_to_speak = case when p_wants_to_speak in ('', 'yes', 'no') then p_wants_to_speak else wants_to_speak end,
    relationship_group = case
      when p_relationship_group = any(v_valid_groups) then p_relationship_group
      else relationship_group end,
    friend_subgroup = case
      when p_relationship_group = 'friends' and p_friend_subgroup = any(v_valid_friends) then p_friend_subgroup
      when p_relationship_group = any(v_valid_groups) and p_relationship_group <> 'friends' then ''
      else friend_subgroup end,
    party = case
      when p_party = any(v_valid_parties) and p_party <> '' then p_party else party end
  where id = v_primary_id;

  -- 3. Plus-x reconciliation (same rules as submit_rsvp): trim, dedupe, cap 6.
  select coalesce(array_agg(nm), '{}') into v_clean
  from (
    select distinct left(trim(n), 120) as nm
    from unnest(coalesce(p_plus_one_names, '{}')) as t(n)
    where trim(coalesce(n, '')) <> ''
  ) d;
  if array_length(v_clean, 1) > 6 then
    v_clean := v_clean[1:6];
  end if;

  delete from public.guests
  where primary_guest_id = v_primary_id
    and lower(trim(name)) <> all (select lower(x) from unnest(v_clean) as x);

  update public.guests set party = v_party where primary_guest_id = v_primary_id;

  insert into public.guests (name, primary_guest_id, party, rsvp_status)
  select nm, v_primary_id, v_party, 'pending'
  from unnest(v_clean) as nm
  where lower(trim(nm)) not in (
    select lower(trim(name)) from public.guests where primary_guest_id = v_primary_id
  );

  -- 4. The primary's invited event set. Two views:
  --    v_invited      → ACTIVE invited events, used for materialization + the
  --                     self-elevation guard (matches get_guest_by_rsvp_token's
  --                     read path, so a stale/deactivated event can't be written).
  --    v_invited_all  → ALL invited events (active or not), used only for pruning,
  --                     so a merely deactivated (but still invited) event keeps its
  --                     child rows / response history.
  select coalesce(array_agg(ger.event_id) filter (where e.is_active), '{}'),
         coalesce(array_agg(ger.event_id), '{}')
    into v_invited, v_invited_all
  from public.guest_event_rsvps ger
  join public.wedding_events e on e.id = ger.event_id
  where ger.guest_id = v_primary_id and ger.invited;

  -- 5. Materialize a junction row per child × per active invited event. Seed the
  --    initial status/meal from the child's existing LEGACY RSVP so enrolling a
  --    guest who already answered under the old flow doesn't regress them to
  --    pending via the mirror trigger. `on conflict do nothing` leaves existing
  --    per-event rows untouched (re-submits never re-seed).
  insert into public.guest_event_rsvps (
    guest_id, event_id, invited, status, meal_choice, dietary_notes, responded_at
  )
  select
    c.id,
    e,
    true,
    case when c.rsvp_status in ('confirmed', 'declined') then c.rsvp_status else 'pending' end,
    case when c.rsvp_status = 'confirmed' and v_meal_event = e
         then left(coalesce(c.meal_choice, ''), 60) else '' end,
    case when c.rsvp_status = 'confirmed' and v_meal_event = e
         then left(coalesce(c.dietary_notes, ''), 500) else '' end,
    case when c.rsvp_status in ('confirmed', 'declined') then c.rsvp_at else null end
  from public.guests c
  cross join unnest(v_invited) as e
  where c.primary_guest_id = v_primary_id
  on conflict (guest_id, event_id) do nothing;

  -- 6. Prune child junctions for events the primary is no longer invited to at all
  --    (an un-invite, not a mere deactivation).
  delete from public.guest_event_rsvps
  where guest_id in (select id from public.guests where primary_guest_id = v_primary_id)
    and event_id <> all (v_invited_all);

  -- 7. Apply per-body, per-event responses.
  for v_resp in select value from jsonb_array_elements(coalesce(p_event_responses, '[]'::jsonb))
  loop
    v_body_name := coalesce(v_resp->>'body_name', '');
    begin
      v_event_id := (v_resp->>'event_id')::uuid;
    exception when others then
      continue;  -- malformed event id
    end;

    v_status := coalesce(v_resp->>'status', '');
    if v_status not in ('confirmed', 'declined') then
      continue;  -- ignore pending / invalid
    end if;

    -- Self-elevation guard: only events the party is invited to.
    if not (v_event_id = any(v_invited)) then
      continue;
    end if;

    -- Resolve the target body. The primary is identified by a blank body_name OR
    -- an explicit is_primary flag (get_guest_by_rsvp_token emits the primary with
    -- its own name + is_primary=true, so a round-tripped primary response matches).
    if trim(v_body_name) = '' or coalesce(v_resp->>'is_primary', 'false') = 'true' then
      v_target_id := v_primary_id;
    else
      select id into v_target_id
      from public.guests
      where primary_guest_id = v_primary_id and lower(trim(name)) = lower(trim(v_body_name))
      limit 1;
      if v_target_id is null then
        continue;  -- unknown / de-listed body
      end if;
    end if;

    -- Meal only for a confirmed response on a meal-bearing event.
    select requires_meal into v_requires_meal from public.wedding_events where id = v_event_id;
    v_meal := case
      when v_status = 'confirmed' and coalesce(v_requires_meal, false)
        then left(coalesce(v_resp->>'meal_choice', ''), 60)
      else '' end;
    v_dietary := left(coalesce(v_resp->>'dietary_notes', ''), 500);

    update public.guest_event_rsvps set
      status        = v_status,
      meal_choice   = v_meal,
      dietary_notes = v_dietary,
      responded_at  = now()
    where guest_id = v_target_id and event_id = v_event_id and invited;
  end loop;
end;
$$;

grant execute on function public.submit_rsvp_events(uuid, text, text, text, text, text, text, text[], jsonb)
  to anon, authenticated;

-- ── 8. get_wedding_config — admin + public display config read ────────────────
-- Column order in the returns table MUST match the select list exactly.
--
-- Granted to `anon` (the public RSVP form calls it), so it must expose ONLY
-- public display config. It DELIBERATELY omits the budget/checklist fields:
-- those are internal data served instead by the authenticated, couple-only
-- get_budget_config / get_checklist_config (0006_planning_features.sql). The
-- runsheet column is masked from anon until published (see below).

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
  is_runsheet_published   boolean,
  extra_notice            text,
  enable_open_rsvp        boolean,
  enable_photowall        boolean
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
    coalesce(enable_open_rsvp, false),
    coalesce(enable_photowall, false)
  from public.weddings
  limit 1;
$$;

-- Stays anon-callable: the PUBLIC RSVP form (RsvpPage.jsx) reads it to render the
-- couple's names/venue/theme and the enable_* flags. It is a read of non-secret
-- display config only (no guest data, and the rsvp/photowall pins are
-- deliberately NOT selected — they are read back only through the couple-only
-- get_open_rsvp_admin_config / get_photowall_admin_config RPCs), so anon read
-- is intentional, not a leak.
grant execute on function public.get_wedding_config() to anon, authenticated;

-- ── 9. upsert_wedding_config — admin write (Wedding Setup), couple-only ───────
-- Security definer bypasses the weddings_write RLS policy, so the role gate
-- lives inside the function (#101). is_helper() FAILS OPEN, so this guard can
-- never block the couple.

-- Superseded historical signatures (each feature appended parameters — a
-- lingering overload would make PostgREST RPC resolution ambiguous).
drop function if exists public.upsert_wedding_config(text, text, date, text, text, text, text);
drop function if exists public.upsert_wedding_config(text, text, date, text, text, text, text, text);
drop function if exists public.upsert_wedding_config(
  text, text, date, text, text, text, text, text, boolean, uuid
);
drop function if exists public.upsert_wedding_config(
  text, text, date, text, text, text, text, text, boolean, uuid, boolean, text
);

create or replace function public.upsert_wedding_config(
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
  p_rsvp_pin          text default '',
  p_enable_photowall  boolean default false,
  p_photowall_pin     text default ''
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

  -- Same invariant for the photowall (#138): uploads must never be open to
  -- anyone who finds the URL.
  if coalesce(p_enable_photowall, false)
     and trim(coalesce(p_photowall_pin, '')) = '' then
    raise exception 'photowall pin required';
  end if;

  insert into public.weddings (
    bride_name, groom_name, wedding_date,
    venue_name, venue_address,
    ceremony_time, dinner_time, tea_ceremony_time,
    enable_smart_rsvp, primary_meal_event_id,
    enable_open_rsvp, rsvp_pin,
    enable_photowall, photowall_pin,
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
    coalesce(p_enable_photowall, false),
    left(trim(coalesce(p_photowall_pin, '')), 20),
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
    enable_photowall  = excluded.enable_photowall,
    photowall_pin     = excluded.photowall_pin,
    updated_at        = now();
end;
$$;

revoke all on function public.upsert_wedding_config(
  text, text, date, text, text, text, text, text, boolean, uuid, boolean, text, boolean, text
) from public, anon;
grant execute on function public.upsert_wedding_config(
  text, text, date, text, text, text, text, text, boolean, uuid, boolean, text, boolean, text
) to authenticated;
