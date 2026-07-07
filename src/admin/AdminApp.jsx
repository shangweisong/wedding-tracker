import { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { buildPayNowPayload, normalizeMobile } from "../paynow";
import { sb, isDemoMode, supabase, HELPER_EMAIL } from "../lib/supabase.js";
import { cleanName, cleanNotes, cleanTable, cleanParty, cleanAmount, MAX_ANGBAO } from "../lib/validation.js";
import { parseCSV, toCSV, guestImportTemplateCSV } from "../lib/csv.js";
import { formatTime } from "../lib/format.js";
import { guestMatchesSearch } from "../lib/guestSearch.js";
import { diffEvents } from "../lib/eventDiff.js";
import { seedInviteRow } from "../lib/eventTargeting.js";
import { Icon } from "../shared/icons.jsx";
import { theme } from "../shared/theme.js";
import RsvpTab from "./RsvpTab.jsx";
import SeatingTab from "./SeatingTab.jsx";
import WeddingSetupTab from "./WeddingSetupTab.jsx";
import WeddingPageTab from "../wedding/WeddingPageTab.jsx";
import WishesWrappedTab from "./WishesWrappedTab.jsx";

// ─── PAYNOW CONFIG ────────────────────────────────────────────────────────────
// The host's PayNow-linked mobile number and display name. These are NOT secret
// (they ship in the bundle and are visible to anyone who scans the QR) — they are
// simply the public payee details a guest would type to send an ang-bao.
const PAYNOW_MOBILE = import.meta.env.VITE_PAYNOW_MOBILE || "";
const PAYNOW_NAME = import.meta.env.VITE_PAYNOW_NAME || "";

// ─── ANGBAO FEATURE TOGGLE ────────────────────────────────────────────────────
// Set VITE_ENABLE_ANGBAO=false to hide all ang-bao tracking UI (stat pill,
// Angbao Tracker tab, per-guest toggles, Submissions tab, public gift page) for
// events where collecting ang-bao isn't applicable. Existing angbao data in the
// DB is preserved and reappears if the feature is re-enabled. Default = enabled.
const ANGBAO_ENABLED = import.meta.env.VITE_ENABLE_ANGBAO !== "false";

// ─── DEMO MODE (no Supabase) ──────────────────────────────────────────────────
const DEMO_GUESTS = [
  { id: 1, name: "Tan Wei Ming", party: "bride", table_number: "1", table_id: "t1", checked_in: true, checked_in_at: "2024-06-15T18:32:00", angbao_given: true, angbao_amount: 200, draw_number: 1, notes: "Best man", is_vip: true, rsvp_status: "confirmed", rsvp_at: "2024-05-01T10:00:00", meal_choice: "Chicken", plus_one_name: "Emily Tan", dietary_notes: "", rsvp_message: "Can't wait!", rsvp_token: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", email: "wei.ming@example.com" },
  { id: 2, name: "Lim Siew Yong", party: "groom", table_number: "1", table_id: "t1", checked_in: true, checked_in_at: "2024-06-15T18:45:00", angbao_given: true, angbao_amount: 150, draw_number: 2, notes: "", is_vip: false, rsvp_status: "confirmed", rsvp_at: "2024-05-03T14:20:00", meal_choice: "Fish", plus_one_name: "", dietary_notes: "No shellfish", rsvp_message: "Wishing you both a lifetime of joy, laughter, and endless adventures together! 🥂", rsvp_token: "b2c3d4e5-f6a7-8901-bcde-f01234567891", email: "siew.yong@example.com" },
  { id: 3, name: "Ahmad Razif", party: "groom", table_number: "2", table_id: null, checked_in: false, checked_in_at: null, angbao_given: false, angbao_amount: 0, draw_number: null, notes: "Vegetarian", is_vip: false, rsvp_status: "pending", rsvp_at: null, meal_choice: "", plus_one_name: "", dietary_notes: "", rsvp_message: "So happy to celebrate this beautiful day with you. May your love grow stronger each year! ❤️", rsvp_token: "c3d4e5f6-a7b8-9012-cdef-012345678902", email: "" },
  { id: 4, name: "Priya Nair", party: "bride", table_number: "2", table_id: null, checked_in: true, checked_in_at: "2024-06-15T19:01:00", angbao_given: true, angbao_amount: 100, draw_number: 3, notes: "", is_vip: false, rsvp_status: "confirmed", rsvp_at: "2024-04-28T09:15:00", meal_choice: "Vegetarian", plus_one_name: "Raj Nair", dietary_notes: "Vegetarian only", rsvp_message: "Congratulations!", rsvp_token: "d4e5f6a7-b8c9-0123-defa-123456789013", email: "priya.nair@example.com" },
  { id: 5, name: "Chen Jing Wen", party: "bride", table_number: "3", table_id: null, checked_in: false, checked_in_at: null, angbao_given: false, angbao_amount: 0, draw_number: null, notes: "", is_vip: false, rsvp_status: "declined", rsvp_at: "2024-05-10T16:00:00", meal_choice: "", plus_one_name: "", dietary_notes: "", rsvp_message: "Sorry, will be overseas that week!", rsvp_token: "e5f6a7b8-c9d0-1234-efab-234567890124", email: "jing.wen@example.com" },
  { id: 6, name: "Ng Boon Kiat", party: "groom", table_number: "3", table_id: null, checked_in: true, checked_in_at: "2024-06-15T19:15:00", angbao_given: false, angbao_amount: 0, draw_number: null, notes: "Uncle of groom", is_vip: true, rsvp_status: "confirmed", rsvp_at: "2024-04-20T11:30:00", meal_choice: "Chicken", plus_one_name: "", dietary_notes: "", rsvp_message: "Congratulations!! May your marriage be as beautiful and wonderful as this glorious day! 🎉🎊", rsvp_token: "f6a7b8c9-d0e1-2345-fabc-345678901235", email: "boon.kiat@example.com" },
  { id: 7, name: "Siti Rahimah", party: "groom", table_number: "4", table_id: null, checked_in: false, checked_in_at: null, angbao_given: false, angbao_amount: 0, draw_number: null, notes: "", is_vip: false, rsvp_status: "pending", rsvp_at: null, meal_choice: "", plus_one_name: "", dietary_notes: "Halal only", rsvp_message: "The most wonderful couple I know! Wishing you all the happiness, love, and joy forever!! ❤️❤️❤️", rsvp_token: "07a8b9c0-e1f2-3456-abcd-456789012346", email: "" },
  { id: 8, name: "David Koh", party: "groom", table_number: "4", table_id: "t2", checked_in: true, checked_in_at: "2024-06-15T18:50:00", angbao_given: true, angbao_amount: 300, draw_number: 4, notes: "Boss", is_vip: true, rsvp_status: "confirmed", rsvp_at: "2024-04-15T08:00:00", meal_choice: "Fish", plus_one_name: "Karen Koh", dietary_notes: "", rsvp_message: "Looking forward to it!", rsvp_token: "18b9c0d1-f2a3-4567-bcde-567890123457", email: "david.koh@example.com" },
];

const DEMO_WEDDING = {
  bride_name: "Siew Yong",
  groom_name: "Wei Ming",
  wedding_date: "2026-12-12",
  venue_name: "The Grand Ballroom",
  venue_address: "123 Wedding Ave, Singapore",
  ceremony_time: "14:00",
  dinner_time: "18:30",
  tea_ceremony_time: "",
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = theme + `
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
  .mode-toggle {
    display: flex;
    border: 1.5px solid rgba(201,168,76,0.35);
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .mode-btn {
    padding: 6px 14px;
    border: none;
    background: rgba(255,255,255,0.08);
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,0.55);
    letter-spacing: 0.02em;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .mode-btn + .mode-btn { border-left: 1.5px solid rgba(201,168,76,0.35); }
  .mode-btn.active { background: var(--gold); color: var(--charcoal); }
  .mode-btn:not(.active):hover { background: rgba(255,255,255,0.14); color: rgba(255,255,255,0.85); }

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

  /* PIN SCREEN → PAYNOW LINK */
  .pin-paylink {
    margin-top: 28px; background: none; border: none; cursor: pointer;
    color: var(--gold-light); font-family: 'DM Sans', sans-serif; font-size: 14px;
    letter-spacing: 0.04em; text-decoration: underline; text-underline-offset: 4px;
    opacity: 0.85; transition: opacity 0.15s;
  }
  .pin-paylink:hover { opacity: 1; }

  /* PAYNOW SEND PAGE */
  .pay-amount-input {
    width: 100%; padding: 16px 16px 16px 38px; border-radius: 12px; box-sizing: border-box;
    background: rgba(255,255,255,0.06); border: 1.5px solid rgba(201,168,76,0.25);
    color: white; font-size: 22px; letter-spacing: 0.02em; text-align: center; outline: none;
    font-family: 'Cormorant Garamond', serif;
  }
  .pay-amount-input:focus { border-color: var(--gold); }
  .pay-amount-wrap { position: relative; width: 100%; }
  .pay-amount-wrap .pay-currency {
    position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
    color: rgba(255,255,255,0.45); font-size: 15px; font-family: 'DM Sans', sans-serif;
  }
  .pay-quick { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .pay-quick button {
    background: rgba(255,255,255,0.05); border: 1.5px solid rgba(201,168,76,0.25);
    color: var(--gold-light); border-radius: 20px; padding: 7px 14px; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; transition: all 0.12s;
  }
  .pay-quick button:hover { background: rgba(201,168,76,0.15); border-color: rgba(201,168,76,0.5); }
  .pay-qr {
    background: white; padding: 18px; border-radius: 16px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 8px 30px rgba(0,0,0,0.25);
  }
  .pay-qr-meta { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .pay-qr-amount {
    font-family: 'Cormorant Garamond', serif; font-size: 32px; color: var(--gold-light);
  }
  .pay-qr-to { font-size: 12px; color: rgba(255,255,255,0.5); letter-spacing: 0.05em; }
  .pay-hint { font-size: 13px; color: rgba(255,255,255,0.55); text-align: center; line-height: 1.6; max-width: 280px; }
  .pay-lock {
    font-size: 11px; color: var(--gold); letter-spacing: 0.08em; text-transform: uppercase;
    border: 1px solid rgba(201,168,76,0.3); border-radius: 20px; padding: 4px 12px;
  }
  .pay-error { font-size: 13px; color: #f1948a; text-align: center; min-height: 18px; }
  .pay-back {
    background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.45);
    font-family: 'DM Sans', sans-serif; font-size: 14px; letter-spacing: 0.04em;
    margin-top: 24px; transition: color 0.15s;
  }
  .pay-back:hover { color: var(--gold-light); }
  .pay-upload {
    width: 100%; margin-top: 8px; padding-top: 22px;
    border-top: 1px solid rgba(201,168,76,0.18);
    display: flex; flex-direction: column; align-items: center; gap: 14px;
  }
  .pay-upload-title {
    font-family: 'Cormorant Garamond', serif; font-size: 20px; color: var(--gold-light);
  }
  .pay-file {
    width: 100%; box-sizing: border-box; color: rgba(255,255,255,0.6); font-size: 13px;
    font-family: 'DM Sans', sans-serif;
  }
  .pay-file::file-selector-button {
    margin-right: 10px; padding: 8px 12px; border-radius: 10px; cursor: pointer;
    background: rgba(255,255,255,0.06); border: 1.5px solid rgba(201,168,76,0.25);
    color: var(--gold-light); font-family: 'DM Sans', sans-serif; font-size: 13px;
  }
  .pay-upload-done {
    font-size: 14px; color: #82d9a0; text-align: center; line-height: 1.6; max-width: 270px;
  }

  /* DRAW NUMBER BADGE */
  .draw-badge {
    display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;
    background: rgba(201,168,76,0.14); border: 1px solid rgba(201,168,76,0.4);
    color: var(--gold-dark); border-radius: 20px; padding: 2px 9px;
    font-size: 12px; font-weight: 600; letter-spacing: 0.03em;
  }

  /* SUBMISSIONS (guest-uploaded receipts) */
  .subs-list { display: flex; flex-direction: column; gap: 12px; max-width: 760px; margin: 0 auto; }
  .sub-row {
    display: flex; align-items: center; gap: 14px; background: white;
    border-radius: var(--radius); padding: 16px 18px; box-shadow: var(--shadow);
    border: 1.5px solid rgba(201,168,76,0.15);
  }
  .sub-row.is-approved { opacity: 0.6; }
  .sub-row.is-rejected { opacity: 0.5; }
  .sub-name { font-weight: 600; font-size: 15px; color: var(--charcoal); }
  .sub-meta { font-size: 12px; color: var(--brown); opacity: 0.65; margin-top: 2px; }
  .sub-claim { font-family: 'Cormorant Garamond', serif; font-size: 22px; color: var(--gold-dark); }
  .sub-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .sub-status {
    font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 4px 10px; border-radius: 20px;
  }
  .sub-status.approved { background: rgba(130,217,160,0.18); color: #2e7d4f; }
  .sub-status.rejected { background: rgba(241,148,138,0.18); color: #b53f30; }
  .sub-pill {
    font-size: 11px; background: var(--red); color: white; border-radius: 20px;
    padding: 1px 7px; margin-left: 6px; font-weight: 600;
  }

  /* APPROVE MODAL guest picker */
  .approve-claim { background: var(--warm-white); border-radius: 10px; padding: 12px 14px; margin-bottom: 6px; }
  .guest-pick-list { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
  .guest-pick {
    text-align: left; background: var(--warm-white); border: 1.5px solid transparent;
    border-radius: 10px; padding: 10px 12px; cursor: pointer; font-family: 'DM Sans', sans-serif;
    color: var(--charcoal); font-size: 14px; transition: all 0.12s;
  }
  .guest-pick:hover { border-color: var(--gold); background: white; }

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

  /* GEAR BUTTON (header settings) */
  .gear-btn {
    width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
    border: 1.5px solid rgba(201,168,76,0.3); background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.55); cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: all 0.15s;
  }
  .gear-btn svg { width: 16px; height: 16px; }
  .gear-btn:hover { background: rgba(201,168,76,0.15); border-color: rgba(201,168,76,0.5); color: var(--gold-light); }

  /* WEDDING SETUP MODAL */
  .setup-modal-overlay {
    position: fixed; inset: 0; background: rgba(44,36,22,0.75);
    display: flex; align-items: flex-start; justify-content: center;
    z-index: 1000; padding: 40px 20px 20px;
    overflow-y: auto; animation: fadeOverlay 0.15s ease;
  }
  .setup-modal { width: 100%; max-width: 680px; animation: slideUp 0.2s ease; }
  .setup-modal-hd {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 14px;
  }
  .setup-modal-hd-title {
    font-family: 'Cormorant Garamond', serif; font-size: 22px; color: white; font-weight: 400;
  }
  .setup-modal-close {
    width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18);
    color: rgba(255,255,255,0.75); cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: all 0.15s;
  }
  .setup-modal-close svg { width: 14px; height: 14px; }
  .setup-modal-close:hover { background: rgba(255,255,255,0.2); color: white; }

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

// ─── PAYNOW ANG-BAO PAGE (public) ─────────────────────────────────────────────
// A login-free page where a guest types an amount and gets a PayNow QR, pre-filled
// with that amount and locked, pointing to the host's PayNow mobile. The guest
// scans it with their banking app to send the ang-bao. Everything is generated in
// the browser — no backend, no payment provider, no fees.
const QUICK_AMOUNTS = [20, 50, 88, 168, 288];

// Optional guest receipt upload limits (mirrored by the bucket's own caps).
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const RECEIPT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif", "application/pdf"];

function PayNowPage({ onBack, wedding }) {
  const [amountText, setAmountText] = useState("");
  const configured = !!normalizeMobile(PAYNOW_MOBILE);
  const rawAmount = parseFloat(amountText);
  const tooLarge = Number.isFinite(rawAmount) && rawAmount > MAX_ANGBAO;
  const amount = cleanAmount(amountText); // 0 when invalid / empty
  const payload = configured && !tooLarge && amount > 0
    ? buildPayNowPayload({ mobile: PAYNOW_MOBILE, amount, merchantName: PAYNOW_NAME, editable: false })
    : "";

  // ── Optional: let the guest upload their transfer receipt for faster
  // confirmation. Purely opt-in — they can ignore this and just show reception
  // the receipt in person. Only available when the database is configured.
  const dbEnabled = !!supabase;
  const [guestName, setGuestName] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploadState, setUploadState] = useState("idle"); // idle | sending | done | error
  const [uploadError, setUploadError] = useState("");

  const submitReceipt = async () => {
    const nm = cleanName(guestName);
    if (!nm) { setUploadError("Please enter your name."); return; }
    if (!receiptFile) { setUploadError("Please choose your receipt file."); return; }
    if (receiptFile.size > MAX_RECEIPT_BYTES) { setUploadError("That file is too large (max 5 MB)."); return; }
    if (!RECEIPT_TYPES.includes(receiptFile.type)) { setUploadError("Please upload an image or PDF."); return; }
    setUploadState("sending");
    setUploadError("");
    try {
      const ext = (receiptFile.name.split(".").pop() || "dat").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
      const path = `${crypto.randomUUID()}.${ext || "dat"}`;
      const up = await supabase.storage.from("receipts").upload(path, receiptFile, {
        contentType: receiptFile.type, upsert: false,
      });
      if (up.error) throw up.error;
      const ins = await supabase.from("submissions").insert({
        guest_name: nm, claimed_amount: amount, receipt_path: path,
      });
      if (ins.error) throw ins.error;
      setUploadState("done");
    } catch {
      setUploadState("error");
      setUploadError("Upload failed — please just show your receipt to reception instead.");
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="pin-screen">
        <div className="pin-logo">
          {wedding?.bride_name && wedding?.groom_name
            ? `♡ ${wedding.bride_name} & ${wedding.groom_name}`
            : "♡ Send a Gift"}
        </div>
        <div className="pin-sub">PayNow · No app sign-in needed</div>

        <div className="pin-box">
          {!configured ? (
            <div className="pay-hint">
              PayNow isn’t set up yet. The couple needs to add their PayNow mobile
              number before gifts can be sent here.
            </div>
          ) : (
            <>
              <div className="pin-label">Enter your gift amount</div>

              <div className="pay-amount-wrap">
                <span className="pay-currency">S$</span>
                <input
                  className="pay-amount-input"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  autoFocus
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  placeholder="88"
                />
              </div>

              <div className="pay-quick">
                {QUICK_AMOUNTS.map((a) => (
                  <button key={a} type="button" onClick={() => setAmountText(String(a))}>
                    ${a}
                  </button>
                ))}
              </div>

              <div className="pay-error">{tooLarge ? "That amount is too large." : ""}</div>

              {payload ? (
                <>
                  <div className="pay-qr">
                    <QRCodeSVG value={payload} size={224} level="M" marginSize={0} />
                  </div>
                  <div className="pay-qr-meta">
                    <div className="pay-qr-amount">S${amount.toFixed(2)}</div>
                    {PAYNOW_NAME && <div className="pay-qr-to">to {PAYNOW_NAME}</div>}
                    <div className="pay-lock">🔒 Amount locked</div>
                  </div>
                  <div className="pay-hint">
                    Open your banking app, scan this PayNow QR, and confirm — the
                    amount is already filled in for you. 💝
                  </div>
                </>
              ) : (
                <div className="pay-hint">
                  Type an amount above to generate your PayNow QR code.
                </div>
              )}

              {dbEnabled && (
                <div className="pay-upload">
                  <div className="pay-upload-title">Already paid?</div>
                  <div className="pay-hint" style={{ maxWidth: "260px" }}>
                    Optional — upload your transfer receipt so reception can confirm
                    your lucky-draw number faster. You can skip this and simply show
                    your receipt in person.
                  </div>

                  {uploadState === "done" ? (
                    <div className="pay-upload-done">
                      ✓ Thanks, {cleanName(guestName)}! Reception will confirm your
                      lucky-draw number shortly.
                    </div>
                  ) : (
                    <>
                      <input
                        className="pin-input"
                        type="text"
                        placeholder="Your name (as on the guest list)"
                        value={guestName}
                        onChange={(e) => { setGuestName(e.target.value); setUploadError(""); }}
                      />
                      <input
                        className="pay-file"
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => { setReceiptFile(e.target.files?.[0] || null); setUploadError(""); }}
                      />
                      <div className="pay-error">{uploadError}</div>
                      <button
                        type="button"
                        className="pin-unlock"
                        onClick={submitReceipt}
                        disabled={uploadState === "sending"}
                      >
                        {uploadState === "sending" ? "Uploading…" : "Upload receipt"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <button className="pay-back" onClick={onBack}>← Back</button>
      </div>
    </>
  );
}

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
  const [mode, setMode] = useState("planning"); // "planning" | "dday"
  const [view, setView] = useState("rsvp");
  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'upload' | 'setup'
  const [editGuest, setEditGuest] = useState(null);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ name: "", table_number: "", notes: "", party: "", is_vip: false });
  const [csvText, setCsvText] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [activePopup, setActivePopup] = useState(null); // guest id
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#\/?/, ""));
  const [submissions, setSubmissions] = useState([]);
  const [approveSub, setApproveSub] = useState(null); // submission being reviewed
  const [approveSearch, setApproveSearch] = useState("");
  const [approveAmount, setApproveAmount] = useState("");
  const [wedding, setWedding] = useState(undefined); // undefined = not fetched, null = no row yet, object = configured
  const [weddingEvents, setWeddingEvents] = useState([]); // smart-RSVP event list (#78)
  const [eventRsvps, setEventRsvps] = useState([]); // guest_event_rsvps rows for the targeting grid (#78)
  const [setupOpen, setSetupOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [safeDeleteEnabled, setSafeDeleteEnabled] = useState(
    () => localStorage.getItem("safeDelete") !== "false"
  );

  // Hash-based routing: "#pay" opens the public ang-bao QR page (no login needed).
  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash.replace(/^#\/?/, ""));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Guests with an in-flight write (or a focused amount input) must not be
  // overwritten by the 5-second poll, or a helper's keystrokes get clobbered.
  const pendingIds = useRef(new Set());
  const editingId = useRef(null);
  // Debounce timers for angbao-amount persistence, keyed by guest id.
  const amountTimers = useRef({});

  // Restore an existing helper session on load (Supabase persists it in localStorage).
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

  const loadWedding = useCallback(async () => {
    if (isDemoMode) {
      setWedding(DEMO_WEDDING);
      return;
    }
    try {
      const rows = await sb.rpc("get_wedding_config", {});
      setWedding(Array.isArray(rows) && rows.length ? rows[0] : null);
    } catch {
      showToast("Failed to load wedding details");
    }
  }, []);

  const loadEvents = useCallback(async () => {
    if (isDemoMode) return; // demo events are edited locally, not persisted
    try {
      const rows = await sb.select("wedding_events");
      const sorted = [...rows].sort(
        (a, b) => (a.sort_order - b.sort_order) || String(a.start_time || "").localeCompare(String(b.start_time || ""))
      );
      setWeddingEvents(sorted);
    } catch {
      /* table may not exist yet on un-migrated DBs — leave events empty */
    }
  }, []);

  const loadEventRsvps = useCallback(async () => {
    if (isDemoMode) return;
    try {
      const { data, error } = await supabase
        .from("guest_event_rsvps")
        .select("guest_id, event_id, invited, status, meal_choice");
      if (error) throw error;
      setEventRsvps(Array.isArray(data) ? data : []);
    } catch {
      /* table may not exist yet on un-migrated DBs — leave empty */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWedding();
    loadEvents();
    loadEventRsvps();
  }, [loadWedding, loadEvents, loadEventRsvps]);

  const saveWedding = async (form) => {
    if (isDemoMode) {
      setWedding((w) => ({ ...(w || {}), ...form }));
      showToast("Wedding details saved");
      return true;
    }
    try {
      await sb.rpc("upsert_wedding_config", {
        p_bride_name: form.bride_name,
        p_groom_name: form.groom_name,
        p_wedding_date: form.wedding_date,
        p_venue_name: form.venue_name,
        p_venue_address: form.venue_address,
        p_ceremony_time: form.ceremony_time,
        p_dinner_time: form.dinner_time,
        p_tea_ceremony_time: form.tea_ceremony_time || null,
        p_enable_smart_rsvp: !!form.enable_smart_rsvp,
        p_primary_meal_event_id: form.primary_meal_event_id || null,
      });
      await loadWedding();
      showToast("Wedding details saved");
      return true;
    } catch {
      showToast("Could not save wedding details — check connection");
      return false;
    }
  };

  // Batch-persist the smart-RSVP event list edited in Wedding Setup (#78).
  const saveEvents = async (draft) => {
    const { toCreate, toUpdate, toDelete } = diffEvents(weddingEvents, draft);
    if (isDemoMode) {
      // Demo mode has no backend — reflect the edited list locally with stable ids.
      setWeddingEvents(draft.filter((e) => String(e.name || "").trim())
        .map((e, i) => ({ ...e, id: e.id || `demo_${i}`, sort_order: i })));
      showToast("Events saved");
      return true;
    }
    if (!wedding?.id) {
      showToast("Save your wedding details first, then add events");
      return false;
    }
    try {
      for (const id of toDelete) await sb.delete("wedding_events", id);
      for (const { id, patch } of toUpdate) await sb.update("wedding_events", id, patch);
      for (const row of toCreate) await sb.insert("wedding_events", { ...row, wedding_id: wedding.id });
      await loadEvents();
      showToast("Events saved");
      return true;
    } catch {
      showToast("Could not save events — check connection");
      return false;
    }
  };

  // Per-guest event targeting (#78, Phase 4) — writes guest_event_rsvps.invited.
  // guest_event_rsvps has a composite PK, so the generic sb.update/delete (which
  // key on `id`) don't apply; go through supabase directly.
  const applyInvite = async (guest, eventId, invited) => {
    const existing = eventRsvps.find((r) => r.guest_id === guest.id && r.event_id === eventId);
    if (!invited) {
      // Un-invite keeps the row (reversible) and just clears eligibility.
      const { error } = await supabase.from("guest_event_rsvps")
        .update({ invited: false }).eq("guest_id", guest.id).eq("event_id", eventId);
      if (error) throw error;
    } else if (existing) {
      const { error } = await supabase.from("guest_event_rsvps")
        .update({ invited: true }).eq("guest_id", guest.id).eq("event_id", eventId);
      if (error) throw error;
    } else {
      // First enrollment: seed status/meal from the guest's legacy RSVP so the
      // mirror trigger doesn't regress an already-answered guest to pending.
      const { error } = await supabase.from("guest_event_rsvps").insert({
        guest_id: guest.id,
        event_id: eventId,
        ...seedInviteRow(guest, eventId, wedding?.primary_meal_event_id || null),
      });
      if (error) throw error;
    }
  };

  const setGuestInvited = async (guest, eventId, invited) => {
    if (isDemoMode) {
      setEventRsvps((prev) => [
        ...prev.filter((r) => !(r.guest_id === guest.id && r.event_id === eventId)),
        { guest_id: guest.id, event_id: eventId, invited, status: "pending" },
      ]);
      return;
    }
    try {
      await applyInvite(guest, eventId, invited);
      await loadEventRsvps();
    } catch {
      showToast("Could not update invitation — check connection");
    }
  };

  const bulkInvite = async (guestList, eventId, invited) => {
    if (isDemoMode) {
      const ids = new Set(guestList.map((g) => g.id));
      setEventRsvps((prev) => [
        ...prev.filter((r) => !(r.event_id === eventId && ids.has(r.guest_id))),
        ...guestList.map((g) => ({ guest_id: g.id, event_id: eventId, invited, status: "pending" })),
      ]);
      showToast(`${invited ? "Invited" : "Removed"} ${guestList.length}`);
      return;
    }
    try {
      for (const g of guestList) await applyInvite(g, eventId, invited);
      await loadEventRsvps();
      showToast(`${invited ? "Invited" : "Removed"} ${guestList.length} guest${guestList.length !== 1 ? "s" : ""}`);
    } catch {
      showToast("Could not update invitations — check connection");
    }
  };

  const saveWeddingPage = async (form) => {
    if (isDemoMode) {
      setWedding((w) => ({ ...(w || {}), ...form }));
      showToast("Wedding page saved");
      return true;
    }
    try {
      await sb.rpc("upsert_wedding_page", {
        p_slug:           form.slug,
        p_love_story:     form.love_story,
        p_dress_code:     form.dress_code,
        p_hero_image_url: form.hero_image_url,
        p_hero_focal_point: form.hero_focal_point,
        p_fun_qa:         form.fun_qa,
        p_rsvp_deadline:  form.rsvp_deadline,
        p_is_published:   form.is_published,
        p_meal_options:   form.meal_options,
        p_getting_there:  form.getting_there,
        p_theme:          form.theme,
        p_enable_fun_rsvp_options: form.enable_fun_rsvp_options,
        p_smoking_notice: form.smoking_notice,
        p_parking_notice: form.parking_notice,
        p_content_translations: form.content_translations,
        p_theme_tokens:   form.theme_tokens,
        p_section_photos: form.section_photos,
      });
      await loadWedding();
      showToast("Wedding page saved");
      return true;
    } catch {
      showToast("Could not save wedding page — check connection");
      return false;
    }
  };

  // Auto-open setup modal on first launch (no wedding row yet).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wedding === null) setSetupOpen(true);
  }, [wedding]);

  // Personalise the browser tab title once we know the couple's names.
  useEffect(() => {
    if (wedding?.bride_name && wedding?.groom_name) {
      document.title = `${wedding.bride_name} & ${wedding.groom_name} · Wedding Planner`;
    }
  }, [wedding]);

  // Guest-uploaded receipts (only when signed in + a real database is present).
  const loadSubmissions = useCallback(async () => {
    if (isDemoMode) return;
    try {
      const data = await sb.listSubmissions();
      if (Array.isArray(data)) setSubmissions(data);
    } catch { /* a transient poll failure is fine; the next tick retries */ }
  }, []);

  useEffect(() => {
    if (!unlocked || isDemoMode) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSubmissions();
    const unsub = sb.subscribeToChanges("submissions", loadSubmissions);
    return unsub;
  }, [unlocked, loadSubmissions]);

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

  // Mint (or re-read) a guest's lucky-draw number once their angbao is
  // confirmed. Assign-once: a guest who already has a number keeps it. Returns
  // the number, or null if it could not be assigned.
  const mintDraw = async (guest) => {
    if (guest.draw_number) return guest.draw_number;
    let n;
    if (isDemoMode) {
      n = guests.reduce((m, g) => Math.max(m, g.draw_number || 0), 0) + 1;
    } else {
      try { n = await sb.assignDraw(guest.id); }
      catch { syncFail("Lucky-draw number not assigned — check connection"); return null; }
    }
    setGuests((g) => g.map((x) => (x.id === guest.id ? { ...x, draw_number: n } : x)));
    return n;
  };

  // Toggle angbao (undoable). Confirming an angbao also mints the guest's stable
  // lucky-draw number; clearing it keeps the number (assign-once).
  const toggleAngbao = async (guest) => {
    const becomingGiven = !guest.angbao_given;
    const updated = { ...guest, angbao_given: becomingGiven };
    if (!becomingGiven) updated.angbao_amount = 0;
    const ok = await persist(guest.id, { angbao_given: updated.angbao_given, angbao_amount: updated.angbao_amount }, updated);
    if (!ok) return;
    const undo = () => { setToast(null); persist(guest.id, { angbao_given: guest.angbao_given, angbao_amount: guest.angbao_amount }, guest); };
    if (becomingGiven) {
      const n = await mintDraw(updated);
      showToast(n ? `🧧 ${guest.name} — angbao received · Draw #${n}` : `🧧 ${guest.name} — angbao received`, undo);
    } else {
      showToast(`${guest.name} — angbao cleared`, undo);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    // Reset to a valid view for the chosen mode
    setView(newMode === "planning" ? "rsvp" : "guests");
  };

  // Generic optimistic update used by RsvpTab and SeatingTab for RSVP/seating edits.
  const updateGuest = async (id, patch) => {
    setGuests((g) => g.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (!isDemoMode) {
      try { await sb.update("guests", id, patch); }
      catch { showToast("Not saved — check connection"); }
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

  // ── Guest-upload review (Submissions tab) ───────────────────────────────────
  const openApprove = (sub) => {
    setApproveSub(sub);
    setApproveSearch("");
    setApproveAmount(sub.claimed_amount ? String(sub.claimed_amount) : "");
    setModal("approve");
  };

  // Confirm a submission against a guest: mark them given + amount, mint their
  // lucky-draw number, and close out the submission.
  const finalizeApproval = async (sub, guest, amount) => {
    const val = cleanAmount(amount);
    const updated = { ...guest, angbao_given: true, angbao_amount: val };
    const ok = await persist(guest.id, { angbao_given: true, angbao_amount: val }, updated);
    if (!ok) return;
    const n = await mintDraw(updated);
    try { await sb.update("submissions", sub.id, { status: "approved", matched_guest_id: guest.id }); }
    catch { syncFail("Submission status not saved — check connection"); }
    setSubmissions((s) => s.map((x) => (x.id === sub.id ? { ...x, status: "approved", matched_guest_id: guest.id } : x)));
    setModal(null); setApproveSub(null);
    showToast(n ? `🧧 ${guest.name} approved · Draw #${n}` : `🧧 ${guest.name} approved`);
  };

  // The uploader isn't on the guest list yet — create the guest, then approve.
  // Submissions only exist with a real database, so this never runs in demo mode.
  const approveAsNewGuest = async () => {
    if (isDemoMode) return;
    const sub = approveSub;
    const data = {
      name: cleanName(sub.guest_name), table_number: "1", notes: "", party: "",
      is_vip: false, checked_in: false, checked_in_at: null, angbao_given: false, angbao_amount: 0,
    };
    let guest;
    try {
      const res = await sb.insert("guests", data);
      guest = Array.isArray(res) ? res[0] : null;
      if (guest) setGuests((g) => [...g, guest]);
    } catch { return syncFail("Could not add guest — check connection"); }
    if (guest) finalizeApproval(sub, guest, approveAmount);
  };

  const rejectSubmission = async (sub) => {
    if (!isDemoMode) {
      try { await sb.update("submissions", sub.id, { status: "rejected" }); }
      catch { return syncFail("Submission status not saved — check connection"); }
    }
    setSubmissions((s) => s.map((x) => (x.id === sub.id ? { ...x, status: "rejected" } : x)));
    showToast("Submission rejected");
  };

  const viewReceipt = async (sub) => {
    try { window.open(await sb.receiptUrl(sub.receipt_path), "_blank", "noopener"); }
    catch { showToast("Could not open receipt"); }
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
      draw_number: editGuest?.draw_number ?? null,
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
    } catch (err) {
      console.error("[saveGuest] failed:", err);
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
      draw_number: guest.draw_number ?? null,
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

  const resetSeating = async () => {
    setGuests((g) => g.map((x) => ({ ...x, table_id: null, table_number: "" })));
    if (!isDemoMode) {
      try {
        const { error } = await supabase.from("guests").update({ table_id: null, table_number: "" }).not("id", "is", null);
        if (error) throw error;
      } catch { syncFail("Could not reset seating — check connection"); }
    }
    showToast("All seat assignments cleared");
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
    const prefix = wedding?.bride_name && wedding?.groom_name
      ? `${wedding.bride_name}-${wedding.groom_name}`.toLowerCase().replace(/\s+/g, "-")
      : "wedding";
    download(toCSV(guests), `${prefix}-attendance.csv`, "text/csv");
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
    if (mode === "dday" && g.rsvp_status !== "confirmed") return false;
    const matchSearch = guestMatchesSearch(g, search);
    const matchFilter =
      filter === "all" ? true :
      filter === "arrived" ? g.checked_in :
      filter === "pending" ? !g.checked_in :
      filter === "angbao" ? g.angbao_given : true;
    return matchSearch && matchFilter;
  });

  // Stats
  // Plus-ones (#38) are child guest rows; "invitation" stats count primaries,
  // headcount counts every confirmed body.
  const primaryGuests = guests.filter((g) => !g.primary_guest_id);
  const total = primaryGuests.length;
  const arrived = guests.filter((g) => g.checked_in).length;
  // Ang-bao is given per invitation, so scope to primaries (keeps "Still Pending"
  // = total - angbaoCount non-negative and consistent with `total`).
  const angbaoTotal = primaryGuests.filter((g) => g.angbao_given).reduce((s, g) => s + (g.angbao_amount || 0), 0);
  const angbaoCount = primaryGuests.filter((g) => g.angbao_given).length;
  const pendingSubs = submissions.filter((s) => s.status === "pending").length;
  const rsvpConfirmed = primaryGuests.filter((g) => g.rsvp_status === "confirmed").length;
  const rsvpPending = primaryGuests.filter((g) => g.rsvp_status === "pending").length;
  const rsvpHeadcount = guests.filter((g) => g.rsvp_status === "confirmed").length;

  // Table groups — only guests with an assignment; in d-day mode filtered already excludes non-confirmed
  const tables = {};
  filtered.forEach((g) => {
    if (!g.table_number) return;
    if (!tables[g.table_number]) tables[g.table_number] = [];
    tables[g.table_number].push(g);
  });

  // Derive side color per table from first guest with a party value
  const tableSide = {};
  Object.keys(tables).forEach((tNum) => {
    const sideGuest = tables[tNum].find((g) => g.party === "bride" || g.party === "groom");
    tableSide[tNum] = sideGuest ? sideGuest.party : null;
  });

  // Days until (or since) the wedding, derived from the DB date string to avoid
  // timezone shifts that Date() would introduce on a bare "YYYY-MM-DD".
  const daysUntilWedding = (() => {
    if (!wedding?.wedding_date) return null;
    const [wy, wm, wd] = wedding.wedding_date.split("-").map(Number);
    const today = new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const weddingUtc = Date.UTC(wy, wm - 1, wd);
    return Math.round((weddingUtc - todayUtc) / 86_400_000);
  })();

  // Public ang-bao page — intentionally no auth check. Guests need to reach
  // this page to send an ang-bao without a helper account. When the angbao
  // feature is disabled it is never rendered; the route falls through to the
  // normal helper app instead.
  if (route === "pay" && ANGBAO_ENABLED) {
    return <PayNowPage onBack={() => { window.location.hash = ""; }} wedding={wedding} />;
  }

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
          {ANGBAO_ENABLED && (
            <button className="pin-paylink" onClick={() => { window.location.hash = "pay"; }}>
              Send a gift · Ang-Bao →
            </button>
          )}
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
            <div className="header-title">
              {wedding?.bride_name && wedding?.groom_name
                ? `♡ ${wedding.bride_name} & ${wedding.groom_name}`
                : mode === "planning" ? "♡ Wedding Planner" : "♡ Wedding Day"}
            </div>
            <div className="header-subtitle">
              {mode === "planning" ? "RSVP & Seating Plan" : "Guest Attendance Tracker"}
            </div>
          </div>
          <div className="header-stats">
            {isDemoMode && <span className="demo-badge">Demo Mode</span>}
            {daysUntilWedding !== null && (
              <div className="stat-pill" style={daysUntilWedding === 0 ? { borderColor: "var(--gold)", background: "rgba(201,168,76,0.15)" } : {}}>
                <span className="num">
                  {daysUntilWedding === 0 ? "🎊" : daysUntilWedding > 0 ? daysUntilWedding : Math.abs(daysUntilWedding)}
                </span>
                <span className="lbl">
                  {daysUntilWedding === 0 ? "Today!" : daysUntilWedding > 0 ? "Days to go" : "Days ago"}
                </span>
              </div>
            )}
            {mode === "planning" ? (
              <>
                <div className="stat-pill">
                  <span className="num">{rsvpConfirmed}/{total}</span>
                  <span className="lbl">Confirmed</span>
                </div>
                <div className="stat-pill">
                  <span className="num">{rsvpHeadcount}</span>
                  <span className="lbl">Headcount</span>
                </div>
                <div className="stat-pill">
                  <span className="num">{rsvpPending}</span>
                  <span className="lbl">Pending</span>
                </div>
              </>
            ) : (
              <>
                <div className="stat-pill">
                  <span className="num">{arrived}/{guests.length}</span>
                  <span className="lbl">Arrived</span>
                </div>
                <div className="stat-pill">
                  <span className="num">{guests.length > 0 ? Math.round((arrived / guests.length) * 100) : 0}%</span>
                  <span className="lbl">Attendance</span>
                </div>
                {ANGBAO_ENABLED && (
                  <div className="stat-pill">
                    <span className="num">🧧 {angbaoCount}</span>
                    <span className="lbl">Angbaos</span>
                  </div>
                )}
              </>
            )}
            <button className="gear-btn" onClick={() => setSetupOpen(true)} title="Wedding Setup">
              <Icon.Settings />
            </button>
            <div className="mode-toggle">
              <button className={`mode-btn ${mode === "planning" ? "active" : ""}`} onClick={() => switchMode("planning")}>
                📋 Planning
              </button>
              <button className={`mode-btn ${mode === "dday" ? "active" : ""}`} onClick={() => switchMode("dday")}>
                💒 D-Day
              </button>
            </div>
          </div>
        </header>

        {/* VIEW TABS */}
        <div className="view-tabs">
          {mode === "planning" ? (
            <>
              <button className={`view-tab ${view === "rsvp" ? "active" : ""}`} onClick={() => setView("rsvp")}>
                <Icon.Mail /> RSVP
              </button>
              <button className={`view-tab ${view === "seating" ? "active" : ""}`} onClick={() => setView("seating")}>
                <Icon.Users /> Seating Plan
              </button>
              <button className={`view-tab ${view === "wedding-page" ? "active" : ""}`} onClick={() => setView("wedding-page")}>
                <Icon.Star /> Wedding Page
              </button>
              <button className={`view-tab ${view === "wishes-wrapped" ? "active" : ""}`} onClick={() => setView("wishes-wrapped")}>
                ✨ Wishes Wrapped
              </button>
            </>
          ) : (
            <>
              <button className={`view-tab ${view === "guests" ? "active" : ""}`} onClick={() => setView("guests")}>
                <Icon.Check /> Guest List
              </button>
              <button className={`view-tab ${view === "tables" ? "active" : ""}`} onClick={() => setView("tables")}>
                <Icon.Table /> Tables
              </button>
              {ANGBAO_ENABLED && (
                <button className={`view-tab ${view === "angbao" ? "active" : ""}`} onClick={() => setView("angbao")}>
                  <Icon.Gift /> Angbao Tracker
                </button>
              )}
              {ANGBAO_ENABLED && !isDemoMode && (
                <button className={`view-tab ${view === "submissions" ? "active" : ""}`} onClick={() => setView("submissions")}>
                  <Icon.Upload /> Submissions
                  {pendingSubs > 0 && <span className="sub-pill">{pendingSubs}</span>}
                </button>
              )}
            </>
          )}
        </div>

        {/* TOOLBAR */}
        <div className="toolbar">
          {mode === "dday" && (
            <>
              <div className="search-wrap">
                <Icon.Search />
                <input className="search-input" placeholder="Search name, table, or #draw-number…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="filter-tabs">
                {[["all","All"],["arrived","Arrived"],["pending","Pending"],...(ANGBAO_ENABLED ? [["angbao","🧧 Gave"]] : [])].map(([k,l]) => (
                  <button key={k} className={`filter-tab ${filter === k ? "active" : ""}`} onClick={() => setFilter(k)}>{l}</button>
                ))}
              </div>
            </>
          )}
          <button className="btn btn-outline" onClick={() => { setModal("upload"); }}>
            <Icon.Upload /> Import CSV
          </button>
          <button className="btn btn-gold" onClick={() => { setEditGuest(null); setForm({ name: "", table_number: "", notes: "", party: "", is_vip: false }); setModal("add"); }}>
            <Icon.Plus /> Add Guest
          </button>
          {mode === "dday" && (
            <>
              <button className="btn btn-outline btn-sm" onClick={exportCSV} title="Export CSV"><Icon.Download /></button>
              <button className="btn btn-outline btn-sm" onClick={backupJSON} title="Backup (JSON)">Backup</button>
              <button className="btn btn-outline btn-sm" onClick={loadGuests} title="Refresh"><Icon.Refresh /></button>
            </>
          )}
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
                  {ANGBAO_ENABLED && (
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
                      {g.draw_number ? <span className="draw-badge" title="Lucky-draw number">🎟 #{g.draw_number}</span> : null}
                    </div>
                  )}
                  <div className="guest-actions">
                    <button className="icon-btn" onClick={() => { setEditGuest(g); setForm({ name: g.name, table_number: g.table_number, notes: g.notes || "", party: g.party || "", is_vip: g.is_vip || false }); setModal("edit"); }}>
                      <Icon.Edit />
                    </button>
                    <button className="icon-btn danger" onClick={() => { setPendingDelete(g); setDeleteConfirmText(""); setModal("delete-confirm"); }}><Icon.Trash /></button>
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
                          {ANGBAO_ENABLED && g.angbao_given && <span style={{fontSize:"14px"}}>🧧</span>}
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
                              {ANGBAO_ENABLED && (
                                <div className="popup-row">
                                  <span className="popup-label">Angbao</span>
                                  <button
                                    className={`angbao-toggle ${g.angbao_given ? "given" : "not-given"}`}
                                    onClick={(e) => { e.stopPropagation(); toggleAngbao(g); }}
                                  >
                                    🧧 {g.angbao_given ? "Received" : "Pending"}
                                  </button>
                                </div>
                              )}
                              {ANGBAO_ENABLED && g.angbao_given && (
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
                              {ANGBAO_ENABLED && g.draw_number ? (
                                <div className="popup-row">
                                  <span className="popup-label">Lucky draw</span>
                                  <span className="draw-badge">🎟 #{g.draw_number}</span>
                                </div>
                              ) : null}
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
          ) : view === "rsvp" ? (
            <RsvpTab
              guests={guests}
              onUpdate={updateGuest}
              onDelete={(g) => { setPendingDelete(g); setDeleteConfirmText(""); setModal("delete-confirm"); }}
              showToast={showToast}
              enableSmartRsvp={!!wedding?.enable_smart_rsvp}
              events={weddingEvents}
              eventRsvps={eventRsvps}
              onSetInvited={setGuestInvited}
              onBulkInvite={bulkInvite}
            />
          ) : view === "seating" ? (
            <SeatingTab guests={guests} onUpdate={updateGuest} onResetSeating={resetSeating} showToast={showToast} />
          ) : view === "wedding-page" ? (
            <WeddingPageTab wedding={wedding} onSave={saveWeddingPage} showToast={showToast} />
          ) : view === "wishes-wrapped" ? (
            <WishesWrappedTab guests={guests} wedding={wedding} />
          ) : ANGBAO_ENABLED && view === "angbao" ? (
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
                    {g.draw_number ? <span className="draw-badge" style={{marginLeft:"8px"}}>🎟 #{g.draw_number}</span> : null}
                    <button className={`angbao-toggle ${g.angbao_given ? "given" : "not-given"}`} onClick={() => toggleAngbao(g)} style={{marginLeft:"8px"}}>
                      {g.angbao_given ? "✓ Received" : "Mark Received"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* SUBMISSIONS VIEW — guest-uploaded receipts awaiting confirmation */
            <div className="subs-list">
              {submissions.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">📨</div>
                  <div className="empty-text">No guest uploads yet</div>
                  <div className="empty-sub">Guests can optionally upload a receipt from the gift page. You can always confirm in person instead.</div>
                </div>
              ) : submissions.map((s) => (
                <div key={s.id} className={`sub-row is-${s.status}`}>
                  <div style={{ flex: 1 }}>
                    <div className="sub-name">{s.guest_name}</div>
                    <div className="sub-meta">{formatTime(s.created_at)}{s.status !== "pending" ? ` · ${s.status}` : ""}</div>
                  </div>
                  <div className="sub-claim">{s.claimed_amount ? `$${s.claimed_amount}` : "—"}</div>
                  <div className="sub-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => viewReceipt(s)}>View receipt</button>
                    {s.status === "pending" ? (
                      <>
                        <button className="btn btn-gold btn-sm" onClick={() => openApprove(s)}>Approve</button>
                        <button className="btn btn-outline btn-sm" onClick={() => rejectSubmission(s)}>Reject</button>
                      </>
                    ) : (
                      <span className={`sub-status ${s.status}`}>{s.status}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
                  Required column: <strong>name</strong>. Optional: <strong>table</strong> (or table_number), <strong>notes</strong>, <strong>vip</strong> (true/false), <strong>party</strong> (bride/groom).
                  {" "}Not sure of the format?{" "}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{marginTop:"6px"}}
                    onClick={() => download(guestImportTemplateCSV(), "guest-import-template.csv", "text/csv")}
                  >
                    <Icon.Download /> Download template
                  </button>
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

        {/* WEDDING SETUP MODAL */}
        {setupOpen && (
          <div className="setup-modal-overlay" onClick={() => setSetupOpen(false)}>
            <div className="setup-modal" onClick={(e) => e.stopPropagation()}>
              <div className="setup-modal-hd">
                <div className="setup-modal-hd-title">
                  {wedding === null ? "👋 Set up your wedding" : "Wedding Setup"}
                </div>
                <button className="setup-modal-close" onClick={() => setSetupOpen(false)}>
                  <Icon.X />
                </button>
              </div>
              <WeddingSetupTab
                wedding={wedding}
                events={weddingEvents}
                onSaveEvents={saveEvents}
                onSave={async (form) => { const ok = await saveWedding(form); if (ok) setSetupOpen(false); }}
                showToast={showToast}
              />
            </div>
          </div>
        )}

        {/* APPROVE SUBMISSION MODAL */}
        {modal === "approve" && approveSub && (
          <div className="modal-overlay" onClick={() => { setModal(null); setApproveSub(null); }}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">Confirm Ang-Bao</div>
              <div className="approve-claim">
                <div><strong>{approveSub.guest_name}</strong> uploaded a receipt</div>
                <div style={{ fontSize: "13px", color: "var(--brown)", opacity: 0.7, marginTop: "4px" }}>
                  Claimed amount: {approveSub.claimed_amount ? `$${approveSub.claimed_amount}` : "not stated"}
                </div>
                <button className="btn btn-outline btn-sm" style={{ marginTop: "8px" }} onClick={() => viewReceipt(approveSub)}>View receipt</button>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Confirmed amount ($)</label>
                  <input className="form-input" type="number" placeholder="0" value={approveAmount} onChange={(e) => setApproveAmount(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Match to a guest on the list</label>
                  <input className="form-input" placeholder="Search guests…" value={approveSearch} onChange={(e) => setApproveSearch(e.target.value)} />
                  <div className="guest-pick-list" style={{ marginTop: "8px" }}>
                    {guests
                      .filter((g) => g.name.toLowerCase().includes(approveSearch.toLowerCase()))
                      .slice(0, 30)
                      .map((g) => (
                        <button key={g.id} className="guest-pick" onClick={() => finalizeApproval(approveSub, g, approveAmount)}>
                          {g.name} <span style={{ opacity: 0.55, fontSize: "12px" }}>· Table {g.table_number}{g.angbao_given ? " · already gave" : ""}</span>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => { setModal(null); setApproveSub(null); }}>Cancel</button>
                <button className="btn btn-gold" onClick={approveAsNewGuest}>+ Add as new guest</button>
              </div>
            </div>
          </div>
        )}

        {/* DELETE GUEST CONFIRMATION */}
        {modal === "delete-confirm" && pendingDelete && (
          <div className="modal-overlay" onClick={() => { setModal(null); setPendingDelete(null); }}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">Delete Guest</div>
              <p style={{ fontSize: 14, color: "var(--charcoal)", lineHeight: 1.6, marginBottom: 16 }}>
                Permanently delete <strong>{pendingDelete.name}</strong>? This removes them from all records and cannot be undone.
              </p>
              {safeDeleteEnabled && (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Type DELETE to confirm</label>
                  <input
                    className="form-input"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && deleteConfirmText === "DELETE") {
                        deleteGuest(pendingDelete); setModal(null); setPendingDelete(null);
                      }
                    }}
                  />
                </div>
              )}
              <label className="checkbox-label" style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={safeDeleteEnabled}
                  onChange={(e) => {
                    setSafeDeleteEnabled(e.target.checked);
                    localStorage.setItem("safeDelete", e.target.checked ? "true" : "false");
                    if (!e.target.checked) setDeleteConfirmText("");
                  }}
                />
                Require typing DELETE
              </label>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => { setModal(null); setPendingDelete(null); }}>Cancel</button>
                <button
                  className="btn"
                  style={{
                    background: "#c0392b", color: "white",
                    opacity: safeDeleteEnabled && deleteConfirmText !== "DELETE" ? 0.4 : 1,
                    cursor: safeDeleteEnabled && deleteConfirmText !== "DELETE" ? "not-allowed" : "pointer",
                  }}
                  disabled={safeDeleteEnabled && deleteConfirmText !== "DELETE"}
                  onClick={() => { deleteGuest(pendingDelete); setModal(null); setPendingDelete(null); }}
                >
                  Delete
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