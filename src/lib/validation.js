// ─── INPUT VALIDATION ─────────────────────────────────────────────────────────
// Client-side hygiene for fast feedback; the database CHECK constraints
// (see supabase/migrations) are the authoritative enforcement.
export const MAX_NAME = 120,
  MAX_NOTES = 500,
  MAX_TABLE = 20,
  MAX_ANGBAO = 10_000_000;
export const PARTIES = ["", "bride", "groom"];

export const cleanName = (v) => String(v ?? "").trim().slice(0, MAX_NAME);
export const cleanNotes = (v) => String(v ?? "").trim().slice(0, MAX_NOTES);
export const cleanTable = (v) => String(v ?? "").trim().slice(0, MAX_TABLE) || "1";
export const cleanParty = (v) => {
  const p = String(v ?? "").toLowerCase().trim();
  return PARTIES.includes(p) ? p : "";
};
export const cleanAmount = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_ANGBAO) : 0;
};
