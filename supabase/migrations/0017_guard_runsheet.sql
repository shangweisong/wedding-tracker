-- 0017 — Guard the runsheet write RPC against anon and the helper role, and
--         hide unpublished runsheet data from anon reads.
--
-- upsert_runsheet (0013) is `security definer`, so it runs as the owner and
-- BYPASSES the row-level policies on public.weddings (`weddings_write ...
-- not is_helper()`, 0011 §8). It was created with
-- `grant execute ... to anon, authenticated` and no internal role check —
-- meaning the PUBLIC anon key alone (shipped in the browser bundle) could
-- overwrite the couple's wedding-day runsheet, and so could a signed-in
-- helper. This is the same hole class 0015 (#101) closed for
-- upsert_wedding_config / upsert_wedding_page.
--
-- Fix: re-create the function with the same internal gate used by
-- upsert_budget_config (0011) and the 0015 guards — raise `42501
-- insufficient_privilege` when the caller is the helper — and close the
-- grant layer to `authenticated` only. Body is otherwise identical to 0013,
-- so `create or replace` suffices.
--
-- Lockout safety: public.is_helper() (0010) FAILS OPEN — it returns false on
-- any internal error — so this guard can never block the couple.

-- ── 1. upsert_runsheet — body from 0013, plus the helper gate ─────────────────
create or replace function public.upsert_runsheet(
  p_runsheet              jsonb,
  p_is_runsheet_published boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Couple-only: security definer bypasses the weddings_write RLS policy, so
  -- the role gate must live inside the function (same pattern as 0015).
  if (select public.is_helper()) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  insert into public.weddings (bride_name, groom_name, runsheet, is_runsheet_published, updated_at)
  values ('', '', coalesce(p_runsheet, '[]'::jsonb), coalesce(p_is_runsheet_published, false), now())
  on conflict ((true)) do update set
    runsheet              = coalesce(excluded.runsheet, '[]'::jsonb),
    is_runsheet_published = coalesce(excluded.is_runsheet_published, false),
    updated_at            = now();
end;
$$;

revoke all on function public.upsert_runsheet(jsonb, boolean) from public, anon;
grant execute on function public.upsert_runsheet(jsonb, boolean) to authenticated;

-- ── 2. get_wedding_config — mask the runsheet from anon until published ───────
-- 0013 made get_wedding_config return the runsheet unconditionally while
-- keeping its anon grant (the public RSVP page reads wedding basics through
-- it). That let anyone with the public anon key read a runsheet the couple
-- had NOT published, bypassing the is_runsheet_published toggle that
-- get_public_runsheet enforces. Re-create it with the runsheet column masked
-- to '[]' unless the runsheet is published or the caller is a signed-in
-- account (the admin editor needs the draft). Signature and every other
-- column are identical to 0013, so `create or replace` suffices and the
-- existing grants are preserved.
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
  is_runsheet_published   boolean
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
    coalesce(is_runsheet_published, false)
  from public.weddings
  limit 1;
$$;

-- ── 3. Audit trail: the published-runsheet READ surface stays open by design ──
-- get_public_runsheet (0013) is anon-callable on purpose: it returns only
-- published runsheets (`is_runsheet_published = true`) for the public
-- /runsheet/:slug page and exposes no couple-only data. get_wedding_config's
-- anon grant likewise stays (the public RSVP page reads wedding basics
-- through it) — its runsheet column is masked above instead.
comment on function public.get_public_runsheet(text) is
  'Intentionally anon-callable: read-only, published-runsheets-only surface for the public /runsheet/:slug page (0013). Do not add an is_helper() gate.';
