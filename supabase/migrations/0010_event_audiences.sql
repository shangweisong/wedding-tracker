-- ─────────────────────────────────────────────────────────────────────────────
-- 0010_event_audiences.sql — relationship-targeted smart-RSVP events (#131)
--
-- Lets the couple restrict a wedding_events row to relationship groups
-- (family/friends/colleagues/other). An empty array means "everyone". The
-- filter is applied client-side on the public RSVP form as a declutter — it
-- is NOT a security boundary (relationship_group is guest-selected on the
-- form); the real per-guest gate stays guest_event_rsvps.invited.
--
-- Idempotent: guarded column/constraint adds; the two public read RPCs are
-- dropped and recreated because their return shape grows (get_public_events
-- gains a column; get_guest_by_rsvp_token's invited_events objects gain a
-- key). Bodies copied from 0004_smart_rsvp.sql, append-only — existing
-- columns keep their positions (RsvpPage reads by name).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Column ─────────────────────────────────────────────────────────────────
alter table public.wedding_events
  add column if not exists audience_groups text[] not null default '{}';

alter table public.wedding_events
  drop constraint if exists wedding_events_audience_groups_check;
alter table public.wedding_events
  add constraint wedding_events_audience_groups_check
  check (audience_groups <@ array['family','friends','colleagues','other']::text[]);

-- ── 2. get_public_events — expose audience_groups (open RSVP mode) ────────────
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

-- ── 3. get_guest_by_rsvp_token — invited_events objects gain audience_groups ──
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
