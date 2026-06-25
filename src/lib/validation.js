// ─── INPUT VALIDATION ─────────────────────────────────────────────────────────
// Client-side hygiene for fast feedback; the database CHECK constraints
// (see supabase/migrations) are the authoritative enforcement.
export const MAX_NAME = 120,
  MAX_NOTES = 500,
  MAX_TABLE = 20,
  MAX_ANGBAO = 10_000_000,
  MAX_EMAIL = 254;
export const PARTIES = ["", "bride", "groom"];
export const RELATIONSHIP_GROUPS = ["", "family", "colleagues", "friends", "other"];
export const FRIEND_SUBGROUPS = [
  "", "army", "primary_school", "secondary_school", "tertiary", "university", "other",
];

export const cleanName = (v) => String(v ?? "").trim().slice(0, MAX_NAME);
export const cleanNotes = (v) => String(v ?? "").trim().slice(0, MAX_NOTES);
export const cleanTable = (v) => String(v ?? "").trim().slice(0, MAX_TABLE) || "1";
export const cleanParty = (v) => {
  const p = String(v ?? "").toLowerCase().trim();
  return PARTIES.includes(p) ? p : "";
};
export const cleanRelationshipGroup = (v) => {
  const g = String(v ?? "").toLowerCase().trim();
  return RELATIONSHIP_GROUPS.includes(g) ? g : "";
};
export const cleanFriendSubgroup = (v) => {
  const s = String(v ?? "").toLowerCase().trim();
  return FRIEND_SUBGROUPS.includes(s) ? s : "";
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const cleanEmail = (v) => {
  const e = String(v ?? "").trim().slice(0, MAX_EMAIL);
  return EMAIL_RE.test(e) ? e : "";
};
export const cleanAmount = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_ANGBAO) : 0;
};
