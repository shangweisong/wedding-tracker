import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { cleanName, cleanNotes, cleanTable, cleanParty, cleanAmount } from "./lib/validation.js";
import { parseCSV, toCSV } from "./lib/csv.js";
import { formatTime } from "./lib/format.js";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
// Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Shared sign-in identity for wedding-day helpers. The PASSWORD is never stored
// in the bundle — helpers type it on the unlock screen and Supabase Auth
// verifies it on the server. Only the (non-secret) email lives in config.
const HELPER_EMAIL = import.meta.env.VITE_HELPER_EMAIL || "helpers@wedding.local";

const isDemoMode = !SUPABASE_URL || !SUPABASE_ANON_KEY;

// ─── SUPABASE CLIENT (official SDK) ───────────────────────────────────────────
// The SDK manages the auth session + token refresh and builds queries safely
// (user input is never string-interpolated into a request URL). All data access
// runs as the signed-in helper, so RLS (authenticated-only) is the real gate.
const supabase = isDemoMode
  ? null
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });

// Thin wrapper preserving the original call sites used throughout the app.
const sb = {
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
};

// ─── DEMO MODE (no Supabase) ──────────────────────────────────────────────────
const DEMO_GUESTS = [
  { id: 1, name: "Tan Wei Ming", table_number: 1, checked_in: true, checked_in_at: "2024-06-15T18:32:00", angbao_given: true, angbao_amount: 200, notes: "Best man", is_vip: true },
  { id: 2, name: "Lim Siew Yong", table_number: 1, checked_in: true, checked_in_at: "2024-06-15T18:45:00", angbao_given: true, angbao_amount: 150, notes: "", is_vip: false },
  { id: 3, name: "Ahmad Razif", table_number: 2, checked_in: false, checked_in_at: null, angbao_given: false, angbao_amount: 0, notes: "Vegetarian", is_vip: false },
  { id: 4, name: "Priya Nair", table_number: 2, checked_in: true, checked_in_at: "2024-06-15T19:01:00", angbao_given: true, angbao_amount: 100, notes: "", is_vip: false },
  { id: 5, name: "Chen Jing Wen", table_number: 3, checked_in: false, checked_in_at: null, angbao_given: false, angbao_amount: 0, notes: "", is_vip: false },
  { id: 6, name: "Ng Boon Kiat", table_number: 3, checked_in: true, checked_in_at: "2024-06-15T19:15:00", angbao_given: false, angbao_amount: 0, notes: "Uncle of groom", is_vip: true },
  { id: 7, name: "Siti Rahimah", table_number: 4, checked_in: false, checked_in_at: null, angbao_given: false, angbao_amount: 0, notes: "", is_vip: false },
  { id: 8, name: "David Koh", table_number: 4, checked_in: true, checked_in_at: "2024-06-15T18:50:00", angbao_given: true, angbao_amount: 300, notes: "Boss", is_vip: true },
];

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = {
  Check: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>,
  X: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Search: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Upload: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16,16 12,12 8,16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39,18.39A5,5,0,0,0,18,9h-1.26A8,8,0,1,0,3,16.3"/></svg>,
  Gift: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,12 20,22 4,22 4,12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12,7H7.5a2.5,2.5,0,0,1,0-5C11,2,12,7,12,7z"/><path d="M12,7h4.5a2.5,2.5,0,0,0,0-5C13,2,12,7,12,7z"/></svg>,
  Table: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg>,
  Star: () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>,
  Plus: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Download: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="8,17 12,21 16,17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88,18.09A5,5,0,0,0,18,9h-1.26A8,8,0,1,0,3,16.3"/></svg>,
  Refresh: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23,4 23,10 17,10"/><path d="M20.49,15a9,9,0,1,1-2.12-9.36L23,10"/></svg>,
  Edit: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11,4H4A2,2,0,0,0,2,6V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V13"/><path d="M18.5,2.5a2.121,2.121,0,0,1,3,3L12,15l-4,1,1-4Z"/></svg>,
  Trash: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/><path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V6"/></svg>,
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --cream: #faf7f2;
    --warm-white: #f5f0e8;
    --gold: #c9a84c;
    --gold-light: #e8d5a3;
    --gold-dark: #a07830;
    --charcoal: #2c2416;
    --brown: #5c4a2a;
    --red: #c0392b;
    --red-soft: #fdf0ee;
    --green: #2d6a4f;
    --green-soft: #edf7f2;
    --shadow: 0 2px 20px rgba(44,36,22,0.08);
    --shadow-lg: 0 8px 40px rgba(44,36,22,0.12);
    --radius: 12px;
  }

  body { font-family: 'DM Sans', sans-serif; background: var(--cream); color: var(--charcoal); }

  .app { min-height: 100vh; }

  /* HEADER */
  .header {
    background: var(--charcoal);
    padding: 24px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 2px 20px rgba(0,0,0,0.3);
  }
  .header-left { display: flex; flex-direction: column; gap: 2px; }
  .header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 26px;
    font-weight: 400;
    color: var(--gold-light);
    letter-spacing: 0.05em;
  }
  .header-subtitle { font-size: 11px; color: rgba(255,255,255,0.4); letter-spacing: 0.15em; text-transform: uppercase; }
  .header-stats { display: flex; gap: 24px; align-items: center; }
  .stat-pill {
    display: flex; flex-direction: column; align-items: center;
    padding: 8px 16px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(201,168,76,0.2);
    border-radius: 8px;
  }
  .stat-pill .num { font-size: 20px; font-weight: 500; color: var(--gold-light); font-family: 'Cormorant Garamond', serif; }
  .stat-pill .lbl { font-size: 10px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.1em; }
  .demo-badge {
    background: rgba(192,57,43,0.2);
    border: 1px solid rgba(192,57,43,0.4);
    color: #f1948a;
    font-size: 11px;
    padding: 4px 10px;
    border-radius: 20px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  /* TOOLBAR */
  .toolbar {
    padding: 20px 32px;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
    background: var(--warm-white);
    border-bottom: 1px solid rgba(201,168,76,0.2);
  }
  .search-wrap {
    flex: 1; min-width: 200px; max-width: 360px;
    position: relative;
  }
  .search-wrap svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; color: var(--brown); opacity: 0.5; }
  .search-input {
    width: 100%; padding: 10px 12px 10px 36px;
    border: 1.5px solid rgba(201,168,76,0.3);
    border-radius: 8px;
    background: white;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    color: var(--charcoal);
    outline: none;
    transition: border-color 0.2s;
  }
  .search-input:focus { border-color: var(--gold); }
  .search-input::placeholder { color: rgba(92,74,42,0.4); }

  .filter-tabs { display: flex; gap: 4px; background: white; border-radius: 8px; padding: 3px; border: 1.5px solid rgba(201,168,76,0.2); }
  .filter-tab {
    padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500;
    background: transparent; color: var(--brown); transition: all 0.15s;
  }
  .filter-tab.active { background: var(--charcoal); color: var(--gold-light); }

  .btn {
    display: flex; align-items: center; gap: 6px;
    padding: 9px 16px; border-radius: 8px; border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    transition: all 0.15s; white-space: nowrap;
  }
  .btn svg { width: 14px; height: 14px; }
  .btn-gold { background: var(--gold); color: white; }
  .btn-gold:hover { background: var(--gold-dark); }
  .btn-outline { background: white; color: var(--brown); border: 1.5px solid rgba(201,168,76,0.3); }
  .btn-outline:hover { border-color: var(--gold); background: rgba(201,168,76,0.05); }
  .btn-dark { background: var(--charcoal); color: var(--gold-light); }
  .btn-sm { padding: 6px 10px; font-size: 12px; }
  .btn-sm svg { width: 12px; height: 12px; }

  /* TABS */
  .view-tabs {
    padding: 0 32px;
    display: flex;
    gap: 0;
    border-bottom: 1px solid rgba(201,168,76,0.2);
    background: var(--warm-white);
  }
  .view-tab {
    padding: 14px 20px; border: none; background: transparent; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    color: var(--brown); opacity: 0.6;
    border-bottom: 2px solid transparent; margin-bottom: -1px;
    transition: all 0.15s; display: flex; align-items: center; gap: 6px;
  }
  .view-tab svg { width: 14px; }
  .view-tab.active { color: var(--charcoal); opacity: 1; border-bottom-color: var(--gold); }

  /* GUEST LIST */
  .content { padding: 24px 32px; }

  .guest-grid { display: flex; flex-direction: column; gap: 8px; }

  .guest-card {
    background: white;
    border-radius: var(--radius);
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: var(--shadow);
    border: 1.5px solid transparent;
    transition: all 0.2s;
    animation: fadeIn 0.3s ease;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  .guest-card:hover { border-color: rgba(201,168,76,0.3); box-shadow: var(--shadow-lg); }
  .guest-card.checked-in { border-left: 3px solid var(--green); }
  .guest-card.not-arrived { border-left: 3px solid rgba(201,168,76,0.3); }

  .checkin-btn {
    width: 48px; height: 48px; border-radius: 50%; border: 2px solid;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: all 0.2s; flex-shrink: 0;
  }
  .checkin-btn svg { width: 16px; }
  .checkin-btn.in { background: var(--green); border-color: var(--green); color: white; }
  .checkin-btn.in:hover { background: #1e4d38; }
  .checkin-btn.out { background: white; border-color: rgba(201,168,76,0.4); color: var(--gold); }
  .checkin-btn.out:hover { border-color: var(--green); background: var(--green-soft); color: var(--green); }

  .guest-info { flex: 1; min-width: 0; }
  .guest-name { font-size: 15px; font-weight: 500; color: var(--charcoal); display: flex; align-items: center; gap: 6px; }
  .vip-star { color: var(--gold); width: 12px; height: 12px; }
  .guest-meta { font-size: 12px; color: var(--brown); opacity: 0.7; margin-top: 2px; display: flex; gap: 12px; }
  .table-badge {
    display: inline-flex; align-items: center; gap: 4px;
    background: var(--warm-white); border: 1px solid rgba(201,168,76,0.2);
    padding: 2px 8px; border-radius: 20px; font-size: 11px; color: var(--brown);
  }
  .time-badge { color: var(--green); font-size: 11px; }

  .angbao-area { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .angbao-toggle {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 12px; border-radius: 20px; border: 1.5px solid;
    cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500;
    transition: all 0.15s;
  }
  .angbao-toggle.given { background: rgba(192,57,43,0.08); border-color: rgba(192,57,43,0.3); color: var(--red); }
  .angbao-toggle.not-given { background: white; border-color: rgba(201,168,76,0.2); color: rgba(92,74,42,0.5); }
  .angbao-toggle:hover { border-color: var(--red); color: var(--red); background: var(--red-soft); }

  .amount-input {
    width: 80px; padding: 5px 8px; border: 1.5px solid rgba(201,168,76,0.3);
    border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 13px;
    color: var(--charcoal); outline: none; background: var(--warm-white);
  }
  .amount-input:focus { border-color: var(--gold); background: white; }

  .guest-actions { display: flex; gap: 4px; flex-shrink: 0; }
  .icon-btn {
    width: 40px; height: 40px; border-radius: 6px; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    background: transparent; color: var(--brown); opacity: 0.7;
    transition: all 0.15s;
  }
  .icon-btn svg { width: 14px; }
  .icon-btn:hover { opacity: 1; background: var(--warm-white); }
  .icon-btn.danger:hover { color: var(--red); background: var(--red-soft); }


  /* PIN SCREEN */
  .pin-screen {
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: var(--charcoal);
    padding: 24px;
  }
  .pin-logo {
    font-family: 'Cormorant Garamond', serif;
    font-size: 36px; color: var(--gold-light);
    margin-bottom: 6px; letter-spacing: 0.05em;
  }
  .pin-sub { font-size: 12px; color: rgba(255,255,255,0.3); letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 48px; }
  .pin-box {
    background: rgba(255,255,255,0.05);
    border: 1.5px solid rgba(201,168,76,0.2);
    border-radius: 20px; padding: 36px 32px;
    width: 100%; max-width: 340px;
    display: flex; flex-direction: column; align-items: center; gap: 24px;
  }
  .pin-label { font-size: 13px; color: rgba(255,255,255,0.4); letter-spacing: 0.1em; text-transform: uppercase; }
  .pin-dots { display: flex; gap: 14px; }
  .pin-dot {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid rgba(201,168,76,0.4);
    transition: all 0.15s;
  }
  .pin-dot.filled { background: var(--gold); border-color: var(--gold); transform: scale(1.1); }
  .pin-dot.error { background: var(--red); border-color: var(--red); animation: shake 0.3s ease; }
  @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
  .pin-keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; width: 100%; }
  .pin-key {
    aspect-ratio: 1; border-radius: 12px; border: 1.5px solid rgba(201,168,76,0.15);
    background: rgba(255,255,255,0.04); color: white;
    font-family: 'Cormorant Garamond', serif; font-size: 24px; font-weight: 400;
    cursor: pointer; transition: all 0.12s; display: flex; align-items: center; justify-content: center;
  }
  .pin-key:hover { background: rgba(201,168,76,0.12); border-color: rgba(201,168,76,0.4); }
  .pin-key:active { transform: scale(0.93); background: rgba(201,168,76,0.2); }
  .pin-key.del { font-size: 18px; color: rgba(255,255,255,0.4); }
  .pin-key.del:hover { color: white; }
  .pin-error { font-size: 13px; color: #f1948a; letter-spacing: 0.05em; min-height: 20px; }
  .pin-input {
    width: 100%; padding: 14px 16px; border-radius: 12px; box-sizing: border-box;
    background: rgba(255,255,255,0.06); border: 1.5px solid rgba(201,168,76,0.25);
    color: white; font-size: 16px; letter-spacing: 0.1em; text-align: center; outline: none;
  }
  .pin-input:focus { border-color: var(--gold); }
  .pin-unlock {
    width: 100%; padding: 14px; border-radius: 12px; border: none; cursor: pointer;
    background: var(--gold); color: #1a1a1a; font-size: 15px; font-weight: 500; letter-spacing: 0.05em;
  }
  .pin-unlock:disabled { opacity: 0.5; cursor: default; }

  /* GUEST QUICK POPUP */
  .table-guest-name-btn {
    background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif;
    font-size: 13px; color: var(--charcoal); text-align: left; flex: 1;
    padding: 3px 6px; border-radius: 6px; transition: all 0.15s;
  }
  .table-guest-name-btn:hover { background: var(--warm-white); color: var(--gold-dark); }
  .guest-quick-popup {
    position: absolute; left: 0; top: calc(100% + 4px);
    background: white; border-radius: 12px; padding: 16px;
    box-shadow: 0 8px 32px rgba(44,36,22,0.18);
    border: 1.5px solid rgba(201,168,76,0.2);
    z-index: 200; min-width: 240px;
    animation: popIn 0.15s ease;
  }
  @keyframes popIn { from { opacity: 0; transform: translateY(-6px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .popup-name { font-weight: 600; font-size: 14px; color: var(--charcoal); margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid rgba(201,168,76,0.15); }
  .popup-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
  .popup-label { font-size: 12px; color: var(--brown); opacity: 0.7; }
  .popup-amount { width: 90px; padding: 6px 8px; border: 1.5px solid rgba(201,168,76,0.3); border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--charcoal); outline: none; }
  .popup-amount:focus { border-color: var(--gold); }

  /* TABLE VIEW */
  .tables-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .table-card {
    background: white; border-radius: var(--radius); padding: 20px;
    box-shadow: var(--shadow); border: 1.5px solid rgba(201,168,76,0.15);
  }
  .table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
  .table-title { font-family: 'Cormorant Garamond', serif; font-size: 18px; font-weight: 500; color: var(--charcoal); }
  .table-count { font-size: 12px; color: var(--brown); opacity: 0.6; }
  .table-progress { height: 4px; background: var(--warm-white); border-radius: 2px; margin-bottom: 14px; overflow: hidden; }
  .table-progress-bar { height: 100%; background: var(--gold); border-radius: 2px; transition: width 0.4s ease; }
  .table-guests { display: flex; flex-direction: column; gap: 8px; }
  .table-guest-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .table-guest-name { font-size: 13px; color: var(--charcoal); }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .status-dot.in { background: var(--green); }
  .status-dot.out { background: rgba(201,168,76,0.4); }

  /* ANGBAO VIEW */
  .angbao-header {
    background: var(--charcoal);
    border-radius: var(--radius);
    padding: 24px 28px;
    margin-bottom: 20px;
    display: flex;
    gap: 32px;
    align-items: center;
  }
  .angbao-stat { display: flex; flex-direction: column; gap: 4px; }
  .angbao-stat .big { font-family: 'Cormorant Garamond', serif; font-size: 32px; color: var(--gold-light); font-weight: 400; }
  .angbao-stat .label { font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.1em; }
  .angbao-divider { width: 1px; height: 48px; background: rgba(255,255,255,0.1); }

  .angbao-list { display: flex; flex-direction: column; gap: 8px; }
  .angbao-row {
    background: white; border-radius: var(--radius); padding: 14px 20px;
    display: flex; align-items: center; gap: 14px;
    box-shadow: var(--shadow); border: 1.5px solid transparent;
  }
  .angbao-row.gave { border-left: 3px solid var(--red); }
  .envelope { font-size: 20px; }
  .angbao-name { flex: 1; font-size: 14px; font-weight: 500; }
  .angbao-amount-display {
    font-family: 'Cormorant Garamond', serif;
    font-size: 18px; font-weight: 500; color: var(--red);
  }
  .pending-tag { font-size: 11px; color: rgba(92,74,42,0.4); font-style: italic; }

  /* MODAL */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(44,36,22,0.6);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; padding: 20px;
    animation: fadeOverlay 0.15s ease;
  }
  @keyframes fadeOverlay { from { opacity: 0; } to { opacity: 1; } }
  .modal {
    background: white; border-radius: 16px; padding: 32px;
    width: 100%; max-width: 480px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    animation: slideUp 0.2s ease;
  }
  @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  .modal-title { font-family: 'Cormorant Garamond', serif; font-size: 22px; margin-bottom: 24px; color: var(--charcoal); }
  .form-grid { display: flex; flex-direction: column; gap: 16px; }
  .form-row { display: flex; gap: 12px; }
  .form-group { display: flex; flex-direction: column; gap: 6px; flex: 1; }
  .form-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--brown); font-weight: 500; }
  .form-input {
    padding: 10px 12px; border: 1.5px solid rgba(201,168,76,0.3);
    border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 14px;
    color: var(--charcoal); outline: none; background: var(--warm-white);
    transition: border-color 0.15s;
  }
  .form-input:focus { border-color: var(--gold); background: white; }
  .checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; }
  .checkbox-label input { width: 16px; height: 16px; accent-color: var(--gold); cursor: pointer; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 24px; }

  /* SETUP PANEL */
  .setup-panel {
    background: linear-gradient(135deg, var(--charcoal) 0%, #3d3020 100%);
    border-radius: var(--radius); padding: 28px; margin-bottom: 24px;
    border: 1px solid rgba(201,168,76,0.2);
  }
  .setup-title { font-family: 'Cormorant Garamond', serif; font-size: 20px; color: var(--gold-light); margin-bottom: 8px; }
  .setup-steps { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
  .setup-step { display: flex; gap: 12px; align-items: flex-start; }
  .step-num { width: 24px; height: 24px; border-radius: 50%; background: var(--gold); color: white; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
  .step-text { font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.6; }
  .step-text code { background: rgba(255,255,255,0.1); padding: 1px 6px; border-radius: 4px; font-size: 12px; color: var(--gold-light); font-family: monospace; }

  /* EMPTY STATE */
  .empty { text-align: center; padding: 60px 20px; color: var(--brown); opacity: 0.5; }
  .empty-icon { font-size: 40px; margin-bottom: 12px; }
  .empty-text { font-family: 'Cormorant Garamond', serif; font-size: 18px; }
  .empty-sub { font-size: 13px; margin-top: 4px; }

  /* TOAST */
  .toast {
    position: fixed; bottom: 24px; right: 24px;
    background: var(--charcoal); color: var(--gold-light);
    padding: 12px 20px; border-radius: 8px;
    font-size: 13px; font-weight: 500;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    z-index: 2000; animation: slideToast 0.2s ease;
    border-left: 3px solid var(--gold);
    display: flex; align-items: center; gap: 16px;
  }
  .toast-undo {
    background: transparent; border: 1px solid var(--gold);
    color: var(--gold-light); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600;
    padding: 4px 12px; border-radius: 6px; letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .toast-undo:hover { background: var(--gold); color: #1a1a1a; }
  @keyframes slideToast { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

  /* RESPONSIVE */
  @media (max-width: 640px) {
    .header { padding: 16px; flex-wrap: wrap; gap: 12px; }
    .header-stats { flex-wrap: wrap; gap: 8px; }
    .stat-pill { padding: 6px 10px; }
    .toolbar { padding: 12px 16px; }
    .content { padding: 16px; }
    .view-tabs { padding: 0 16px; }
    .angbao-header { flex-wrap: wrap; gap: 16px; }
    /* Stack the guest card: check-in + name on top, actions wrap below,
       so controls never overflow a single cramped row on a phone. */
    .guest-card { flex-wrap: wrap; gap: 12px; }
    .guest-info { flex-basis: calc(100% - 64px); }
    .angbao-area { width: 100%; justify-content: space-between; }
    .amount-input { width: 100%; max-width: 120px; }
    .guest-actions { margin-left: auto; }
    .toast { left: 16px; right: 16px; bottom: 16px; justify-content: space-between; }
  }
`;

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function WeddingTracker() {
  const [unlocked, setUnlocked] = useState(isDemoMode);
  const [accessCode, setAccessCode] = useState("");
  const [pinError, setPinError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("guests");
  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'upload' | 'setup'
  const [editGuest, setEditGuest] = useState(null);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ name: "", table_number: "", notes: "", party: "", is_vip: false });
  const [csvText, setCsvText] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [activePopup, setActivePopup] = useState(null); // guest id

  // Guests with an in-flight write (or a focused amount input) must not be
  // overwritten by the 5-second poll, or a helper's keystrokes get clobbered.
  const pendingIds = useRef(new Set());
  const editingId = useRef(null);
  // Debounce timers for angbao-amount persistence, keyed by guest id.
  const amountTimers = useRef({});

  // Restore an existing helper session on load (Supabase persists it).
  useEffect(() => {
    if (isDemoMode) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setUnlocked(true);
    });
  }, []);

  const unlock = async (e) => {
    e?.preventDefault?.();
    if (isDemoMode) { setUnlocked(true); return; }
    if (!accessCode || unlocking) return;
    setUnlocking(true);
    setPinError("");
    // The access code is verified server-side by Supabase Auth — it is never
    // compared in the browser and never shipped in the bundle.
    const { error } = await supabase.auth.signInWithPassword({
      email: HELPER_EMAIL,
      password: accessCode,
    });
    setUnlocking(false);
    if (error) {
      setPinError("Incorrect access code, try again");
      setAccessCode("");
    } else {
      setUnlocked(true);
    }
  };

  const toastTimer = useRef(null);
  // Pass an onUndo callback to render an "Undo" button; undoable toasts linger
  // a little longer so there is time to react.
  const showToast = (message, onUndo = null) => {
    clearTimeout(toastTimer.current);
    setToast({ message, onUndo });
    toastTimer.current = setTimeout(() => setToast(null), onUndo ? 5000 : 2500);
  };

  // Load guests
  // Close popup when clicking outside
  useEffect(() => {
    const handler = (e) => { if (!e.target.closest(".table-guest-row")) setActivePopup(null); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadGuests = useCallback(async () => {
    if (isDemoMode) {
      setGuests(DEMO_GUESTS);
      setLoading(false);
      return;
    }
    try {
      const data = await sb.select("guests");
      if (Array.isArray(data)) {
        // Merge, don't replace: keep the local copy of any row that has a write
        // in flight or whose amount field is focused, so the poll never wipes
        // an in-progress edit. All other rows take the server's value.
        setGuests((prev) =>
          data.map((row) =>
            pendingIds.current.has(row.id) || editingId.current === row.id
              ? prev.find((p) => p.id === row.id) ?? row
              : row
          )
        );
      }
    } catch {
      showToast("Failed to load guests");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Initial fetch on mount, then poll for changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGuests();
    // Real-time polling
    const unsub = sb.subscribeToChanges("guests", loadGuests);
    return unsub;
  }, [loadGuests]);

  // On a failed write, keep the optimistic value (don't yank it back — a wifi
  // blip mid-tap shouldn't undo what the helper just did) and warn them. The
  // next clean poll reconciles against the server.
  const syncFail = (msg) => { showToast(msg || "Not saved — check connection"); };

  // Optimistically apply `updated` to a guest, then persist `patch`. The id is
  // held in pendingIds for the duration of the write so the poll won't clobber
  // it (see loadGuests). Returns true on success.
  const persist = async (id, patch, updated) => {
    setGuests((g) => g.map((x) => (x.id === id ? updated : x)));
    if (isDemoMode) return true;
    pendingIds.current.add(id);
    try {
      await sb.update("guests", id, patch);
      return true;
    } catch {
      syncFail();
      return false;
    } finally {
      pendingIds.current.delete(id);
    }
  };

  // Toggle check-in (undoable)
  const toggleCheckIn = async (guest) => {
    const now = new Date().toISOString();
    const updated = {
      ...guest,
      checked_in: !guest.checked_in,
      checked_in_at: !guest.checked_in ? now : null,
    };
    const ok = await persist(guest.id, { checked_in: updated.checked_in, checked_in_at: updated.checked_in_at }, updated);
    if (ok) {
      showToast(
        updated.checked_in ? `✓ ${guest.name} checked in` : `${guest.name} unchecked`,
        () => { setToast(null); persist(guest.id, { checked_in: guest.checked_in, checked_in_at: guest.checked_in_at }, guest); }
      );
    }
  };

  // Toggle angbao (undoable)
  const toggleAngbao = async (guest) => {
    const updated = { ...guest, angbao_given: !guest.angbao_given };
    if (!updated.angbao_given) updated.angbao_amount = 0;
    const ok = await persist(guest.id, { angbao_given: updated.angbao_given, angbao_amount: updated.angbao_amount }, updated);
    if (ok) {
      showToast(
        updated.angbao_given ? `🧧 ${guest.name} — angbao received` : `${guest.name} — angbao cleared`,
        () => { setToast(null); persist(guest.id, { angbao_given: guest.angbao_given, angbao_amount: guest.angbao_amount }, guest); }
      );
    }
  };

  // Update angbao amount. Optimistic locally + debounced persist (~400ms) so a
  // helper typing "200" fires one write, not three, and the poll can't eat
  // keystrokes mid-type (id stays pending until the debounced write lands).
  const updateAmount = (guest, amount) => {
    const val = cleanAmount(amount);
    setGuests((g) => g.map((x) => (x.id === guest.id ? { ...x, angbao_amount: val } : x)));
    if (isDemoMode) return;
    pendingIds.current.add(guest.id);
    clearTimeout(amountTimers.current[guest.id]);
    amountTimers.current[guest.id] = setTimeout(async () => {
      try {
        await sb.update("guests", guest.id, { angbao_amount: val });
      } catch {
        syncFail();
      } finally {
        pendingIds.current.delete(guest.id);
      }
    }, 400);
  };

  // Save guest (add/edit)
  const saveGuest = async () => {
    if (!cleanName(form.name)) return;
    const data = {
      name: cleanName(form.name),
      table_number: cleanTable(form.table_number),
      notes: cleanNotes(form.notes),
      party: cleanParty(form.party),
      is_vip: form.is_vip,
      checked_in: editGuest?.checked_in || false,
      checked_in_at: editGuest?.checked_in_at || null,
      angbao_given: editGuest?.angbao_given || false,
      angbao_amount: editGuest?.angbao_amount || 0,
    };
    try {
      if (editGuest) {
        const updated = { ...editGuest, ...data };
        setGuests((g) => g.map((x) => (x.id === editGuest.id ? updated : x)));
        if (!isDemoMode) {
          pendingIds.current.add(editGuest.id);
          try { await sb.update("guests", editGuest.id, data); }
          finally { pendingIds.current.delete(editGuest.id); }
        }
        showToast("Guest updated");
      } else {
        const newGuest = { ...data, id: isDemoMode ? Date.now() : undefined };
        if (!isDemoMode) {
          const res = await sb.insert("guests", data);
          if (Array.isArray(res)) setGuests((g) => [...g, res[0]]);
        } else {
          setGuests((g) => [...g, newGuest]);
        }
        showToast("Guest added");
      }
    } catch {
      return syncFail("Could not save guest — check connection");
    }
    setModal(null);
    setEditGuest(null);
    setForm({ name: "", table_number: "", notes: "", party: "", is_vip: false });
  };

  // Delete guest — optimistic removal with an Undo toast (no blocking native
  // confirm(), which is jarring in mobile in-app browsers).
  const deleteGuest = async (guest) => {
    setActivePopup(null);
    setGuests((g) => g.filter((x) => x.id !== guest.id));
    if (!isDemoMode) {
      try {
        await sb.delete("guests", guest.id);
      } catch { return syncFail("Could not remove guest — check connection"); }
    }
    showToast(`${guest.name} removed`, () => undoDelete(guest));
  };

  // Undo a delete by re-inserting the guest (a new id is assigned by the DB).
  const undoDelete = async (guest) => {
    setToast(null);
    const data = {
      name: guest.name,
      table_number: guest.table_number,
      notes: guest.notes || "",
      party: guest.party || "",
      is_vip: guest.is_vip || false,
      checked_in: guest.checked_in || false,
      checked_in_at: guest.checked_in_at || null,
      angbao_given: guest.angbao_given || false,
      angbao_amount: guest.angbao_amount || 0,
    };
    if (isDemoMode) {
      setGuests((g) => [...g, { ...data, id: Date.now() }]);
      return;
    }
    try {
      const res = await sb.insert("guests", data);
      if (Array.isArray(res)) setGuests((g) => [...g, res[0]]);
    } catch { syncFail("Could not restore guest — check connection"); }
  };

  // CSV import
  const importCSV = async () => {
    const parsed = parseCSV(csvText);
    if (!parsed.length) { showToast("No valid guests found in CSV"); return; }
    if (isDemoMode) {
      const newGuests = parsed.map((g, i) => ({ ...g, id: Date.now() + i }));
      setGuests((prev) => [...prev, ...newGuests]);
    } else {
      setSyncing(true);
      try {
        for (const g of parsed) await sb.insert("guests", g);
        await loadGuests();
      } catch {
        setSyncing(false);
        return syncFail("CSV import failed partway — check connection");
      }
      setSyncing(false);
    }
    setModal(null);
    setCsvText("");
    showToast(`${parsed.length} guests imported`);
  };

  // Trigger a browser download of `content` as `filename`.
  const download = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Export CSV (cells are escaped against spreadsheet formula injection in toCSV).
  const exportCSV = () => {
    download(toCSV(guests), "wedding-attendance.csv", "text/csv");
  };

  // Lossless JSON backup of the raw guest rows — the safety net before/during
  // the event (the CSV export drops id/party and reformats times).
  const backupJSON = () => {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    download(JSON.stringify(guests, null, 2), `wedding-backup-${stamp}.json`, "application/json");
    showToast(`Backed up ${guests.length} guests`);
  };

  // Filtered guests
  const filtered = guests.filter((g) => {
    const q = search.toLowerCase();
    const matchSearch = g.name.toLowerCase().includes(q) || String(g.table_number).includes(q);
    const matchFilter =
      filter === "all" ? true :
      filter === "arrived" ? g.checked_in :
      filter === "pending" ? !g.checked_in :
      filter === "angbao" ? g.angbao_given : true;
    return matchSearch && matchFilter;
  });

  // Stats
  const total = guests.length;
  const arrived = guests.filter((g) => g.checked_in).length;
  const angbaoTotal = guests.filter((g) => g.angbao_given).reduce((s, g) => s + (g.angbao_amount || 0), 0);
  const angbaoCount = guests.filter((g) => g.angbao_given).length;

  // Table groups
  const tables = {};
  guests.forEach((g) => {
    if (!tables[g.table_number]) tables[g.table_number] = [];
    tables[g.table_number].push(g);
  });

  // Derive side color per table from first guest with a party value
  const tableSide = {};
  Object.keys(tables).forEach((tNum) => {
    const sideGuest = tables[tNum].find((g) => g.party === "bride" || g.party === "groom");
    tableSide[tNum] = sideGuest ? sideGuest.party : null;
  });

  if (!unlocked) {
    return (
      <>
        <style>{styles}</style>
        <div className="pin-screen">
          <div className="pin-logo">♡ Wedding Day</div>
          <div className="pin-sub">Guest Attendance Tracker</div>
          <form className="pin-box" onSubmit={unlock}>
            <div className="pin-label">Enter access code to continue</div>
            <input
              className="pin-input"
              type="password"
              autoFocus
              value={accessCode}
              onChange={(e) => { setAccessCode(e.target.value); setPinError(""); }}
              placeholder="Access code"
              autoComplete="current-password"
            />
            <button type="submit" className="pin-unlock" disabled={unlocking || !accessCode}>
              {unlocking ? "Checking…" : "Unlock"}
            </button>
            <div className="pin-error">{pinError}</div>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="app">

        {/* HEADER */}
        <header className="header">
          <div className="header-left">
            <div className="header-title">♡ Wedding Day</div>
            <div className="header-subtitle">Guest Attendance Tracker</div>
          </div>
          <div className="header-stats">
            {isDemoMode && <span className="demo-badge">Demo Mode</span>}
            <div className="stat-pill">
              <span className="num">{arrived}/{total}</span>
              <span className="lbl">Arrived</span>
            </div>
            <div className="stat-pill">
              <span className="num">{total > 0 ? Math.round((arrived / total) * 100) : 0}%</span>
              <span className="lbl">Attendance</span>
            </div>
            <div className="stat-pill">
              <span className="num">🧧 {angbaoCount}</span>
              <span className="lbl">Angbaos</span>
            </div>
          </div>
        </header>

        {/* VIEW TABS */}
        <div className="view-tabs">
          <button className={`view-tab ${view === "guests" ? "active" : ""}`} onClick={() => setView("guests")}>
            <Icon.Check /> Guest List
          </button>
          <button className={`view-tab ${view === "tables" ? "active" : ""}`} onClick={() => setView("tables")}>
            <Icon.Table /> Tables
          </button>
          <button className={`view-tab ${view === "angbao" ? "active" : ""}`} onClick={() => setView("angbao")}>
            <Icon.Gift /> Angbao Tracker
          </button>
        </div>

        {/* TOOLBAR */}
        <div className="toolbar">
          <div className="search-wrap">
            <Icon.Search />
            <input className="search-input" placeholder="Search guests or table…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="filter-tabs">
            {[["all","All"],["arrived","Arrived"],["pending","Pending"],["angbao","🧧 Gave"]].map(([k,l]) => (
              <button key={k} className={`filter-tab ${filter === k ? "active" : ""}`} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
          <button className="btn btn-outline" onClick={() => { setModal("upload"); }}>
            <Icon.Upload /> Import CSV
          </button>
          <button className="btn btn-gold" onClick={() => { setEditGuest(null); setForm({ name: "", table_number: "", notes: "", party: "", is_vip: false }); setModal("add"); }}>
            <Icon.Plus /> Add Guest
          </button>
          <button className="btn btn-outline btn-sm" onClick={exportCSV} title="Export CSV"><Icon.Download /></button>
          <button className="btn btn-outline btn-sm" onClick={backupJSON} title="Backup (JSON)">Backup</button>
          <button className="btn btn-outline btn-sm" onClick={loadGuests} title="Refresh"><Icon.Refresh /></button>
        </div>

        {/* CONTENT */}
        <div className="content">
          {isDemoMode && (
            <div className="setup-panel">
              <div className="setup-title">🔧 Connect to Supabase for multi-device sync</div>
              <p style={{color:"rgba(255,255,255,0.5)", fontSize:"13px"}}>Currently in demo mode. Follow these steps to enable real-time multi-device tracking:</p>
              <div className="setup-steps">
                <div className="setup-step"><div className="step-num">1</div><div className="step-text">Go to <strong style={{color:"var(--gold-light)"}}>supabase.com</strong> → create a free project</div></div>
                <div className="setup-step"><div className="step-num">2</div><div className="step-text">In the SQL Editor, run: <code>create table guests (id uuid default gen_random_uuid() primary key, name text, table_number int, checked_in boolean default false, checked_in_at timestamptz, angbao_given boolean default false, angbao_amount numeric default 0, notes text, is_vip boolean default false);</code></div></div>
                <div className="setup-step"><div className="step-num">3</div><div className="step-text">Also run: <code>alter table guests enable row level security; create policy "public" on guests for all using (true) with check (true);</code></div></div>
                <div className="setup-step"><div className="step-num">4</div><div className="step-text">Copy your <strong style={{color:"var(--gold-light)"}}>Project URL</strong> and <strong style={{color:"var(--gold-light)"}}>anon key</strong> from Settings → API, and set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your <code>.env</code> file</div></div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Loading guests…</div></div>
          ) : view === "guests" ? (
            <div className="guest-grid">
              {filtered.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">🌸</div>
                  <div className="empty-text">No guests found</div>
                  <div className="empty-sub">Try a different search or add guests above</div>
                </div>
              ) : filtered.map((g) => (
                <div key={g.id} className={`guest-card ${g.checked_in ? "checked-in" : "not-arrived"}`}>
                  <button className={`checkin-btn ${g.checked_in ? "in" : "out"}`} onClick={() => toggleCheckIn(g)}>
                    {g.checked_in ? <Icon.Check /> : <Icon.Plus />}
                  </button>
                  <div className="guest-info">
                    <div className="guest-name">
                      {g.name}
                      {g.is_vip && <svg className="vip-star" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>}
                    </div>
                    <div className="guest-meta">
                      <span className="table-badge">Table {g.table_number}</span>
                      {g.checked_in && g.checked_in_at && <span className="time-badge">✓ {formatTime(g.checked_in_at)}</span>}
                      {g.notes && <span>{g.notes}</span>}
                    </div>
                  </div>
                  <div className="angbao-area">
                    <button className={`angbao-toggle ${g.angbao_given ? "given" : "not-given"}`} onClick={() => toggleAngbao(g)}>
                      🧧 {g.angbao_given ? "Gave" : "Pending"}
                    </button>
                    {g.angbao_given && (
                      <input
                        className="amount-input"
                        type="number"
                        placeholder="$0"
                        value={g.angbao_amount || ""}
                        onChange={(e) => updateAmount(g, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={() => (editingId.current = g.id)}
                        onBlur={() => { if (editingId.current === g.id) editingId.current = null; }}
                      />
                    )}
                  </div>
                  <div className="guest-actions">
                    <button className="icon-btn" onClick={() => { setEditGuest(g); setForm({ name: g.name, table_number: g.table_number, notes: g.notes || "", party: g.party || "", is_vip: g.is_vip || false }); setModal("edit"); }}>
                      <Icon.Edit />
                    </button>
                    <button className="icon-btn danger" onClick={() => deleteGuest(g)}><Icon.Trash /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : view === "tables" ? (
            <div className="tables-grid">
              {Object.keys(tables).sort((a,b) => Number(a)-Number(b)).map((tNum) => {
                const tGuests = tables[tNum];
                const tArrived = tGuests.filter((g) => g.checked_in).length;
                return (
                  <div key={tNum} className="table-card" style={{
                    background: tableSide[tNum] === "bride" ? "#fff0f5" : tableSide[tNum] === "groom" ? "#f0f5ff" : "white",
                    borderColor: tableSide[tNum] === "bride" ? "rgba(255,182,193,0.6)" : tableSide[tNum] === "groom" ? "rgba(173,198,255,0.6)" : "rgba(201,168,76,0.15)",
                  }}>
                    <div className="table-header">
                      <div style={{display:"flex", alignItems:"center", gap:"8px"}}>
                        <div className="table-title">Table {tNum}</div>
                        {tableSide[tNum] === "bride" && <span style={{fontSize:"10px", background:"rgba(255,182,193,0.4)", color:"#c2185b", padding:"2px 8px", borderRadius:"20px", fontWeight:500, letterSpacing:"0.05em"}}>💐 Bride</span>}
                        {tableSide[tNum] === "groom" && <span style={{fontSize:"10px", background:"rgba(173,198,255,0.4)", color:"#1565c0", padding:"2px 8px", borderRadius:"20px", fontWeight:500, letterSpacing:"0.05em"}}>🤵 Groom</span>}
                      </div>
                      <div className="table-count">{tArrived}/{tGuests.length} arrived</div>
                    </div>
                    <div className="table-progress">
                      <div className="table-progress-bar" style={{width: `${tGuests.length ? (tArrived/tGuests.length)*100 : 0}%`}} />
                    </div>
                    <div className="table-guests">
                      {tGuests.map((g) => (
                        <div key={g.id} className="table-guest-row" style={{position:"relative"}}>
                          <div className="status-dot" style={{background: g.checked_in ? "var(--green)" : "rgba(201,168,76,0.3)"}} />
                          <button
                            className="table-guest-name-btn"
                            onClick={() => setActivePopup(activePopup === g.id ? null : g.id)}
                          >
                            {g.name}
                          </button>
                          {g.angbao_given && <span style={{fontSize:"14px"}}>🧧</span>}
                          {g.is_vip && <span style={{fontSize:"12px", color:"var(--gold)"}}>★</span>}
                          {activePopup === g.id && (
                            <div className="guest-quick-popup">
                              <div className="popup-name">{g.name}</div>
                              <div className="popup-row">
                                <span className="popup-label">Checked in</span>
                                <button
                                  className={`checkin-btn ${g.checked_in ? "in" : "out"}`}
                                  style={{width:"32px", height:"32px"}}
                                  onClick={(e) => { e.stopPropagation(); toggleCheckIn(g); }}
                                >
                                  {g.checked_in ? <Icon.Check /> : <Icon.Plus />}
                                </button>
                              </div>
                              <div className="popup-row">
                                <span className="popup-label">Angbao</span>
                                <button
                                  className={`angbao-toggle ${g.angbao_given ? "given" : "not-given"}`}
                                  onClick={(e) => { e.stopPropagation(); toggleAngbao(g); }}
                                >
                                  🧧 {g.angbao_given ? "Received" : "Pending"}
                                </button>
                              </div>
                              {g.angbao_given && (
                                <div className="popup-row">
                                  <span className="popup-label">Amount ($)</span>
                                  <input
                                    className="popup-amount"
                                    type="number"
                                    placeholder="0"
                                    value={g.angbao_amount || ""}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => updateAmount(g, e.target.value)}
                                    onFocus={() => (editingId.current = g.id)}
                                    onBlur={() => { if (editingId.current === g.id) editingId.current = null; }}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {Object.keys(tables).length === 0 && (
                <div className="empty"><div className="empty-icon">🪑</div><div className="empty-text">No tables yet</div><div className="empty-sub">Add guests with table numbers</div></div>
              )}
            </div>
          ) : (
            /* ANGBAO VIEW */
            <>
              <div className="angbao-header">
                <div className="angbao-stat">
                  <div className="big">🧧 {angbaoCount}</div>
                  <div className="label">Red Packets Received</div>
                </div>
                <div className="angbao-divider" />
                <div className="angbao-stat">
                  <div className="big">${angbaoTotal.toLocaleString()}</div>
                  <div className="label">Total Collected</div>
                </div>
                <div className="angbao-divider" />
                <div className="angbao-stat">
                  <div className="big">{total - angbaoCount}</div>
                  <div className="label">Still Pending</div>
                </div>
                <div className="angbao-divider" />
                <div className="angbao-stat">
                  <div className="big">${angbaoCount ? Math.round(angbaoTotal / angbaoCount).toLocaleString() : 0}</div>
                  <div className="label">Average Amount</div>
                </div>
              </div>
              <div className="angbao-list">
                {[...guests].sort((a,b) => (b.angbao_given ? 1 : 0) - (a.angbao_given ? 1 : 0)).map((g) => (
                  <div key={g.id} className={`angbao-row ${g.angbao_given ? "gave" : ""}`}>
                    <span className="envelope">{g.angbao_given ? "🧧" : "📭"}</span>
                    <div style={{flex:1}}>
                      <div className="angbao-name">{g.name}</div>
                      <div style={{fontSize:"12px", color:"var(--brown)", opacity:0.6}}>Table {g.table_number} {g.checked_in ? "· Arrived" : "· Not arrived"}</div>
                    </div>
                    {g.angbao_given ? (
                      <div className="angbao-amount-display">
                        {g.angbao_amount ? `$${g.angbao_amount}` : "✓ Gave"}
                      </div>
                    ) : (
                      <div className="pending-tag">pending</div>
                    )}
                    <button className={`angbao-toggle ${g.angbao_given ? "given" : "not-given"}`} onClick={() => toggleAngbao(g)} style={{marginLeft:"8px"}}>
                      {g.angbao_given ? "✓ Received" : "Mark Received"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ADD/EDIT MODAL */}
        {(modal === "add" || modal === "edit") && (
          <div className="modal-overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">{modal === "edit" ? "Edit Guest" : "Add Guest"}</div>
              <div className="form-grid">
                <div className="form-row">
                  <div className="form-group" style={{flex:2}}>
                    <label className="form-label">Guest Name *</label>
                    <input className="form-input" placeholder="Full name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} autoFocus />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Table No.</label>
                    <input className="form-input" type="text" placeholder="e.g. 1 or VIP 1" value={form.table_number} onChange={(e) => setForm({...form, table_number: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes (dietary, relationship…)</label>
                  <input className="form-input" placeholder="e.g. Vegetarian, Uncle of bride" value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Side</label>
                  <select className="form-input" value={form.party} onChange={(e) => setForm({...form, party: e.target.value})}>
                    <option value="">— None —</option>
                    <option value="bride">💐 Bride</option>
                    <option value="groom">🤵 Groom</option>
                  </select>
                </div>
                <label className="checkbox-label">
                  <input type="checkbox" checked={form.is_vip} onChange={(e) => setForm({...form, is_vip: e.target.checked})} />
                  Mark as VIP guest ★
                </label>
              </div>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn btn-gold" onClick={saveGuest}>
                  {modal === "edit" ? "Save Changes" : "Add Guest"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CSV UPLOAD MODAL */}
        {modal === "upload" && (
          <div className="modal-overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">Import Guest List</div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Upload CSV File</label>
                  <input
                    type="file" accept=".csv"
                    className="form-input"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) { const r = new FileReader(); r.onload = (ev) => setCsvText(ev.target.result); r.readAsText(file); }
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Or Paste CSV Text</label>
                  <textarea
                    className="form-input" rows={6}
                    placeholder={"name,table,notes,vip\nTan Wei Ming,1,Best man,true\nLim Siew Yong,1,,false"}
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    style={{resize:"vertical"}}
                  />
                </div>
                <div style={{fontSize:"12px", color:"var(--brown)", opacity:0.6, lineHeight:1.5}}>
                  Required column: <strong>name</strong>. Optional: <strong>table</strong> (or table_number), <strong>notes</strong>, <strong>vip</strong> (true/false)
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => { setModal(null); setCsvText(""); }}>Cancel</button>
                <button className="btn btn-gold" onClick={importCSV} disabled={!csvText.trim() || syncing}>
                  {syncing ? "Importing…" : `Import Guests`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TOAST */}
        {toast && (
          <div className="toast">
            <span>{toast.message}</span>
            {toast.onUndo && <button className="toast-undo" onClick={toast.onUndo}>Undo</button>}
          </div>
        )}
      </div>
    </>
  );
}