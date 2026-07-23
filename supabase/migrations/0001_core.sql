-- 0001_core.sql — guests, submissions, receipts bucket, role config
--
-- Consolidated from: 0001_init, 0002_draw_and_submissions,
--                    0010_role_enforcement (§1 app_config + §2 is_helper only),
--                    0012_dday_helper_features (§1 reusable lucky-draw pool)
--
-- The headline security property: data access is granted ONLY to the
-- `authenticated` role. The anonymous role (`anon`) has no policy, so the
-- public anon key alone cannot read, insert, update, or delete any guest data.
-- Helpers must sign in (see README) before the app can touch the database.
--
-- Role-aware RLS policies for the tables created here live in
-- 0005_roles_security.sql — this file only creates the tables and enables RLS.
-- `app_config` + `is_helper()` are defined up front (rather than with the role
-- policies) because later migrations (wedding-photos storage policies in 0003,
-- vendor/budget policies in 0006) reference `is_helper()` in their own files.

-- ── 1. `guests` TABLE ─────────────────────────────────────────────────────────

create table if not exists public.guests (
  id            uuid primary key default gen_random_uuid(),
  name          text    not null check (char_length(name) between 1 and 120),
  table_number  text    not null default '1' check (char_length(table_number) <= 20),
  checked_in    boolean not null default false,
  checked_in_at timestamptz,
  angbao_given  boolean not null default false,
  angbao_amount numeric not null default 0 check (angbao_amount >= 0 and angbao_amount <= 10000000),
  notes         text    default '' check (char_length(coalesce(notes, '')) <= 500),
  is_vip        boolean not null default false,
  party         text    not null default '' check (party in ('', 'bride', 'groom')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Keep updated_at fresh on every change (audit trail).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists guests_set_updated_at on public.guests;
create trigger guests_set_updated_at
  before update on public.guests
  for each row execute function public.set_updated_at();

alter table public.guests enable row level security;
-- Policies: 0005_roles_security.sql.

-- ── 2. Lucky-draw number on guests ────────────────────────────────────────────
-- A unique, stable raffle number minted when a guest's ang-bao is confirmed.
alter table public.guests
  add column if not exists draw_number int unique;

-- Reusable pool allocation (#150, from 0012): draw numbers used to be
-- assign-once off a sequence — unmarking an angbao kept the number forever, so
-- an accidental "Received" permanently consumed a raffle ticket. Now:
--   * assign_draw_number hands out the LOWEST free positive integer (numbers
--     stay dense 1..N, matching physical ticket stubs) — still only while the
--     guest's draw_number is null;
--   * release_draw_number returns a guest's number to the pool (called when the
--     angbao is unmarked); a re-mark simply mints again and may legitimately
--     receive the same number back.
--
-- The advisory lock serialises concurrent mints so two helpers confirming at
-- the same instant can't compute the same "lowest free" value; the unique
-- constraint on guests.draw_number above remains as a backstop.
-- SECURITY DEFINER so the update works regardless of the caller's grants
-- (helpers have no direct UPDATE on guests since #92).
drop function if exists public.assign_draw_number(uuid);
create function public.assign_draw_number(p_guest_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtext('assign_draw_number'));
  update public.guests
    set draw_number = (
      select min(s.n)
      from generate_series(
        1,
        (select count(*) from public.guests where draw_number is not null) + 1
      ) as s(n)
      where not exists (
        select 1 from public.guests g where g.draw_number = s.n
      )
    )
    where id = p_guest_id and draw_number is null;
  select draw_number into n from public.guests where id = p_guest_id;
  return n;
end;
$$;

revoke all on function public.assign_draw_number(uuid) from public;
grant execute on function public.assign_draw_number(uuid) to authenticated;

comment on function public.assign_draw_number(uuid) is
  'Intentionally helper-callable: mints the lowest free lucky-draw number during D-Day check-in (0012). Writes no financial data. Do not add an is_helper() gate.';

-- Narrow security-definer write in the set_guest_checkin mould (0005): touches
-- only draw_number, parameterised id, granted to both signed-in roles.
drop function if exists public.release_draw_number(uuid);
create function public.release_draw_number(p_guest_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.guests set draw_number = null where id = p_guest_id;
$$;

revoke all on function public.release_draw_number(uuid) from public;
grant execute on function public.release_draw_number(uuid) to authenticated;

comment on function public.release_draw_number(uuid) is
  'Returns a guest''s lucky-draw number to the reusable pool when their angbao is unmarked (#150). Writes no financial data.';

-- One-time backfill: clear the stale numbers the assign-once era left behind
-- (guests unmarked while keeping their number). Idempotent: re-running matches
-- nothing new.
update public.guests
  set draw_number = null
  where angbao_given = false and draw_number is not null;

-- Retired by the pool rewrite (#150) — allocation no longer uses a sequence.
-- Kept as a drop (not just removed) because already-deployed DBs still carry it.
drop sequence if exists public.draw_number_seq;

-- ── 3. Guest-upload queue ─────────────────────────────────────────────────────
-- A guest drops a *pending* ang-bao submission (name + claimed amount + uploaded
-- receipt) for a helper to review — guests can never read, list, or approve
-- submissions or receipts.
create table if not exists public.submissions (
  id               uuid primary key default gen_random_uuid(),
  guest_name       text    not null check (char_length(guest_name) between 1 and 120),
  claimed_amount   numeric not null default 0 check (claimed_amount >= 0 and claimed_amount <= 10000000),
  receipt_path     text    not null check (char_length(receipt_path) between 1 and 400),
  status           text    not null default 'pending' check (status in ('pending','approved','rejected')),
  matched_guest_id uuid    references public.guests(id) on delete set null,
  created_at       timestamptz not null default now()
);

alter table public.submissions enable row level security;
-- Policies: 0005_roles_security.sql.

-- ── 4. Private receipts bucket ────────────────────────────────────────────────
-- Receipts contain bank details, so the bucket is PRIVATE: guests can upload but
-- never browse, and helpers view each receipt through a short-lived signed URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 5242880,
  array['image/png','image/jpeg','image/webp','image/heic','image/heif','application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
-- Policies: 0005_roles_security.sql.

-- ── 5. Locked-down role config table ──────────────────────────────────────────
-- RLS on with NO policy → anon and authenticated are denied entirely. Only the
-- table owner (SQL editor) and `service_role` (which bypass RLS) can write. This
-- is deliberately NOT the anon-writable `weddings` table, so a helper cannot
-- re-designate who the helper is and escalate.
create table if not exists public.app_config (
  key   text primary key,
  value text not null default ''
);

alter table public.app_config enable row level security;
-- (No `create policy` → default-deny for every non-owner role.)

-- Seed defaults idempotently. Deployments override with a service-role UPDATE to
-- their real addresses (keep in sync with VITE_HELPER_EMAIL / VITE_COUPLE_EMAIL):
--   update public.app_config set value = lower('team@example.com')  where key = 'helper_email';
--   update public.app_config set value = lower('bride@example.com') where key = 'couple_email';
insert into public.app_config (key, value) values
  ('helper_email', lower('helper@wedding.local')),
  ('couple_email', lower('couple@wedding.local'))
on conflict (key) do nothing;

-- ── 6. is_helper() ────────────────────────────────────────────────────────────
-- TRUE only when the caller's JWT email equals the configured helper email AND is
-- not the couple. FALSE for the couple, unknown emails, an unconfigured helper, or
-- on ANY internal error (fail-open — never lock the couple out of their own data).
create or replace function public.is_helper()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email  text := lower(auth.email());
  v_helper text;
  v_couple text;
begin
  if v_email is null or v_email = '' then
    return false;
  end if;

  select lower(value) into v_helper from public.app_config where key = 'helper_email';
  select lower(value) into v_couple from public.app_config where key = 'couple_email';

  -- Unconfigured helper → nobody is restricted (fail-open, full access for all).
  if v_helper is null or v_helper = '' then
    return false;
  end if;

  -- The couple can NEVER be treated as a helper, even under a bad config row.
  if v_couple is not null and v_couple <> '' and v_email = v_couple then
    return false;
  end if;

  return v_email = v_helper;
exception
  when others then
    -- Fail OPEN (never block the couple), but surface it: a permission/ownership
    -- regression that silently degraded the whole split to "everyone is couple"
    -- should at least show up in the Postgres logs.
    raise warning 'is_helper() failed open: %', sqlerrm;
    return false;
end;
$$;

revoke all on function public.is_helper() from public;
-- RLS policy expressions are evaluated as the querying role, so it needs EXECUTE.
grant execute on function public.is_helper() to authenticated;
