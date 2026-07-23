// ─── OPEN RSVP (self-registration, #126) ──────────────────────────────────────
// Pure helpers for the open-RSVP mode where guests are not cross-checked
// against the guest list. The PIN is a shared invitation secret verified
// server-side (register_open_rsvp RPC); client-side hygiene only, the database
// is the authoritative enforcement (see supabase/migrations/0008_open_rsvp.sql).
export const MAX_PIN = 20;

export const cleanPin = (v) => String(v ?? "").trim().slice(0, MAX_PIN);

// Open mode never applies in demo mode (which already fakes a free-text flow)
// and never overrides a real token (?token= link or a selected guest).
export const isOpenMode = ({ wedding, isDemoMode, activeToken }) =>
  !isDemoMode && !activeToken && !!wedding?.enable_open_rsvp;

// register_open_rsvp returns {token} on success or {error: code} for pin
// failures — returned (not raised) so the server's failed-attempt record
// commits and the brute-force rate limit actually accumulates.
export const registerResultErrorKey = (error) => {
  if (error === "invalid_pin") return "rsvp.err.pinInvalid";
  if (error === "too_many_attempts") return "rsvp.err.tooManyAttempts";
  return "rsvp.err.generic";
};

// Maps a submit/register RPC error message to an i18n key — the same matching
// the RSVP submit catch used inline before open mode added the pin case.
export const openRsvpErrorKey = (message) => {
  const msg = String(message ?? "").toLowerCase();
  if (msg.includes("function") || msg.includes("does not exist") || msg.includes("pgrst")) {
    return "rsvp.err.notSetup";
  }
  if (msg.includes("invalid rsvp token")) return "rsvp.err.linkExpired";
  if (msg.includes("invalid rsvp pin")) return "rsvp.err.pinInvalid";
  return "rsvp.err.generic";
};
