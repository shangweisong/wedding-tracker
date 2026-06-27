-- Remote DB Migration Tracking Reconciliation
--
-- Run this ONCE in the Supabase SQL Editor on your EXISTING project after
-- pulling this branch. Your schema is already correct — this only updates
-- the migration tracking table so `supabase db push` stays in sync.
--
-- DO NOT apply the new 0003–0005 migrations after running this — the schema
-- changes they describe are already present on your remote DB.

-- 1. Rename 0003's tracking entry to match the new filename.
update supabase_migrations.schema_migrations
  set version = '0003_rsvp_seating'
  where version = '0003_phase2_rsvp_seating';

-- 2. Remove entries for files that have been absorbed into 0003/0004/0005.
delete from supabase_migrations.schema_migrations
  where version in (
    '0004_fuzzy_rsvp_by_name',
    '0005_phase3_relationship_taxonomy',
    '0006_email_automation',
    '0007_wedding_setup',
    '0008_wedding_page',
    '0009_tea_ceremony',
    '0010_getting_there'
  );

-- 3. Mark the new consolidated files as already applied.
insert into supabase_migrations.schema_migrations (version)
  values ('0004_weddings'), ('0005_email_automation')
  on conflict do nothing;
