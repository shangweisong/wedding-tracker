import { supabaseAdmin } from "./_lib/supabaseAdmin.js";
import { buildIcs } from "./_lib/ics.js";
import { sendEmail, getFromAddress, missingEmailEnvVars } from "./_lib/emailProvider.js";
import { escapeHtml, sanitizeSubject } from "./_lib/escapeHtml.js";
import { secureCompare } from "./_lib/secureCompare.js";

function toTitleCase(str) {
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(dateStr));
}

function updateRsvpButton(rsvpUrl) {
  if (!rsvpUrl) return "";
  return `
    <tr><td style="padding:24px 48px 0;">
      <p style="margin:0 0 10px;font-size:13px;color:#9c836a;font-family:Georgia,serif;">
        Need to update your response?
      </p>
      <a href="${escapeHtml(rsvpUrl)}"
         style="display:inline-block;padding:10px 24px;border:1px solid #c9a97a;color:#9c836a;
                font-family:Georgia,serif;font-size:13px;text-decoration:none;border-radius:2px;
                letter-spacing:0.04em;">
        Update RSVP
      </a>
    </td></tr>`;
}

function emailShell({ coupleNames, heroImageUrl, children }) {
  const hero = heroImageUrl
    ? `<tr><td style="padding:0;line-height:0;">
        <img src="${escapeHtml(heroImageUrl)}" alt="${escapeHtml(coupleNames)}" width="600"
          style="display:block;width:100%;max-width:600px;height:auto;" />
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f6f1;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f1;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0"
        style="max-width:600px;width:100%;background:#fffdf9;border-radius:4px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        ${hero}
        ${children}
        <tr><td style="padding:20px 48px;background:#f2ede6;border-top:1px solid #e8e0d5;">
          <p style="margin:0;font-size:12px;color:#a89380;text-align:center;font-family:Georgia,serif;font-style:italic;">
            With love, ${escapeHtml(coupleNames)}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function confirmedHtml({ guestName, coupleNames, heroImageUrl, venue, address, date, ceremonyTime, dinnerTime, rsvpUrl }) {
  return emailShell({
    coupleNames,
    heroImageUrl,
    children: `
      <tr><td style="padding:40px 48px 32px;">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#9c836a;font-family:Georgia,serif;">
          ${escapeHtml(coupleNames)}
        </p>
        <h1 style="margin:0 0 20px;font-size:26px;font-weight:normal;line-height:1.35;color:#3d2e22;font-family:Georgia,serif;">
          We can't wait to celebrate<br>with you, ${escapeHtml(guestName)}.
        </h1>
        <p style="margin:0 0 28px;font-size:15px;line-height:1.75;color:#5c4a39;font-family:Georgia,serif;">
          Thank you for confirming your attendance — it means the world to us
          that you'll be there to share this special day.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:#f9f5ef;border-left:3px solid #c9a97a;padding:20px 24px;border-radius:2px;">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9c836a;font-family:Georgia,serif;">
              Event Details
            </p>
            <p style="margin:0;font-size:15px;line-height:1.85;color:#3d2e22;font-family:Georgia,serif;">
              <strong>${escapeHtml(venue)}</strong><br>
              ${escapeHtml(address)}<br>
              ${escapeHtml(date)}<br>
              Ceremony: ${escapeHtml(ceremonyTime)}&nbsp;&nbsp;·&nbsp;&nbsp;Dinner: ${escapeHtml(dinnerTime)}
            </p>
          </td></tr>
        </table>
        <p style="margin:24px 0 0;font-size:13px;color:#9c836a;font-family:Georgia,serif;font-style:italic;">
          A calendar invite is attached to this email for your convenience.
        </p>
      </td></tr>
      ${updateRsvpButton(rsvpUrl)}`,
  });
}

function declinedHtml({ guestName, coupleNames, heroImageUrl, rsvpUrl }) {
  return emailShell({
    coupleNames,
    heroImageUrl,
    children: `
      <tr><td style="padding:40px 48px 32px;">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#9c836a;font-family:Georgia,serif;">
          ${escapeHtml(coupleNames)}
        </p>
        <h1 style="margin:0 0 20px;font-size:26px;font-weight:normal;line-height:1.35;color:#3d2e22;font-family:Georgia,serif;">
          We'll miss you, ${escapeHtml(guestName)}.
        </h1>
        <p style="margin:0;font-size:15px;line-height:1.75;color:#5c4a39;font-family:Georgia,serif;">
          Thank you for letting us know. We'll miss having you there, but we hope
          to celebrate together another time soon.
        </p>
      </td></tr>
      ${updateRsvpButton(rsvpUrl)}`,
  });
}

function hostNotificationHtml({ guestName, oldStatus, newStatus, mealChoice, dietaryNotes }) {
  const statusLabel = { confirmed: "attending", declined: "not attending" };
  const changeDesc = `${statusLabel[oldStatus] ?? oldStatus} → ${statusLabel[newStatus] ?? newStatus}`;
  const mealLine = newStatus === "confirmed" && mealChoice
    ? `<p style="margin:8px 0 0;font-size:14px;color:#3d2e22;font-family:Georgia,serif;">
        Meal: ${escapeHtml(mealChoice)}${dietaryNotes ? ` · Notes: ${escapeHtml(dietaryNotes)}` : ""}
       </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f9f6f1;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
    <tr><td style="background:#fffdf9;border-radius:4px;padding:28px 32px;box-shadow:0 1px 4px rgba(0,0,0,.08);">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9c836a;">RSVP Update</p>
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:normal;color:#3d2e22;">${escapeHtml(guestName)} changed their RSVP</h2>
      <p style="margin:0;font-size:15px;color:#5c4a39;font-family:Georgia,serif;">${escapeHtml(changeDesc)}</p>
      ${mealLine}
    </td></tr>
  </table>
</body>
</html>`;
}

// Webhook target for the `guests_rsvp_status_webhook` Postgres trigger
// (supabase/migrations/0007_email_automation.sql).
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Auth first: callers without the shared secret learn nothing about config state.
  const secret = process.env.RSVP_WEBHOOK_SECRET;
  if (!secret || !secureCompare(req.headers["x-webhook-secret"], secret)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const missing = missingEmailEnvVars();
  if (missing.length > 0) {
    console.error("[send-rsvp-email] missing env vars:", missing.join(", "));
    return res.status(500).json({ error: "email sending is not configured" });
  }

  const { guest_id: guestId, old_rsvp_status: oldStatus } = req.body ?? {};
  if (!guestId) return res.status(400).json({ error: "missing guest_id" });

  const supabase = supabaseAdmin();
  const { data: guest, error } = await supabase
    .from("guests")
    .select("name, email, rsvp_status, rsvp_token, meal_choice, dietary_notes")
    .eq("id", guestId)
    .single();

  if (error || !guest) return res.status(404).json({ error: "guest not found" });
  if (!guest.email) return res.status(200).json({ skipped: "no email on file" });

  const { data: wedding } = await supabase
    .from("weddings")
    .select("bride_name, groom_name, hero_image_url, wedding_date, ceremony_time, dinner_time, venue_name, venue_address")
    .limit(1)
    .single();
  if (!wedding) return res.status(200).json({ skipped: "wedding not configured" });

  const coupleNames = `${wedding.bride_name} & ${wedding.groom_name}`;
  const guestName = toTitleCase(guest.name);
  const heroImageUrl = wedding.hero_image_url || "";

  const siteUrl = (process.env.SITE_URL || "").replace(/\/$/, "");
  const rsvpUrl = siteUrl && guest.rsvp_token ? `${siteUrl}/rsvp?token=${guest.rsvp_token}` : "";

  let fromAddress;
  try {
    fromAddress = getFromAddress();
  } catch (e) {
    console.error("[send-rsvp-email] from-address error:", e?.message || e);
    return res.status(500).json({ error: "email sending is not configured" });
  }

  if (guest.rsvp_status === "confirmed") {
    const ics = buildIcs({
      coupleNames,
      date: wedding.wedding_date,
      ceremonyTime: wedding.ceremony_time.slice(0, 5),
      dinnerTime: wedding.dinner_time.slice(0, 5),
      venueName: wedding.venue_name,
      venueAddress: wedding.venue_address,
    });

    await sendEmail({
      from: coupleNames,
      fromAddress,
      to: guest.email,
      subject: sanitizeSubject(`You're confirmed! ${coupleNames}'s Wedding`),
      html: confirmedHtml({
        guestName,
        coupleNames,
        heroImageUrl,
        venue: wedding.venue_name,
        address: wedding.venue_address,
        date: formatDate(wedding.wedding_date),
        ceremonyTime: wedding.ceremony_time.slice(0, 5),
        dinnerTime: wedding.dinner_time.slice(0, 5),
        rsvpUrl,
      }),
      attachments: [
        { filename: "wedding.ics", content: Buffer.from(ics).toString("base64") },
      ],
    });
  } else if (guest.rsvp_status === "declined") {
    await sendEmail({
      from: coupleNames,
      fromAddress,
      to: guest.email,
      subject: sanitizeSubject(`We'll miss you — ${coupleNames}'s Wedding`),
      html: declinedHtml({ guestName, coupleNames, heroImageUrl, rsvpUrl }),
    });
  }

  // Host notification — only when a guest changes their mind (not first-time RSVP).
  // old_rsvp_status is 'confirmed' or 'declined' means they had previously decided.
  const hostEmail = process.env.HOST_EMAIL;
  if (hostEmail && (oldStatus === "confirmed" || oldStatus === "declined")) {
    const statusLabel = { confirmed: "attending", declined: "not attending" };
    await sendEmail({
      from: coupleNames,
      fromAddress,
      to: hostEmail,
      subject: sanitizeSubject(`RSVP change: ${guestName} is now ${statusLabel[guest.rsvp_status] ?? guest.rsvp_status}`),
      html: hostNotificationHtml({
        guestName,
        oldStatus,
        newStatus: guest.rsvp_status,
        mealChoice: guest.meal_choice,
        dietaryNotes: guest.dietary_notes,
      }),
    });
  }

  return res.status(200).json({ sent: true });
}
