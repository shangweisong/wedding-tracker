import { createClient } from "@supabase/supabase-js";
import { checkinArgs } from "./checkin.js";
import { releaseDrawArgs } from "./draw.js";
import { angbaoReceivedArgs } from "./angbao.js";

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
  subscribeToChanges(table, callback, intervalMs = 5000) {
    // Polling fallback for real-time (works without Supabase Realtime setup).
    // Pass a longer intervalMs for relaxed feeds (e.g. the public photowall).
    const interval = setInterval(callback, intervalMs);
    return () => clearInterval(interval);
  },
  // Calls a Postgres RPC function (e.g. the public RSVP functions, which are
  // `security definer` and exposed to the `anon` role for the public form).
  async rpc(fn, args) {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw error;
    return data;
  },
  // Atomically mint (or re-read) a guest's lucky-draw number. Since #150 the
  // allocator (migration 0012) hands out the lowest free number — distinct,
  // collision-free, and released numbers are reused.
  async assignDraw(guestId) {
    const { data, error } = await supabase.rpc("assign_draw_number", { p_guest_id: guestId });
    if (error) throw error;
    return data;
  },
  // Return a guest's lucky-draw number to the pool (angbao unmarked, #150).
  async releaseDraw(guestId) {
    const { error } = await supabase.rpc("release_draw_number", releaseDrawArgs(guestId));
    if (error) throw error;
  },
  // Merged check-in + angbao toggle (#151), callable by both roles. Receiving
  // auto-checks-in and mints the draw number; clearing releases it. Returns
  // { draw_number, checked_in_at } for optimistic reconciliation.
  async setAngbaoReceived(guestId, received) {
    const { data, error } = await supabase.rpc("set_guest_angbao_received", angbaoReceivedArgs(guestId, received));
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  },
  // D-Day check-in. Routes through the `set_guest_checkin` security-definer RPC so
  // the bridal-team (helper) account — which since #92 has no direct UPDATE on
  // guests — can still check guests in. The RPC touches only the check-in columns
  // and returns the server `checked_in_at` for optimistic reconciliation.
  async setCheckin(guestId, checkedIn) {
    const { data, error } = await supabase.rpc("set_guest_checkin", checkinArgs(guestId, checkedIn));
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

  // ── Guest photowall (#138) ───────────────────────────────────────────────────
  // Couple-only moderation, enforced by the photowall_couple_all RLS policy
  // (0011): list every photo (any status) and hide/unhide. Deletion goes
  // through /api/photowall so the storage object is removed too.
  async listPhotowallPhotos() {
    const { data, error } = await supabase
      .from("photowall_photos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  async setPhotowallStatus(id, status) {
    const { error } = await supabase.from("photowall_photos").update({ status }).eq("id", id);
    if (error) throw error;
  },

  // ── Vendor CRUD ──────────────────────────────────────────────────────────────

  async listVendors() {
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  },

  async insertVendor(data) {
    const { data: rows, error } = await supabase.from("vendors").insert(data).select();
    if (error) throw error;
    return rows?.[0] ?? null;
  },

  async updateVendor(id, data) {
    const { data: rows, error } = await supabase
      .from("vendors")
      .update(data)
      .eq("id", id)
      .select();
    if (error) throw error;
    return rows?.[0] ?? null;
  },

  async deleteVendor(id) {
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) throw error;
  },
};
