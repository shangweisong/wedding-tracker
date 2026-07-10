-- Planning Checklist — the couple's own pre-wedding task list
--
-- Adds `checklist` (JSONB array of task objects) to the weddings singleton.
-- Couple-only, same shape as budget (0011): served by get_checklist_config
-- (authenticated, is_helper() gated) rather than the anon-safe
-- get_wedding_config, and written via upsert_checklist_config. There is no
-- public page for this — it's private planning data, not guest-facing.
--
-- Task shape: { id, text, category, dueOffsetDays, assignee, done }
--   dueOffsetDays is days relative to weddings.wedding_date (negative = before)
--   so deadlines recompute automatically when the wedding date changes —
--   nothing to migrate or re-save when that happens.
--   assignee is 'both' | 'bride' | 'groom'.

-- ── 1. New column ──────────────────────────────────────────────────────────────

alter table public.weddings
  add column if not exists checklist jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'weddings_checklist_size'
  ) then
    alter table public.weddings
      add constraint weddings_checklist_size
      check (pg_column_size(checklist) < 100000);
  end if;
end $$;

-- ── 2. get_checklist_config — authenticated, couple-only read ──────────────────
-- Mirrors get_budget_config (0011 §6b): served separately from
-- get_wedding_config so anon never receives checklist data.

drop function if exists public.get_checklist_config();

create or replace function public.get_checklist_config()
returns table (
  checklist jsonb
)
language sql
security definer
set search_path = public
as $$
  select coalesce(checklist, '[]'::jsonb)
  from public.weddings
  where not (select public.is_helper())
  limit 1;
$$;

grant execute on function public.get_checklist_config() to authenticated;

-- ── 3. upsert_checklist_config — couple-only write ──────────────────────────────
-- Mirrors upsert_budget_config (0011 §7).

create or replace function public.upsert_checklist_config(
  p_checklist jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- security definer bypasses RLS, so the couple-only gate must be enforced here
  -- too — otherwise a helper could call this RPC directly and mutate the checklist.
  if (select public.is_helper()) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  insert into public.weddings (bride_name, groom_name, checklist, updated_at)
  values ('', '', coalesce(p_checklist, '[]'::jsonb), now())
  on conflict ((true)) do update set
    checklist  = coalesce(excluded.checklist, '[]'::jsonb),
    updated_at = now();
end;
$$;

-- Authenticated only — checklist data is internal, not public.
grant execute on function public.upsert_checklist_config(jsonb) to authenticated;
