-- Checklist reminder log — dedup store for checklist reminder emails (#113)
--
-- Reminder *config* lives inside weddings.checklist (0014): each task may carry
-- `reminders: [{ id, offsetDays }]`, offsetDays relative to the task's due date.
-- Sent *state* lives here, written only by the send-reminders cron via the
-- service-role client. Keeping the two stores' writers disjoint (client writes
-- the JSONB config, cron writes log rows) means a stale admin tab re-saving the
-- whole checklist array can never wipe sent-state and trigger duplicate emails.
--
-- No FK: task/reminder ids live inside the JSONB, so there is nothing to
-- reference. Rows for deleted tasks/reminders are harmless orphans at
-- singleton-wedding scale — deliberately not pruned; the cron could clean
-- them up later if it ever matters.

create table if not exists public.checklist_reminder_log (
  task_id     uuid not null,
  reminder_id uuid not null,
  sent_at     timestamptz not null default now(),
  -- Composite PK doubles as the dedup lookup index and makes the cron's
  -- bulk upsert (ignoreDuplicates) idempotent on retry.
  primary key (task_id, reminder_id)
);

-- Deny-by-default: RLS on with no policies. Only the cron's service-role
-- client (which bypasses RLS) reads or writes this table — anon and
-- authenticated get nothing. The UI shows reminder config, not send
-- history, so no client-facing RPC is needed.
alter table public.checklist_reminder_log enable row level security;

-- Explicit grant: service_role bypasses RLS but still needs table
-- privileges, and newer Supabase environments no longer give service_role
-- default DML on public tables (verified on supabase CLI 2.109: new tables
-- come up with only TRUNCATE/REFERENCES/TRIGGER for service_role). Without
-- this the cron's dedup reads/writes fail with 42501.
grant select, insert on public.checklist_reminder_log to service_role;
