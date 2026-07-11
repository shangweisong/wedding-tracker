import { supabaseAdmin } from "./_lib/supabaseAdmin.js";
import { sendEmail, getFromAddress, missingEmailEnvVars } from "./_lib/emailProvider.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(dateStr) {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const wedding = new Date(dateStr);
  return Math.round((wedding - today) / DAY_MS);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(dateStr));
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display}:${m} ${suffix}`;
}

function mapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// Vercel Cron target (see vercel.json `crons`), runs daily.
// Sends confirmed guests a warm 90-day heads-up, then a practical 30-day
// logistics email with schedule, venue, dress code, and directions.
// Deduped via last_reminder_sent_at (90-day) and second_reminder_sent_at (30-day).
//
// Local testing: pass ?override_days=<n> to simulate any days-out value without
// touching the DB wedding date. Ignored in production (NODE_ENV=production).
export default async function handler(req, res) {
  const missing = missingEmailEnvVars();
  if (missing.length > 0) {
    return res.status(500).json({ error: `Missing env vars: ${missing.join(", ")}` });
  }

  // CRON_SECRET is mandatory — fail loudly if missing so misconfiguration is
  // obvious rather than silently leaving the endpoint open.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(500).json({ error: "CRON_SECRET env var is not set" });
  }
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const supabase = supabaseAdmin();
  const { data: wedding } = await supabase
    .from("weddings")
    .select("bride_name, groom_name, wedding_date, venue_name, venue_address, dress_code, tea_ceremony_time, ceremony_time, dinner_time, hero_image_url, getting_there, slug, is_published")
    .limit(1)
    .single();
  if (!wedding?.wedding_date) return res.status(200).json({ sent: 0, reason: "wedding not configured yet" });

  // Allow days override for local testing (ignored in production).
  let days;
  if (process.env.NODE_ENV !== "production" && req.query?.override_days !== undefined) {
    days = parseInt(req.query.override_days, 10);
  } else {
    days = daysUntil(wedding.wedding_date);
  }

  if (days > 90) return res.status(200).json({ sent: 0, reason: "more than 90 days out" });

  const { data: guests, error } = await supabase
    .from("guests")
    .select("id, name, email, rsvp_token, last_reminder_sent_at, second_reminder_sent_at")
    .eq("rsvp_status", "confirmed")
    .neq("email", "");

  if (error) return res.status(500).json({ error: error.message });

  let fromAddress;
  try {
    fromAddress = getFromAddress();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const coupleNames = `${wedding.bride_name} & ${wedding.groom_name}`;
  const siteUrl = (process.env.SITE_URL || "").replace(/\/$/, "");
  const weddingPageUrl = siteUrl && wedding.slug && wedding.is_published
    ? `${siteUrl}/wedding/${wedding.slug}`
    : "";

  const firstReminderIds = [];
  const secondReminderIds = [];

  for (const guest of guests) {
    // 90-day: warm heads-up, only if never reminded.
    const isFirstReminder = days <= 90 && !guest.last_reminder_sent_at;
    // 30-day: full logistics, only if first reminder already sent.
    const isSecondReminder = days <= 30 && guest.last_reminder_sent_at && !guest.second_reminder_sent_at;

    if (!isFirstReminder && !isSecondReminder) continue;

    const rsvpUrl = siteUrl && guest.rsvp_token ? `${siteUrl}/rsvp?token=${guest.rsvp_token}` : "";

    const subject = isFirstReminder
      ? `90 days to go — we can't wait to celebrate with you!`
      : `One month to go — everything you need for our wedding`;

    const html = isFirstReminder
      ? firstReminderHtml({ guest, wedding, coupleNames, weddingPageUrl })
      : secondReminderHtml({ guest, wedding, coupleNames, rsvpUrl });

    await sendEmail({ from: coupleNames, fromAddress, to: guest.email, subject, html });

    if (isFirstReminder) firstReminderIds.push(guest.id);
    else secondReminderIds.push(guest.id);
  }

  const now = new Date().toISOString();
  if (firstReminderIds.length > 0) {
    await supabase.from("guests").update({ last_reminder_sent_at: now }).in("id", firstReminderIds);
  }
  if (secondReminderIds.length > 0) {
    await supabase.from("guests").update({ second_reminder_sent_at: now }).in("id", secondReminderIds);
  }

  return res.status(200).json({ sent: firstReminderIds.length + secondReminderIds.length });
}

function heroRow(heroImageUrl, coupleNames) {
  if (!heroImageUrl) return "";
  return `<tr><td style="padding:0;line-height:0;">
    <img src="${heroImageUrl}" alt="${coupleNames}" width="520"
      style="display:block;width:100%;max-width:520px;height:auto;" />
  </td></tr>`;
}

function firstReminderHtml({ guest, wedding, coupleNames, weddingPageUrl }) {
  const weddingPageButton = weddingPageUrl
    ? `<p style="margin:24px 0 0;">
         <a href="${weddingPageUrl}"
            style="display:inline-block;padding:16px 36px;background:#c9a97a;color:#fff;
                   font-family:Georgia,serif;font-size:16px;text-decoration:none;border-radius:2px;
                   letter-spacing:0.04em;">
           View Wedding Details
         </a>
       </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f6f1;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f1;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="520" cellpadding="0" cellspacing="0"
        style="max-width:520px;width:100%;background:#fffdf9;border-radius:4px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        ${heroRow(wedding.hero_image_url, coupleNames)}
        <tr><td style="padding:40px 40px 32px;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#9c836a;font-family:Georgia,serif;">
            ${coupleNames}
          </p>
          <h1 style="margin:0 0 20px;font-size:24px;font-weight:normal;line-height:1.4;color:#3d2e22;font-family:Georgia,serif;">
            90 days to go, ${guest.name} —<br>we're so excited to see you!
          </h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#5c4a39;font-family:Georgia,serif;">
            Can you believe it's almost time? We're counting down the days and
            couldn't be more thrilled to have you there to share this moment with us.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background:#f9f5ef;border-left:3px solid #c9a97a;padding:16px 20px;border-radius:2px;">
              <p style="margin:0;font-size:14px;line-height:1.85;color:#3d2e22;font-family:Georgia,serif;">
                <strong>${formatDate(wedding.wedding_date)}</strong><br>
                ${wedding.venue_name}${wedding.dress_code ? `<br><em>Dress code: ${wedding.dress_code}</em>` : ""}
              </p>
            </td></tr>
          </table>
          ${weddingPageButton}
          <p style="margin:28px 0 0;font-size:13px;line-height:1.7;color:#9c836a;font-family:Georgia,serif;font-style:italic;">
            Full schedule and details will be in your next reminder — one month out.
          </p>
        </td></tr>
        <tr><td style="padding:16px 40px;background:#f2ede6;border-top:1px solid #e8e0d5;">
          <p style="margin:0;font-size:12px;color:#a89380;text-align:center;font-family:Georgia,serif;font-style:italic;">
            With love, ${coupleNames}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function secondReminderHtml({ guest, wedding, coupleNames, rsvpUrl }) {
  const teaLine = wedding.tea_ceremony_time
    ? `<tr>
         <td style="padding:6px 0;font-size:14px;color:#9c836a;font-family:Georgia,serif;white-space:nowrap;padding-right:16px;">Tea Ceremony</td>
         <td style="padding:6px 0;font-size:14px;color:#3d2e22;font-family:Georgia,serif;">${formatTime(wedding.tea_ceremony_time)}</td>
       </tr>`
    : "";

  const schedule = `
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${teaLine}
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#9c836a;font-family:Georgia,serif;white-space:nowrap;padding-right:16px;">Solemnisation</td>
        <td style="padding:6px 0;font-size:14px;color:#3d2e22;font-family:Georgia,serif;">${formatTime(wedding.ceremony_time)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#9c836a;font-family:Georgia,serif;white-space:nowrap;padding-right:16px;">Dinner Reception</td>
        <td style="padding:6px 0;font-size:14px;color:#3d2e22;font-family:Georgia,serif;">${formatTime(wedding.dinner_time)}</td>
      </tr>
    </table>`;

  const mapsButton = wedding.venue_address
    ? `<a href="${mapsUrl(wedding.venue_address)}"
          style="display:inline-block;margin-top:12px;padding:8px 18px;border:1px solid #c9a97a;
                 color:#9c836a;font-family:Georgia,serif;font-size:13px;text-decoration:none;
                 border-radius:2px;letter-spacing:0.04em;">
         Get Directions
       </a>`
    : "";

  const gettingThere = wedding.getting_there
    ? `<tr><td style="padding:24px 40px 0;">
         <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9c836a;font-family:Georgia,serif;">Getting There</p>
         <p style="margin:0;font-size:14px;line-height:1.75;color:#5c4a39;font-family:Georgia,serif;white-space:pre-line;">${wedding.getting_there}</p>
       </td></tr>`
    : "";

  const updateRsvp = rsvpUrl
    ? `<tr><td style="padding:24px 40px 0;">
         <p style="margin:0 0 10px;font-size:13px;color:#9c836a;font-family:Georgia,serif;">
           Changed your plans?
         </p>
         <a href="${rsvpUrl}"
            style="display:inline-block;padding:10px 24px;border:1px solid #c9a97a;color:#9c836a;
                   font-family:Georgia,serif;font-size:13px;text-decoration:none;border-radius:2px;
                   letter-spacing:0.04em;">
           Update RSVP
         </a>
       </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f6f1;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f1;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="520" cellpadding="0" cellspacing="0"
        style="max-width:520px;width:100%;background:#fffdf9;border-radius:4px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        ${heroRow(wedding.hero_image_url, coupleNames)}
        <tr><td style="padding:40px 40px 8px;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#9c836a;font-family:Georgia,serif;">
            ${coupleNames}
          </p>
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:normal;line-height:1.4;color:#3d2e22;font-family:Georgia,serif;">
            One month to go, ${guest.name}!<br>Here's everything you need.
          </h1>
          <p style="margin:0;font-size:15px;line-height:1.8;color:#5c4a39;font-family:Georgia,serif;">
            It's almost here — and we're beyond excited to celebrate with you.
            Everything you need for the day is below.
          </p>
        </td></tr>

        <tr><td style="padding:24px 40px 0;">
          <p style="margin:0 0 12px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9c836a;font-family:Georgia,serif;">Schedule</p>
          <table width="100%" cellpadding="0" cellspacing="0"
            style="background:#f9f5ef;border-left:3px solid #c9a97a;padding:16px 20px;border-radius:2px;">
            <tr><td style="padding:0 20px 0;">
              ${schedule}
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:24px 40px 0;">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9c836a;font-family:Georgia,serif;">Venue</p>
          <p style="margin:0;font-size:14px;line-height:1.75;color:#3d2e22;font-family:Georgia,serif;">
            <strong>${wedding.venue_name}</strong><br>
            ${wedding.venue_address || ""}
          </p>
          ${mapsButton}
        </td></tr>

        ${wedding.dress_code ? `
        <tr><td style="padding:24px 40px 0;">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9c836a;font-family:Georgia,serif;">Dress Code</p>
          <p style="margin:0;font-size:14px;color:#3d2e22;font-family:Georgia,serif;">${wedding.dress_code}</p>
        </td></tr>` : ""}

        ${gettingThere}
        ${updateRsvp}

        <tr><td style="padding:32px 40px 20px;">
        </td></tr>
        <tr><td style="padding:16px 40px;background:#f2ede6;border-top:1px solid #e8e0d5;">
          <p style="margin:0;font-size:12px;color:#a89380;text-align:center;font-family:Georgia,serif;font-style:italic;">
            With love, ${coupleNames}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
