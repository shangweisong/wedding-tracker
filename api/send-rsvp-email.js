import { Resend } from "resend";
import { supabaseAdmin } from "./_lib/supabaseAdmin.js";
import { buildIcs } from "./_lib/ics.js";

// Webhook target for the `guests_rsvp_status_webhook` Postgres trigger
// (supabase/migrations/0006_email_automation.sql). Verifies the shared
// secret so this can't be triggered by an arbitrary caller, looks up the
// guest with the service-role client (bypasses RLS), and sends a
// confirmation or "sorry to miss you" email via Resend.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const secret = process.env.RSVP_WEBHOOK_SECRET;
  if (!secret || req.headers["x-webhook-secret"] !== secret) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const guestId = req.body?.guest_id;
  if (!guestId) return res.status(400).json({ error: "missing guest_id" });

  const supabase = supabaseAdmin();
  const { data: guest, error } = await supabase
    .from("guests")
    .select("name, email, rsvp_status")
    .eq("id", guestId)
    .single();

  if (error || !guest) return res.status(404).json({ error: "guest not found" });
  if (!guest.email) return res.status(200).json({ skipped: "no email on file" });

  const { data: wedding } = await supabase.from("weddings").select("*").limit(1).single();
  if (!wedding) return res.status(200).json({ skipped: "wedding not configured" });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const coupleNames = `${wedding.bride_name} & ${wedding.groom_name}`;
  // RESEND_FROM_EMAIL lets you override with Resend's sandbox sender
  // (onboarding@resend.dev) before a domain is verified — see .env.example.
  const fromAddress = process.env.RESEND_FROM_EMAIL || `rsvp@${process.env.RESEND_SENDING_DOMAIN}`;

  if (guest.rsvp_status === "confirmed") {
    const ics = buildIcs({
      coupleNames,
      date: wedding.wedding_date,
      ceremonyTime: wedding.ceremony_time.slice(0, 5),
      dinnerTime: wedding.dinner_time.slice(0, 5),
      venueName: wedding.venue_name,
      venueAddress: wedding.venue_address,
    });

    await resend.emails.send({
      from: `${coupleNames} <${fromAddress}>`,
      to: guest.email,
      subject: `You're confirmed! ${coupleNames}'s Wedding`,
      html: `<p>Hi ${guest.name},</p><p>Thanks for confirming — we can't wait to celebrate with you!</p><p>${wedding.venue_name}, ${wedding.venue_address}<br>${wedding.wedding_date}</p>`,
      attachments: [
        { filename: "wedding.ics", content: Buffer.from(ics).toString("base64") },
      ],
    });
  } else if (guest.rsvp_status === "declined") {
    await resend.emails.send({
      from: `${coupleNames} <${fromAddress}>`,
      to: guest.email,
      subject: `We'll miss you — ${coupleNames}'s Wedding`,
      html: `<p>Hi ${guest.name},</p><p>Thanks for letting us know. We'll miss you, but hope to celebrate together another time!</p>`,
    });
  }

  return res.status(200).json({ sent: true });
}
