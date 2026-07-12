-- 0019: lock down the wedding-photos storage bucket.
--
-- 0004 created insert/update/delete policies on storage.objects with no role
-- restriction, so anyone holding the public anon key (it ships in the JS bundle)
-- could upload, overwrite, or delete any object in the public bucket. Photos are
-- couple content uploaded from the signed-in admin console, so writes follow the
-- same couple-only pattern as vendors/weddings (0011): authenticated AND not
-- is_helper(). Public read stays — the bucket serves hero/section images on the
-- public wedding page. Idempotent — safe to re-run.

drop policy if exists "anon upload wedding photos" on storage.objects;
drop policy if exists "anon update wedding photos" on storage.objects;
drop policy if exists "anon delete wedding photos" on storage.objects;

drop policy if exists "couple upload wedding photos" on storage.objects;
create policy "couple upload wedding photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'wedding-photos' and not (select public.is_helper()));

drop policy if exists "couple update wedding photos" on storage.objects;
create policy "couple update wedding photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'wedding-photos' and not (select public.is_helper()))
  with check (bucket_id = 'wedding-photos' and not (select public.is_helper()));

drop policy if exists "couple delete wedding photos" on storage.objects;
create policy "couple delete wedding photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'wedding-photos' and not (select public.is_helper()));

-- "public view wedding photos" (select) from 0004 is intentionally kept.
