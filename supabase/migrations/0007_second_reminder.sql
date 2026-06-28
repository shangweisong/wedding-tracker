-- Track the 30-day reminder separately from the 90-day one.
-- Previously both writes went to last_reminder_sent_at, causing the 30-day
-- reminder to fire every day from day 30 to the wedding.
alter table public.guests
  add column if not exists second_reminder_sent_at timestamptz;
