// Admin D-Day guest search matching.
//
// The search bar accepts two kinds of query:
//   • "#123" — a lucky-draw-number lookup (exact match on guest.draw_number).
//              A bare "#" lists every guest that has a draw number assigned.
//   • anything else — case-insensitive substring match on name OR table number.
//
// This is deliberately separate from src/lib/nameMatch.js, which does pg_trgm
// fuzzy matching for the public RSVP RPC; admin search is exact/substring.

// Parse a raw search string into a typed query: { kind: "draw" | "text", term }.
export function parseGuestSearch(raw) {
  const trimmed = (raw ?? "").trim();
  if (trimmed.startsWith("#")) {
    return { kind: "draw", term: trimmed.slice(1).trim() };
  }
  return { kind: "text", term: trimmed.toLowerCase() };
}

// Does a guest match the raw search string?
export function guestMatchesSearch(guest, raw) {
  const { kind, term } = parseGuestSearch(raw);
  if (kind === "draw") {
    if (guest.draw_number == null) return false; // unassigned never matches "#..."
    if (term === "") return true;                // bare "#": all numbered guests
    return String(guest.draw_number) === term;   // exact match
  }
  if (term === "") return true;                  // blank query = show all
  return (
    guest.name.toLowerCase().includes(term) ||
    String(guest.table_number ?? "").includes(term)
  );
}
