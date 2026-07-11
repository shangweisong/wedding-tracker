-- 0015 — Guard the wedding config/page write RPCs against the helper role (#101).
--
-- upsert_wedding_config (0009) and upsert_wedding_page (0008) are `security
-- definer`, so they run as the owner and BYPASS the row-level policies that
-- 0011 §8 added to public.weddings (`weddings_write ... not is_helper()`).
-- Granted to `authenticated` with no internal role check, they let a signed-in
-- helper overwrite the couple's wedding config and public page from DevTools
-- (`sb.rpc('upsert_wedding_config', ...)`), defeating the couple/helper split.
--
-- Fix: re-create both functions with the same internal gate already used by
-- upsert_budget_config (0011): raise `42501 insufficient_privilege` when the
-- caller is the helper. Signatures and bodies are otherwise identical to the
-- latest definitions (0009 for config, 0008 for page), so `create or replace`
-- suffices and existing grants are preserved (re-asserted below anyway).
--
-- Lockout safety: public.is_helper() (0010) FAILS OPEN — it returns false on
-- any internal error — so this guard can never block the couple.

-- ── 1. upsert_wedding_config — body from 0009, plus the helper gate ───────────
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
  p_primary_meal_event_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Couple-only: security definer bypasses the weddings_write RLS policy, so
  -- the role gate must live inside the function (same pattern as
  -- upsert_budget_config in 0011).
  if (select public.is_helper()) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  insert into public.weddings (
    bride_name, groom_name, wedding_date,
    venue_name, venue_address,
    ceremony_time, dinner_time, tea_ceremony_time,
    enable_smart_rsvp, primary_meal_event_id,
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
    updated_at        = now();
end;
$$;

revoke all on function public.upsert_wedding_config(text, text, date, text, text, text, text, text, boolean, uuid)
  from public, anon;
grant execute on function public.upsert_wedding_config(text, text, date, text, text, text, text, text, boolean, uuid)
  to authenticated;

-- ── 2. upsert_wedding_page — body from 0008, plus the helper gate ─────────────
create or replace function public.upsert_wedding_page(
  p_slug            text,
  p_love_story      text,
  p_dress_code      text,
  p_hero_image_url  text,
  p_fun_qa          jsonb,
  p_rsvp_deadline   date,
  p_is_published    boolean,
  p_meal_options    text,
  p_getting_there   text default '',
  p_theme           text default 'minimal',
  p_enable_fun_rsvp_options boolean default false,
  p_smoking_notice  text default '',
  p_parking_notice  text default '',
  p_content_translations jsonb default '{}',
  p_theme_tokens    jsonb default '{}',
  p_section_photos  jsonb default '{}',
  p_hero_focal_point text default 'center'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Couple-only: see the gate comment on upsert_wedding_config above.
  if (select public.is_helper()) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  insert into public.weddings (
    bride_name, groom_name,
    slug, love_story, dress_code, hero_image_url, hero_focal_point,
    fun_qa, rsvp_deadline, is_published, meal_options,
    getting_there, theme, enable_fun_rsvp_options,
    smoking_notice, parking_notice, content_translations, theme_tokens,
    section_photos, updated_at
  ) values (
    '', '',
    p_slug,
    left(coalesce(p_love_story, ''), 5000),
    left(coalesce(p_dress_code, ''), 200),
    left(coalesce(p_hero_image_url, ''), 500),
    coalesce(p_hero_focal_point, 'center'),
    coalesce(p_fun_qa, '[]'::jsonb),
    p_rsvp_deadline,
    coalesce(p_is_published, false),
    left(coalesce(p_meal_options, ''), 200),
    left(coalesce(p_getting_there, ''), 2000),
    coalesce(p_theme, 'minimal'),
    coalesce(p_enable_fun_rsvp_options, false),
    left(coalesce(p_smoking_notice, ''), 500),
    left(coalesce(p_parking_notice, ''), 500),
    coalesce(p_content_translations, '{}'::jsonb),
    coalesce(p_theme_tokens, '{}'::jsonb),
    coalesce(p_section_photos, '{}'::jsonb),
    now()
  )
  on conflict ((true)) do update set
    slug           = coalesce(p_slug, public.weddings.slug),
    love_story     = left(coalesce(p_love_story, ''), 5000),
    dress_code     = left(coalesce(p_dress_code, ''), 200),
    hero_image_url = left(coalesce(p_hero_image_url, ''), 500),
    hero_focal_point = coalesce(p_hero_focal_point, 'center'),
    fun_qa         = coalesce(p_fun_qa, '[]'::jsonb),
    rsvp_deadline  = p_rsvp_deadline,
    is_published   = coalesce(p_is_published, false),
    meal_options   = left(coalesce(p_meal_options, ''), 200),
    getting_there  = left(coalesce(p_getting_there, ''), 2000),
    theme          = coalesce(p_theme, 'minimal'),
    enable_fun_rsvp_options = coalesce(p_enable_fun_rsvp_options, false),
    smoking_notice = left(coalesce(p_smoking_notice, ''), 500),
    parking_notice = left(coalesce(p_parking_notice, ''), 500),
    content_translations = coalesce(p_content_translations, '{}'::jsonb),
    theme_tokens   = coalesce(p_theme_tokens, '{}'::jsonb),
    section_photos = coalesce(p_section_photos, '{}'::jsonb),
    updated_at     = now();
end;
$$;

revoke all on function public.upsert_wedding_page(
  text, text, text, text, jsonb, date, boolean, text, text, text, boolean, text, text, jsonb, jsonb, jsonb, text
) from public, anon;
grant execute on function public.upsert_wedding_page(
  text, text, text, text, jsonb, date, boolean, text, text, text, boolean, text, text, jsonb, jsonb, jsonb, text
) to authenticated;

-- ── 3. Budget RPCs: strip the implicit PUBLIC execute grant ───────────────────
-- get_budget_config / upsert_budget_config were created in 0011 with only
-- `grant execute ... to authenticated` and NO revoke. Postgres grants EXECUTE
-- on new functions to PUBLIC by default, and revoking from a specific role
-- never removes a PUBLIC grant — so both stayed callable by `anon`. Their only
-- internal gate is is_helper(), which is false for an unauthenticated caller,
-- meaning the anon key alone could read AND overwrite the budget cap and
-- categories. Close the grant layer the same way as the functions above.
revoke all on function public.get_budget_config() from public, anon;
grant execute on function public.get_budget_config() to authenticated;
revoke all on function public.upsert_budget_config(numeric, jsonb) from public, anon;
grant execute on function public.upsert_budget_config(numeric, jsonb) to authenticated;

-- ── 4. Audit trail: security-definer write RPCs that stay open to the helper ──
-- Reviewed alongside this fix (#101). Every other client-callable
-- security-definer write is either gated (upsert_budget_config, 0011) or part
-- of the anon RSVP surface by design (submit_rsvp*). These two are the
-- helper's sanctioned D-Day writes and intentionally carry NO is_helper() gate:
comment on function public.set_guest_checkin(uuid, boolean) is
  'Intentionally helper-callable: the helper''s one sanctioned guest write (D-Day check-in, 0010). Do not add an is_helper() gate.';
comment on function public.assign_draw_number(uuid) is
  'Intentionally helper-callable: mints the assign-once lucky-draw number during D-Day check-in (0002). Writes no financial data. Do not add an is_helper() gate.';
