// Merged check-in + angbao helpers (pure), #151.
//
// Since #151 the D-Day Guest List is the single dashboard: both roles toggle a
// guest's "angbao received" flag through the `set_guest_angbao_received`
// security-definer RPC (helpers see only the boolean — amounts stay couple-only
// and never enter their projection). Receiving auto-checks the guest in and
// mints their lucky-draw number; clearing zeroes the amount and releases the
// number (#150 pool) but keeps the guest checked in. Checking a guest IN with
// the feature enabled prompts the receptionist to ask about the angbao.
// Follows the `checkin.js` / `draw.js` pattern: pure helpers here, network
// calls in `src/lib/supabase.js`.

// Should checking this guest in open the "🧧 Angbao received?" prompt?
export function shouldPromptAngbao(guest, becomingCheckedIn, angbaoEnabled) {
  return !!becomingCheckedIn && !!angbaoEnabled && !guest.angbao_given;
}

// Return a copy of `guest` with the received state applied optimistically,
// mirroring the RPC's server-side writes. `nowIso` stamps the auto-check-in.
export function applyAngbaoReceived(guest, received, nowIso) {
  if (received) {
    return {
      ...guest,
      angbao_given: true,
      checked_in: true,
      checked_in_at: guest.checked_in_at ?? nowIso,
    };
  }
  return { ...guest, angbao_given: false, angbao_amount: 0, draw_number: null };
}

// Build the argument object for `set_guest_angbao_received(p_guest_id, p_received)`.
export function angbaoReceivedArgs(guestId, received) {
  return { p_guest_id: guestId, p_received: !!received };
}
