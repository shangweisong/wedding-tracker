-- Phase 2 supplement: fuzzy name-based RSVP submission
--
-- Guests go to /rsvp, fill in the form (including their name), and submit.
-- This function fuzzy-matches their name against the guest list using pg_trgm
-- and writes the RSVP fields if exactly one confident match is found.
-- Anon never sees the guest list — verification is opaque (success or error only).
--
-- Run this ONCE in the Supabase SQL Editor after 0002 is applied.

-- Enable trigram extension (already available in Supabase, idempotent)
create extension if not exists pg_trgm;

-- Fuzzy name-based RSVP submission.
-- Raises:
--   'not_found'  — no guest matches above the similarity threshold
--   'ambiguous'  — multiple guests match (guest should type their full name)
--   'invalid_status' — p_status not 'confirmed' or 'declined'
create or replace function public.submit_rsvp_by_name(
  p_name          text,
  p_status        text,
  p_meal_choice   text default '',
  p_dietary_notes text default '',
  p_message       text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids       uuid[];
  v_match_id  uuid;
begin
  if p_status not in ('confirmed', 'declined') then
    raise exception 'invalid_status';
  end if;

  -- Collect all guests whose name is similar enough to the input.
  -- Threshold 0.4 catches common typos (transposed letters, one missing char)
  -- while still rejecting completely different names.
  -- We also accept an exact substring match (ilike) as a fallback so that
  -- partial names like "Wei Ming" still resolve if they are unique.
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
    rsvp_status   = p_status,
    rsvp_at       = now(),
    meal_choice   = left(coalesce(p_meal_choice,   ''), 60),
    dietary_notes = left(coalesce(p_dietary_notes, ''), 500),
    rsvp_message  = left(coalesce(p_message,       ''), 500)
  where id = v_match_id;
end;
$$;

grant execute on function public.submit_rsvp_by_name(text, text, text, text, text)
  to anon, authenticated;
