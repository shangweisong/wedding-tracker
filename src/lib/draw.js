// Lucky-draw number helpers (pure).
//
// Since #150, draw numbers are a reusable pool: unmarking an angbao releases
// the guest's number (set to null via the `release_draw_number` RPC) and
// allocation always hands out the lowest free positive integer, keeping the
// numbers dense (1..N) to match physical ticket stubs. The server-side
// allocator lives in `assign_draw_number` (migration 0012); `nextFreeDraw`
// mirrors it for demo mode. Follows the `src/lib/checkin.js` pattern: pure
// helpers here, the network calls in `src/lib/supabase.js`.

// Lowest positive integer not currently held by any guest.
export function nextFreeDraw(guests) {
  const held = new Set();
  for (const g of guests) {
    if (g.draw_number) held.add(g.draw_number);
  }
  let n = 1;
  while (held.has(n)) n++;
  return n;
}

// Return a copy of `guest` with its draw number released. Never mutates.
export function applyDrawRelease(guest) {
  return { ...guest, draw_number: null };
}

// Build the argument object for the `release_draw_number(p_guest_id)` RPC.
export function releaseDrawArgs(guestId) {
  return { p_guest_id: guestId };
}
