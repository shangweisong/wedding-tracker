// Role-based guest data source (pure).
//
// Since #99 the helper account has no direct SELECT on `guests` (RLS denies it
// so couple-only columns — notes, angbao_amount, rsvp_token, contact details —
// never reach the helper's browser). The helper instead reads the
// `get_checkin_guests` security-definer projection, which returns only the
// D-Day columns. This pure helper picks the fetch path; the network call lives
// in `src/lib/supabase.js` / `AdminApp.jsx` (`loadGuests`).
//
// Anything that isn't exactly the helper role (couple, role not yet resolved,
// unknown) takes the direct select: RLS is the real gate, so a wrong client-side
// guess degrades to an empty list, never to a data leak.
export function guestFetchPlan(role) {
  return role === "helper"
    ? { kind: "rpc", fn: "get_checkin_guests" }
    : { kind: "select", table: "guests" };
}
