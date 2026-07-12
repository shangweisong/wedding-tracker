import { Resend } from "resend";
import nodemailer from "nodemailer";

// Unified email sender. Set EMAIL_PROVIDER to one of:
//   "gmail"   — GMAIL_FROM + GMAIL_APP_PASSWORD  ← no domain needed
//   "resend"  — RESEND_API_KEY + RESEND_SENDING_DOMAIN  ← requires verified domain
//
// Switching providers = change EMAIL_PROVIDER in Vercel env vars. No code change needed.

/**
 * @param {object} opts
 * @param {string} opts.from        Display name, e.g. "Wei Ming & Siew Yong"
 * @param {string} opts.fromAddress e.g. "rsvp@yourdomain.com" or Gmail address
 * @param {string} opts.to          Recipient email
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {Array<{filename: string, content: string}>} [opts.attachments]  base64 content
 */
export async function sendEmail({ from, fromAddress, to, subject, html, attachments = [] }) {
  const provider = (process.env.EMAIL_PROVIDER || "gmail").toLowerCase();

  if (provider === "gmail") {
    return sendViaGmail({ from, fromAddress, to, subject, html, attachments });
  }
  return sendViaResend({ from, fromAddress, to, subject, html, attachments });
}

export function getFromAddress() {
  const provider = (process.env.EMAIL_PROVIDER || "gmail").toLowerCase();

  if (provider === "gmail") {
    const addr = process.env.GMAIL_FROM;
    if (!addr) throw new Error("Missing GMAIL_FROM");
    return addr;
  }
  const addr = process.env.RESEND_FROM_EMAIL || `rsvp@${process.env.RESEND_SENDING_DOMAIN}`;
  if (!addr || addr === "rsvp@undefined") throw new Error("Missing RESEND_FROM_EMAIL or RESEND_SENDING_DOMAIN");
  return addr;
}

// Returns a list of missing required env var names for the configured provider.
// Call at the top of each API handler to catch misconfiguration early.
export function missingEmailEnvVars() {
  const provider = (process.env.EMAIL_PROVIDER || "gmail").toLowerCase();
  const missing = [];

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (provider === "gmail") {
    if (!process.env.GMAIL_FROM) missing.push("GMAIL_FROM");
    if (!process.env.GMAIL_APP_PASSWORD) missing.push("GMAIL_APP_PASSWORD");
  } else {
    if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
    const hasFrom = process.env.RESEND_FROM_EMAIL || process.env.RESEND_SENDING_DOMAIN;
    if (!hasFrom) missing.push("RESEND_FROM_EMAIL (or RESEND_SENDING_DOMAIN)");
  }

  return missing;
}

async function sendViaGmail({ from, fromAddress, to, subject, html, attachments }) {
  if (!process.env.GMAIL_APP_PASSWORD) throw new Error("Missing GMAIL_APP_PASSWORD");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: fromAddress,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `${from} <${fromAddress}>`,
    to,
    subject,
    html,
    ...(attachments.length > 0 && {
      attachments: attachments.map(({ filename, content }) => ({
        filename,
        content,
        encoding: "base64",
      })),
    }),
  });
}

async function sendViaResend({ from, fromAddress, to, subject, html, attachments }) {
  if (!process.env.RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");
  const resend = new Resend(process.env.RESEND_API_KEY);
  // The Resend SDK never throws — it returns { data, error } even for network
  // failures. Surface errors as rejections so callers don't record a send
  // (reminder dedup stamps, host notifications) that never happened.
  const { error } = await resend.emails.send({
    from: `${from} <${fromAddress}>`,
    to,
    subject,
    html,
    ...(attachments.length > 0 && { attachments }),
  });
  if (error) throw new Error(`Resend send failed: ${error.message || error.name || "unknown error"}`);
}

