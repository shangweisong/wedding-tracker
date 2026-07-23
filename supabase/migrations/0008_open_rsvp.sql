-- ─────────────────────────────────────────────────────────────────────────────
-- 0008_open_rsvp.sql — open RSVP self-registration (#126)
--
-- Consolidated from: 0009_open_rsvp (round-3 consolidation; the weddings
-- columns it added — enable_open_rsvp, rsvp_pin — now live in
-- 0003_weddings_page.sql, and its get_wedding_config / upsert_wedding_config
-- recreations are subsumed by the final bodies in 0004_smart_rsvp.sql).
--
-- Adds an opt-in mode where guests are NOT cross-checked against the guest
-- list: they type their name free-text on the public RSVP form and a guest
-- row is created for them. The mode is gated by a mandatory PIN chosen by the
-- couple (shared on the invitation), verified server-side — the pin value is
-- never exposed to anon callers. Hosts cross-check self-registered guests
-- (flagged via guests.self_registered) after the deadline.
--
-- Idempotent: guarded column add; touched functions are dropped and recreated.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. guests.self_registered ─────────────────────────────────────────────────
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

-- ── 4. get_open_rsvp_admin_config — couple-only pin readback ──────────────────
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
