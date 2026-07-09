-- Performance indexes for the daily cron query in send-reminders.js.
-- Both columns are used in WHERE filters on every cron run; without indexes
-- Postgres falls back to a sequential scan of the full guests table.
create index if not exists guests_rsvp_status_idx on guests (rsvp_status);
create index if not exists guests_email_idx on guests (email);
