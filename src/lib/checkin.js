// D-Day check-in helpers (pure).
//
// Check-in is the one guest write the bridal-team (helper) account is allowed to
// perform. Since #92 the helper no longer has direct UPDATE on `guests` — the
// write is routed through the `set_guest_checkin` security-definer RPC, which can
// only touch the two check-in columns. These pure helpers shape the RPC payload
// and the optimistic client-side guest update; the network call lives in
// `src/lib/supabase.js` (`sb.setCheckin`).

// Build the argument object for the `set_guest_checkin(p_guest_id, p_checked_in)`
// RPC. The boolean is coerced so a truthy/falsy caller value maps cleanly.
export function checkinArgs(guestId, checkedIn) {
  return { p_guest_id: guestId, p_checked_in: !!checkedIn };
}

// Return a copy of `guest` with the check-in state applied optimistically.
// `nowIso` is the timestamp to stamp on check-in (cleared on un-check); callers
// pass `new Date().toISOString()`. The input is never mutated.
export function applyCheckin(guest, checkedIn, nowIso) {
  const on = !!checkedIn;
  return { ...guest, checked_in: on, checked_in_at: on ? nowIso : null };
}
