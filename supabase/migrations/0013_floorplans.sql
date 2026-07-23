-- ═══════════════════════════════════════════════════════════════════════════════
-- 0013_floorplans — venue floorplan/layout snapshots (#162)
--
-- The couple uploads floorplan/layout snapshot images (venue floorplan, stage
-- layout, …) for day-of verification; the helper views them read-only.
--
-- Storage: images live in the existing PUBLIC wedding-photos bucket under the
-- floorplans/ prefix — the 0003 policies already give couple-only writes
-- (not is_helper()) and public reads, so no storage policy changes here.
--
-- Metadata: a jsonb array on the weddings singleton row —
--   [{ id, path, url, label, created_at }]
-- capped client-side at 6 entries / 80-char labels (src/lib/floorplan.js) and
-- bounded here by weddings_floorplans_size as the authoritative guard.
--
-- Read path: the admin app selects the column directly as an authenticated
-- user. The helper's visibility depends on the weddings_select policy staying
-- `for select to authenticated using (true)` (0003) — if a future migration
-- tightens it to couple-only, the helper's floorplan viewer silently empties.
-- The column is deliberately NOT added to get_wedding_config(): that RPC is
-- granted to anon and would leak the floorplans to the public RSVP page.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. weddings.floorplans column ─────────────────────────────────────────────

alter table public.weddings
  add column if not exists floorplans jsonb not null default '[]'::jsonb;

-- Size guard (pattern from 0003: no `add constraint if not exists` in Postgres,
-- so guard on pg_constraint). 6 entries × ~350 bytes ≈ 2 KB; 10 KB is headroom.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'weddings_floorplans_size'
  ) then
    alter table public.weddings
      add constraint weddings_floorplans_size
      check (pg_column_size(floorplans) < 10000);
  end if;
end $$;

-- ── 2. upsert_floorplans — couple-only floorplans write ───────────────────────
-- Security definer bypasses the weddings_write RLS policy, so the role gate
-- lives inside the function; grants are authenticated-only (the anon key must
-- not be able to overwrite the couple's floorplans). Same pattern as
-- upsert_runsheet (0006 §5).

drop function if exists public.upsert_floorplans(jsonb);

create or replace function public.upsert_floorplans(p_floorplans jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select public.is_helper()) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  insert into public.weddings (bride_name, groom_name, floorplans, updated_at)
  values ('', '', coalesce(p_floorplans, '[]'::jsonb), now())
  on conflict ((true)) do update set
    floorplans = coalesce(excluded.floorplans, '[]'::jsonb),
    updated_at = now();
end;
$$;

revoke all on function public.upsert_floorplans(jsonb) from public, anon;
grant execute on function public.upsert_floorplans(jsonb) to authenticated;
