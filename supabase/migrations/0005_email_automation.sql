-- Email Automation — RSVP confirmation emails + 90/30-day reminder cron
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │  OPTIONAL — apply only after completing these steps:                   │
-- │                                                                         │
-- │  1. Deploy your Vercel app and note the URL                             │
-- │  2. Add RESEND_API_KEY + RSVP_WEBHOOK_SECRET to Vercel env vars         │
-- │  3. Run in Supabase SQL Editor (one-time, not in this migration):        │
-- │                                                                         │
-- │     select vault.create_secret(                                         │
-- │       'https://<your-app>.vercel.app/api/send-rsvp-email',              │
-- │       'rsvp_email_webhook_url'                                          │
-- │     );                                                                  │
-- │     select vault.create_secret(                                         │
-- │       '<same-value-as-RSVP_WEBHOOK_SECRET-env-var>',                    │
-- │       'rsvp_email_webhook_secret'                                       │
-- │     );                                                                  │
-- │                                                                         │
-- │  Until both Vault secrets exist the trigger below silently no-ops —    │
-- │  guests can RSVP normally, emails just won't send yet.                  │
-- └─────────────────────────────────────────────────────────────────────────┘

-- ── 1. pg_net EXTENSION ───────────────────────────────────────────────────────
-- Enables outbound HTTP calls from PostgreSQL triggers.

create extension if not exists pg_net;

-- ── 2. RSVP STATUS CHANGE WEBHOOK ────────────────────────────────────────────
--
-- Fires after any UPDATE that moves rsvp_status to 'confirmed' or 'declined'
-- and the guest has an email address. Calls the Vercel serverless function
-- which sends the confirmation email (+ .ics calendar invite if confirmed).
-- Reads URL + secret from Supabase Vault — no-ops if either secret is absent.

create or replace function public.notify_rsvp_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  if new.rsvp_status is distinct from old.rsvp_status
     and new.rsvp_status in ('confirmed', 'declined')
     and new.email != '' then

    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'rsvp_email_webhook_url';
    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'rsvp_email_webhook_secret';

    if v_url is not null and v_secret is not null then
      perform net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
          'Content-Type',    'application/json',
          'x-webhook-secret', v_secret
        ),
        body    := jsonb_build_object('guest_id', new.id)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guests_rsvp_status_webhook on public.guests;

create trigger guests_rsvp_status_webhook
  after update on public.guests
  for each row execute function public.notify_rsvp_status_change();
