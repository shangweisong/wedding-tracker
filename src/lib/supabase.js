import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
// Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sign-in emails for the two roles. Passwords are never stored in the bundle —
// users type them on the unlock screen and Supabase Auth verifies server-side.
// Only the (non-secret) emails live in config.
export const COUPLE_EMAIL = import.meta.env.VITE_COUPLE_EMAIL || "couple@wedding.local";
export const HELPER_EMAIL = import.meta.env.VITE_HELPER_EMAIL || "helper@wedding.local";

// Returns 'couple', 'helper', or null (unknown / not signed in).
export function getRole(email) {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  if (e === COUPLE_EMAIL.trim().toLowerCase()) return "couple";
  if (e === HELPER_EMAIL.trim().toLowerCase()) return "helper";
  return null;
}

export const isDemoMode = !SUPABASE_URL || !SUPABASE_ANON_KEY;

// ─── SUPABASE CLIENT (official SDK) ───────────────────────────────────────────
// The SDK manages the auth session + token refresh and builds queries safely
// (user input is never string-interpolated into a request URL). All data access
// runs as the signed-in helper, so RLS (authenticated-only) is the real gate.
export const supabase = isDemoMode
  ? null
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });

// Thin wrapper preserving the original call sites used throughout the app.
export const sb = {
  async select(table) {
    const { data, error } = await supabase.from(table).select("*").order("name", { ascending: true });
    if (error) throw error;
    return data;
  },
  async insert(table, data) {
    const { data: rows, error } = await supabase.from(table).insert(data).select();
    if (error) throw error;
    return rows;
  },
  async update(table, id, data) {
    const { data: rows, error } = await supabase.from(table).update(data).eq("id", id).select();
    if (error) throw error;
    return rows;
  },
  async delete(table, id) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
  },
  subscribeToChanges(table, callback) {
    // Polling fallback for real-time (works without Supabase Realtime setup)
    const interval = setInterval(callback, 5000);
    return () => clearInterval(interval);
  },
  // Calls a Postgres RPC function (e.g. the public RSVP functions, which are
  // `security definer` and exposed to the `anon` role for the public form).
  async rpc(fn, args) {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw error;
    return data;
  },
  // Atomically mint (or re-read) a guest's lucky-draw number. See the
  // assign_draw_number migration — distinct, assign-once, collision-free.
  async assignDraw(guestId) {
    const { data, error } = await supabase.rpc("assign_draw_number", { p_guest_id: guestId });
    if (error) throw error;
    return data;
  },
  // Guest-uploaded ang-bao submissions, newest first (own ordering — the table
  // has no `name` column, so it can't reuse select()).
  async listSubmissions() {
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  // Short-lived signed URL so a helper can view a receipt in the private bucket.
  async receiptUrl(path) {
    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 60);
    if (error) throw error;
    return data.signedUrl;
  },
};
