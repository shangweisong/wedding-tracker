-- ─────────────────────────────────────────────────────────────────────────────
-- 0009_photowall.sql — guest photowall on the public wedding page (#138)
--
-- Consolidated from: 0011_photowall (round-3 consolidation; the weddings
-- columns it added — enable_photowall, photowall_pin — now live in
-- 0003_weddings_page.sql, its get_public_wedding recreation is subsumed by the
-- final body there, and its get_wedding_config / upsert_wedding_config
-- recreations by the final bodies in 0004_smart_rsvp.sql).
--
-- Guests upload photos from their phones on /wedding/:slug; the files live in
-- EXTERNAL object storage (Cloudflare R2 or Vercel Blob — see
-- api/_lib/photoStorage/), only the metadata rows live here. Uploads are gated
-- by a couple-chosen PIN (like the open-RSVP pin: a shared low-entropy secret
-- printed on the invitation, verified server-side, never exposed to anon).
--
-- Trust model: anon has NO policies and NO direct write path on
-- photowall_photos. Guest writes go browser → /api/photowall (Vercel fn) →
-- service-role-only RPCs below; anon reads go through get_photowall_photos,
-- which exposes only live rows. The couple moderates via plain RLS
-- (hide/unhide = table update; delete = the API so the storage object dies too).
--
-- Idempotent: guarded creates; touched functions are dropped and recreated.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Photo metadata ─────────────────────────────────────────────────────────
-- status: 'pending' = grant issued, upload not yet confirmed (invisible;
-- pruned after a day); 'live' = visible on the public page; 'hidden' =
-- moderated away by the couple (object still exists — delete is the true
-- removal).
create table if not exists public.photowall_photos (
  id            uuid primary key default gen_random_uuid(),
  object_key    text not null unique
                  check (char_length(object_key) between 1 and 400),
  public_url    text not null default ''
                  check (char_length(public_url) <= 1000
                         and (public_url = '' or public_url like 'https://%')),
  uploader_name text not null default ''
                  check (char_length(uploader_name) <= 80),
  caption       text not null default ''
                  check (char_length(caption) <= 280),
  content_type  text not null default ''
                  check (content_type in ('', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes    bigint not null default 0
                  check (size_bytes >= 0 and size_bytes <= 4194304),
  status        text not null default 'pending'
                  check (status in ('pending', 'live', 'hidden')),
  created_at    timestamptz not null default now()
);

alter table public.photowall_photos enable row level security;

-- Couple-only full access (moderation: list all, hide/unhide, delete row).
-- No anon policies at all — anon reads via the RPC, anon writes via the
-- service-role API. This keeps `submissions` the only anon table write in the
-- app (0005 §"anon_insert_submission").
drop policy if exists photowall_couple_all on public.photowall_photos;
create policy photowall_couple_all on public.photowall_photos
  for all to authenticated
  using (not (select public.is_helper()))
  with check (not (select public.is_helper()));

create index if not exists photowall_photos_status_created_idx
  on public.photowall_photos (status, created_at desc);

-- Explicit grant: service_role bypasses RLS but still needs table privileges,
-- and newer Supabase environments no longer give service_role default DML on
-- public tables (same failure mode as checklist_reminder_log in 0006 §grant).
-- api/photowall.js reads rows directly for confirm/delete/prune; without this
-- those calls fail with 42501 and every upload stays stuck at 'pending'.
grant select, delete on public.photowall_photos to service_role;

-- ── 2. Failed-PIN attempt log (brute-force rate limit) ────────────────────────
-- Clone of open_rsvp_pin_attempts (0008_open_rsvp.sql §2): single-tenant global
-- sliding window — 20 wrong PINs in 15 minutes locks uploads for everyone until
-- attempts age out. An attacker can at most lock the wall, not crack the pin.
-- RLS with no policies: only the security-definer RPC (owner) touches it.
create table if not exists public.photowall_pin_attempts (
  id           bigint generated always as identity primary key,
  attempted_at timestamptz not null default now()
);
alter table public.photowall_pin_attempts enable row level security;

-- ── 3. begin_photowall_upload — service-role only, PIN gate + pending row ─────
-- Called by /api/photowall (action "grant") AFTER it has validated the payload
-- shape; this function is the authoritative gate (pin, rate limit, caps) and
-- creates the pending metadata row in the same transaction as the attempt log.
--
-- Returns jsonb — {'id': uuid} on success, {'error': code} for PIN/cap
-- failures. PIN failures are RETURNED rather than RAISED on purpose (same
-- rationale as register_open_rsvp): an exception would roll back the
-- attempt-log insert and the rate limit would never accumulate.
-- Config/validation errors (disabled / bad type / bad size) still raise — the
-- handler pre-validates those, so a raise means a bug or a bypass attempt.

drop function if exists public.begin_photowall_upload(text, text, text, text, bigint, text);

create function public.begin_photowall_upload(
  p_pin           text,
  p_uploader_name text,
  p_caption       text,
  p_content_type  text,
  p_size_bytes    bigint,
  p_object_key    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_pin     text;
  v_id      uuid;
begin
  -- Lock the singleton row for this transaction: serializes concurrent grant
  -- calls so the attempt-window and pending/total cap checks below can't all
  -- read stale counts and overshoot together.
  select coalesce(w.enable_photowall, false),
         trim(coalesce(w.photowall_pin, ''))
    into v_enabled, v_pin
    from public.weddings w
    limit 1
    for update;

  -- The PIN is mandatory; enabled-with-blank-pin (only reachable by editing
  -- the row outside upsert_wedding_config) fails closed.
  if not coalesce(v_enabled, false) or v_pin = '' then
    return jsonb_build_object('error', 'photowall_disabled');
  end if;

  if (select count(*) from public.photowall_pin_attempts
      where attempted_at > now() - interval '15 minutes') >= 20 then
    return jsonb_build_object('error', 'too_many_attempts');
  end if;

  if trim(coalesce(p_pin, '')) <> v_pin then
    delete from public.photowall_pin_attempts
      where attempted_at < now() - interval '1 day';
    insert into public.photowall_pin_attempts default values;
    return jsonb_build_object('error', 'invalid_pin');
  end if;

  if p_content_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'invalid content type';
  end if;
  if coalesce(p_size_bytes, 0) < 1 or p_size_bytes > 4194304 then
    raise exception 'invalid size';
  end if;
  if char_length(trim(coalesce(p_object_key, ''))) < 1 then
    raise exception 'invalid object key';
  end if;

  -- Grant-flood guard: a caller with the correct pin could otherwise mint
  -- unlimited pending rows without ever uploading and exhaust the total cap.
  -- Real uploads confirm within seconds, so a small pending pool is plenty;
  -- stale pendings are pruned by the API after an hour.
  if (select count(*) from public.photowall_photos where status = 'pending') >= 50 then
    return jsonb_build_object('error', 'too_many_attempts');
  end if;

  -- Cheap abuse guard on top of the PIN: cap total rows (any status).
  if (select count(*) from public.photowall_photos) >= 1500 then
    return jsonb_build_object('error', 'photowall_full');
  end if;

  insert into public.photowall_photos
    (object_key, uploader_name, caption, content_type, size_bytes, status)
  values (
    trim(p_object_key),
    left(trim(coalesce(p_uploader_name, '')), 80),
    left(trim(coalesce(p_caption, '')), 280),
    p_content_type,
    p_size_bytes,
    'pending'
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

-- Service-role only: the browser never calls this directly — the API function
-- is the sole caller (it holds the storage credentials the grant needs anyway).
revoke all on function public.begin_photowall_upload(text, text, text, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.begin_photowall_upload(text, text, text, text, bigint, text)
  to service_role;

-- ── 4. confirm_photowall_photo — service-role only, pending → live ────────────
-- Called by /api/photowall (action "confirm") AFTER it HEAD-verified the
-- object actually exists in storage with an allowed type/size. Stores the
-- server-computed public URL and the verified byte size.

drop function if exists public.confirm_photowall_photo(uuid, text, bigint);

create function public.confirm_photowall_photo(
  p_id         uuid,
  p_public_url text,
  p_size_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.photowall_photos
     set status     = 'live',
         public_url = left(trim(coalesce(p_public_url, '')), 1000),
         -- Clamp into the check-constraint range so a bad caller value
         -- surfaces as a graceful update, never an unhandled constraint raise.
         size_bytes = least(greatest(coalesce(p_size_bytes, size_bytes), 0), 4194304)
   where id = p_id
     and status = 'pending';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('error', 'not_found');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.confirm_photowall_photo(uuid, text, bigint)
  from public, anon, authenticated;
grant execute on function public.confirm_photowall_photo(uuid, text, bigint)
  to service_role;

-- ── 5. get_photowall_photos — anon read of live photos ───────────────────────
-- The public page polls this (~20s). Exposes only live rows and only display
-- fields; gated on the flag so disabling the feature immediately empties the
-- wall. Newest first, hard-capped.

drop function if exists public.get_photowall_photos(text);

create function public.get_photowall_photos(p_slug text)
returns table (
  id            uuid,
  public_url    text,
  uploader_name text,
  caption       text,
  created_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.public_url, p.uploader_name, p.caption, p.created_at
    from public.photowall_photos p
   where p.status = 'live'
     and exists (
       select 1 from public.weddings w
        where w.slug = p_slug
          and coalesce(w.enable_photowall, false)
     )
   order by p.created_at desc
   limit 500;
$$;

revoke all on function public.get_photowall_photos(text) from public;
grant execute on function public.get_photowall_photos(text) to anon, authenticated;

-- ── 6. get_photowall_admin_config — couple-only pin readback ──────────────────
-- Mirrors get_open_rsvp_admin_config (0008_open_rsvp.sql §4): served separately
-- from get_wedding_config so anon (and the helper) can never see the pin; the
-- couple needs it to pre-fill the Wedding Setup form.

drop function if exists public.get_photowall_admin_config();

create function public.get_photowall_admin_config()
returns table (photowall_pin text)
language sql
security definer
set search_path = public
as $$
  select coalesce(photowall_pin, '')
  from public.weddings
  where not (select public.is_helper())
  limit 1;
$$;

revoke all on function public.get_photowall_admin_config() from public, anon;
grant execute on function public.get_photowall_admin_config() to authenticated;
