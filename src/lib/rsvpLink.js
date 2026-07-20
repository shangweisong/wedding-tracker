// RSVP link builder shared by the admin copy-link and QR-code features (#155).
// A truthy token yields the personalized link (/rsvp?token=…, hydrated by the
// get_guest_by_rsvp_token RPC); otherwise the generic /rsvp form link.
export function buildRsvpLink(origin, token) {
  return token ? `${origin}/rsvp?token=${encodeURIComponent(token)}` : `${origin}/rsvp`;
}
