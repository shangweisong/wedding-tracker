import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { sb, isDemoMode } from "../lib/supabase.js";
import { theme } from "../shared/theme.js";
import { cleanName, cleanNotes, cleanParty, cleanRelationshipGroup, cleanFriendSubgroup, cleanEmail, cleanSpeech } from "../lib/validation.js";
import { LOCALES, useLocale } from "../i18n/index.jsx";
import { localizeWedding, TRANSLATABLE_FIELDS } from "../i18n/content.js";
import { localizeEvents } from "../lib/eventLocalize.js";
import { buildEventResponses, declineAllResponses, hydrateEventState, primaryAnsweredAllEvents } from "../lib/rsvpFormPayload.js";
import { visibleEventsFor } from "../lib/eventVisibility.js";
import { MAX_PIN, cleanPin, isOpenMode, openRsvpErrorKey, registerResultErrorKey } from "../lib/openRsvp.js";
import { sanitizeThemeTokens, isCompleteThemeTokens, themeTokenStyle } from "../lib/themeTokens.js";
import { buildIcsDataUrl } from "./buildIcs.js";
import LanguageSwitcher from "../i18n/LanguageSwitcher.jsx";
import { Heart, EnvelopeSimple } from "@phosphor-icons/react";

const MEAL_OPTIONS = [
  { value: "Halal", labelKey: "rsvp.meal.Halal" },
  { value: "Vegetarian", labelKey: "rsvp.meal.Vegetarian" },
  { value: "Normal", labelKey: "rsvp.meal.Normal" },
];

const RELATIONSHIP_OPTIONS = [
  { value: "family", labelKey: "rsvp.rel.family" },
  { value: "colleagues", labelKey: "rsvp.rel.colleagues" },
  { value: "friends", labelKey: "rsvp.rel.friends" },
  { value: "other", labelKey: "rsvp.rel.other" },
];

const FRIEND_SUBGROUP_OPTIONS = [
  { value: "army", labelKey: "rsvp.friend.army" },
  { value: "primary_school", labelKey: "rsvp.friend.primary_school" },
  { value: "secondary_school", labelKey: "rsvp.friend.secondary_school" },
  { value: "tertiary", labelKey: "rsvp.friend.tertiary" },
  { value: "university", labelKey: "rsvp.friend.university" },
  { value: "other", labelKey: "rsvp.friend.other" },
];

// Opt-in playful options (#42) — appended only when the couple enables
// `enable_fun_rsvp_options` in Wedding Setup.
const FUN_RELATIONSHIP_OPTION = { value: "complicated", labelKey: "rsvp.rel.complicated" };
const FUN_FRIEND_SUBGROUP_OPTION = { value: "secret", labelKey: "rsvp.friend.secret" };


const styles = theme + `
  .rsvp-wrap {
    min-height: 100vh; display: flex; align-items: center;
    justify-content: center; padding: 24px;
  }
  .rsvp-card {
    background: white; border-radius: 20px; padding: 40px 36px;
    width: 100%; max-width: 480px;
    box-shadow: var(--shadow-lg); border: 1.5px solid rgba(201,168,76,0.15);
    animation: rsvpCardIn 0.45s ease both;
  }
  @keyframes rsvpCardIn {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .rsvp-logo {
    font-family: 'Cormorant Garamond', serif; font-size: 32px;
    color: var(--gold-dark); text-align: center; margin-bottom: 8px;
  }
  .rsvp-logo-heart {
    display: inline-block; margin-right: 5px;
    animation: rsvpPulse 2.5s ease-in-out 2;
  }
  @keyframes rsvpPulse {
    0%, 100% { transform: scale(1); }
    50%       { transform: scale(1.15); }
  }
  @keyframes rsvp-spin { to { transform: rotate(360deg); } }
  .rsvp-divider { height: 1px; background: rgba(201,168,76,0.2); margin-bottom: 24px; }

  .rsvp-label {
    display: block; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--brown); font-weight: 500; margin-bottom: 8px;
  }
  .rsvp-field { margin-bottom: 20px; }

  .rsvp-input {
    width: 100%; padding: 11px 13px; box-sizing: border-box;
    border: 1.5px solid rgba(201,168,76,0.3); border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--charcoal);
    outline: none; background: var(--warm-white); transition: border-color 0.15s;
  }
  .rsvp-input:focus { border-color: var(--gold); background: white; }
  .rsvp-input::placeholder { color: rgba(92,74,42,0.55); }
  textarea.rsvp-input { resize: vertical; min-height: 80px; }

  .attend-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .attend-btn {
    padding: 14px; border-radius: 10px;
    border: 1.5px solid rgba(201,168,76,0.25); background: white;
    cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 14px;
    font-weight: 500; color: var(--brown); transition: all 0.15s; text-align: center;
  }
  .attend-btn:hover { border-color: var(--gold); }
  .attend-btn.yes.active { background: rgba(201,168,76,0.1); border-color: var(--gold); color: var(--gold-dark); }
  .attend-btn.no.active  { background: rgba(44,36,22,0.06); border-color: rgba(44,36,22,0.3); color: var(--charcoal); }

  .meal-opts { display: flex; flex-direction: column; gap: 8px; }
  .meal-opt {
    display: flex; align-items: center; gap: 12px; padding: 12px 14px;
    border-radius: 10px; border: 1.5px solid rgba(201,168,76,0.2);
    cursor: pointer; transition: all 0.15s; font-size: 14px; color: var(--charcoal);
  }
  .meal-opt:hover { border-color: var(--gold); }
  .meal-opt.active { background: rgba(201,168,76,0.08); border-color: var(--gold); }
  .meal-radio {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2px solid rgba(201,168,76,0.4); flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; transition: all 0.15s;
  }
  .meal-opt.active .meal-radio { border-color: var(--gold); background: var(--gold); }
  .meal-radio-dot { width: 6px; height: 6px; border-radius: 50%; background: white; }

  .rsvp-error {
    font-size: 13px; color: var(--red); margin-bottom: 16px;
    padding: 10px 13px; background: var(--red-soft);
    border-radius: 8px; border-left: 3px solid var(--red);
  }

  .rsvp-submit {
    width: 100%; padding: 14px; border-radius: 50px; border: none;
    background: var(--gold); color: white; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500;
    transition: background 0.15s; letter-spacing: 0.06em; margin-top: 4px;
  }
  .rsvp-submit:hover { background: var(--gold-dark); }
  .rsvp-submit:disabled { opacity: 0.6; cursor: default; }

  .rsvp-confirm { text-align: center; }
  .rsvp-confirm-heart {
    margin-bottom: 16px;
    display: flex; justify-content: center; align-items: center;
  }
  .rsvp-confirm-title {
    font-family: 'Cormorant Garamond', serif; font-size: 36px;
    color: var(--charcoal); margin-bottom: 8px; font-weight: 300; line-height: 1.1;
  }
  .rsvp-confirm-name {
    font-family: 'Cormorant Garamond', serif; font-size: 20px;
    color: var(--gold-dark); font-style: italic; margin-bottom: 14px;
  }
  .rsvp-confirm-msg { font-size: 14px; color: var(--brown); opacity: 0.8; line-height: 1.7; margin-bottom: 20px; }
  .rsvp-confirm-details {
    display: flex; flex-direction: column; gap: 6px;
    padding: 14px 18px; border-radius: 10px;
    background: var(--warm-white); border: 1px solid rgba(201,168,76,0.2);
  }
  .rsvp-confirm-detail-row { font-size: 13px; color: var(--brown); line-height: 1.5; }
  .rsvp-event-info { font-size: 13px; color: var(--brown); opacity: 0.65; text-align: center; margin-bottom: 6px; line-height: 1.5; }

  /* Smart RSVP per-event cards (#78) */
  .rsvp-event-card { border: 1px solid rgba(201,168,76,0.25); border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; background: var(--warm-white); }
  .rsvp-event-hd { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .rsvp-event-name { font-weight: 600; font-size: 15px; color: var(--charcoal); }
  .rsvp-event-time { font-size: 12px; color: var(--brown); opacity: 0.7; white-space: nowrap; }
  .rsvp-event-loc { font-size: 12px; color: var(--brown); opacity: 0.65; margin-top: 2px; }
  .rsvp-body-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 9px 0; border-top: 1px solid rgba(201,168,76,0.12); margin-top: 8px; }
  .rsvp-body-name { font-size: 13px; color: var(--charcoal); flex: 1; min-width: 80px; }
  .rsvp-yn { display: flex; gap: 6px; }
  .rsvp-yn-btn { padding: 6px 12px; border-radius: 8px; border: 1.5px solid rgba(201,168,76,0.25); background: white; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--brown); transition: all 0.15s; }
  .rsvp-yn-btn:hover { border-color: var(--gold); }
  .rsvp-yn-btn.yes.active { background: rgba(201,168,76,0.12); border-color: var(--gold); color: var(--gold-dark); }
  .rsvp-yn-btn.no.active { background: rgba(44,36,22,0.06); border-color: rgba(44,36,22,0.3); color: var(--charcoal); }
  .rsvp-body-meal { flex-basis: 100%; margin-top: 4px; }

  .demo-badge {
    display: inline-block; font-size: 11px; letter-spacing: 0.1em;
    text-transform: uppercase; padding: 3px 10px; border-radius: 20px;
    background: rgba(192,57,43,0.1); color: var(--red);
    border: 1px solid rgba(192,57,43,0.2); margin-bottom: 16px;
  }

  /* Name search dropdown */
  .rsvp-name-wrap { position: relative; }
  .rsvp-suggestions {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0;
    background: white; border: 1.5px solid rgba(201,168,76,0.3);
    border-radius: 8px; box-shadow: var(--shadow-lg); z-index: 10;
    overflow: hidden;
  }
  .rsvp-suggestion-item {
    padding: 11px 14px; font-size: 14px; color: var(--charcoal);
    cursor: pointer; transition: background 0.1s;
    border-bottom: 1px solid rgba(201,168,76,0.1);
  }
  .rsvp-suggestion-item:last-child { border-bottom: none; }
  .rsvp-suggestion-item:hover, .rsvp-suggestion-item.focused { background: rgba(201,168,76,0.07); }
  .rsvp-suggestion-empty {
    padding: 11px 14px; font-size: 13px; color: var(--brown); opacity: 0.5;
  }
  .rsvp-name-selected { position: relative; }
  .rsvp-name-clear {
    position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer;
    color: var(--brown); opacity: 0.4; font-size: 20px; line-height: 1; padding: 2px 4px;
  }
  .rsvp-name-clear:hover { opacity: 0.75; }

  .rsvp-collapse { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.3s ease; }
  .rsvp-collapse.open { grid-template-rows: 1fr; }
  .rsvp-collapse-inner { overflow: hidden; }

  @media (max-width: 560px) {
    .rsvp-card { padding: 28px 20px; }
    .attend-btns { grid-template-columns: 1fr; }
    .rsvp-submit-wrap {
      position: sticky; bottom: 0;
      margin: 4px -20px -28px;
      padding: 10px 20px 24px;
      background: white;
      border-top: 1px solid rgba(201,168,76,0.15);
    }
    .rsvp-submit { margin-top: 0; }
  }

  /* ── GARDEN THEME ─────────────────────────────────────────────────────────── */
  [data-theme="garden"] {
    --gold:       #6b9e4e;
    --gold-light: #b8d9a0;
    --gold-dark:  #3d6b2a;
    --charcoal:   #1a3310;
    --brown:      #4a6b35;
    --warm-white: #f0f5ec;
  }
  [data-theme="garden"].rsvp-wrap { background: #e8f2e3; }
  [data-theme="garden"] .rsvp-card        { border-color: rgba(107,158,78,0.25); }
  [data-theme="garden"] .rsvp-divider     { background: rgba(107,158,78,0.25); }
  [data-theme="garden"] .rsvp-input       { border-color: rgba(107,158,78,0.35); }
  [data-theme="garden"] .attend-btn       { border-color: rgba(107,158,78,0.25); }
  [data-theme="garden"] .meal-opt         { border-color: rgba(107,158,78,0.2); }
  [data-theme="garden"] .rsvp-suggestions { border-color: rgba(107,158,78,0.35); }
  [data-theme="garden"] .rsvp-suggestion-item { border-bottom-color: rgba(107,158,78,0.12); }
  [data-theme="garden"] .rsvp-suggestion-item:hover { background: rgba(107,158,78,0.08); }
  [data-theme="garden"] .rsvp-logo        { font-family: 'Libre Baskerville', serif; }
  [data-theme="garden"] .rsvp-card        { background: #f3f8f0; }

  /* ── CHINESE (RED & GOLD) THEME ────────────────────────────────────────────── */
  [data-theme="chinese"] {
    --gold:       #c9a84c;
    --gold-light: #f5dc80;
    --gold-dark:  #a07830;
    --charcoal:   #6b0000;
    --brown:      #8b1a1a;
    --warm-white: #fff5f5;
  }
  [data-theme="chinese"].rsvp-wrap {
    background-color: #fff0f0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Ctext x='12' y='80' font-family='serif' font-size='72' font-weight='900' fill='%23c9a84c' opacity='0.08' transform='rotate(-10 52 64)'%3E%E5%96%9C%3C/text%3E%3Ctext x='94' y='162' font-family='serif' font-size='72' font-weight='900' fill='%23c9a84c' opacity='0.08' transform='rotate(8 134 146)'%3E%E5%96%9C%3C/text%3E%3C/svg%3E");
    background-size: 180px 180px;
  }
  [data-theme="chinese"] .rsvp-card        { border-color: rgba(180,0,0,0.15); }
  [data-theme="chinese"] .rsvp-divider     { background: rgba(180,0,0,0.15); }
  [data-theme="chinese"] .rsvp-input       { border-color: rgba(180,0,0,0.2); }
  [data-theme="chinese"] .attend-btn       { border-color: rgba(180,0,0,0.15); }
  [data-theme="chinese"] .meal-opt         { border-color: rgba(180,0,0,0.12); }
  [data-theme="chinese"] .rsvp-suggestions { border-color: rgba(180,0,0,0.2); }
  [data-theme="chinese"] .rsvp-suggestion-item { border-bottom-color: rgba(180,0,0,0.08); }
  [data-theme="chinese"] .rsvp-suggestion-item:hover { background: rgba(180,0,0,0.04); }
  [data-theme="chinese"] .rsvp-card        { background: #fff8f8; }
  [data-theme="chinese"] .rsvp-submit      { background: #6b0000; }
  [data-theme="chinese"] .rsvp-submit:hover { background: #4a0000; }
`;

function ConfirmationView({ name, attending, wedding }) {
  const { t, locale } = useLocale();
  const dtLocale = locale === "zh-TW" ? "zh-TW" : "en-GB";
  const lw = localizeWedding(wedding, locale);
  const couple = lw?.bride_name && lw?.groom_name
    ? `${lw.bride_name} & ${lw.groom_name}`
    : t("rsvp.confirm.coupleFallback");
  const date = wedding?.wedding_date ? formatDate(wedding.wedding_date, dtLocale) : null;
  const venue = wedding?.venue_name || null;
  const icsUrl = attending ? buildIcsDataUrl(wedding, t("rsvp.confirm.eventTitleFallback")) : null;
  return (
    <div className="rsvp-confirm">
      <div className="rsvp-confirm-heart">
        {attending
          ? <Heart size={56} color="var(--gold)" weight="light" />
          : <EnvelopeSimple size={56} color="var(--brown)" weight="light" />}
      </div>
      <div className="rsvp-confirm-title">
        {attending ? t("rsvp.confirm.seeYou") : t("rsvp.confirm.miss")}
      </div>
      <div className="rsvp-confirm-name">{name}</div>
      <div className="rsvp-confirm-msg">
        {attending
          ? t("rsvp.confirm.yesMsg", { couple })
          : t("rsvp.confirm.noMsg", { couple })}
      </div>
      {attending && (date || venue) && (
        <div className="rsvp-confirm-details">
          {date  && <div className="rsvp-confirm-detail-row">📅 {date}</div>}
          {venue && <div className="rsvp-confirm-detail-row">📍 {venue}</div>}
        </div>
      )}
      {icsUrl && (
        <a
          href={icsUrl}
          download="wedding.ics"
          style={{ display: "inline-block", marginTop: 16, fontSize: 13, color: "var(--gold-dark)", textDecoration: "underline", cursor: "pointer" }}
        >
          📅 {t("rsvp.confirm.addToCalendar")}
        </a>
      )}
    </div>
  );
}

function formatDate(dateStr, dtLocale = "en-GB") {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat(dtLocale, { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(y, m - 1, d));
}

// 'HH:MM' → localized 12-hour label (e.g. "2:00 PM"). Empty string if unset.
function formatEventTime(hhmm, dtLocale = "en-GB") {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return new Intl.DateTimeFormat(dtLocale, { hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(2000, 0, 1, h, m));
}

export default function RsvpPage() {
  const { t, locale } = useLocale();
  const dtLocale = locale === "zh-TW" ? "zh-TW" : "en-GB";
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get("token") || "";

  const [wedding, setWedding]         = useState(null);
  // Couple content in the active language (per-field fallback to English) — #53 Phase 2.
  const w = localizeWedding(wedding, locale);

  const availableLocales = useMemo(() => {
    if (!wedding?.content_translations) return ["en"];
    const populated = ["en"];
    for (const code of Object.keys(LOCALES)) {
      if (code === "en") continue;
      const tr = wedding.content_translations[code];
      if (!tr || typeof tr !== "object") continue;
      const hasField = TRANSLATABLE_FIELDS.some((f) => typeof tr[f] === "string" && tr[f].trim() !== "");
      const hasQA = Array.isArray(tr.fun_qa) && tr.fun_qa.some((item) => typeof item?.answer === "string" && item.answer.trim() !== "");
      if (hasField || hasQA) populated.push(code);
    }
    return populated;
  }, [wedding]);

  // Custom (AI-generated) theme (#60): apply the palette on the RSVP form too, so
  // it matches the wedding page. Incomplete/invalid → fall back to the minimal preset.
  const rsvpTheme = wedding?.theme || "minimal";
  const customTokens = rsvpTheme === "custom" ? sanitizeThemeTokens(wedding?.theme_tokens) : {};
  const hasCustomTheme = isCompleteThemeTokens(customTokens);
  const effectiveTheme = rsvpTheme === "custom" ? (hasCustomTheme ? "custom" : "minimal") : rsvpTheme;
  const customThemeStyle = hasCustomTheme ? themeTokenStyle(customTokens) : null;

  // name: confirmed display name (set by token pre-fill or by guest selecting from list)
  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [attending, setAttending]     = useState(null);
  const [mealChoice, setMealChoice]   = useState("");
  const [dietary, setDietary]         = useState("");
  const [relationshipGroup, setRelationshipGroup] = useState("");
  const [friendSubgroup, setFriendSubgroup]        = useState("");
  const [wantsToSpeak, setWantsToSpeak]            = useState("");
  const [plusOneNames, setPlusOneNames]           = useState([]);
  const [closerTo, setCloserTo]                    = useState("");
  const [message, setMessage]         = useState("");
  const [error, setError]             = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [done, setDone]               = useState(false);
  const [tokenLoading, setTokenLoading] = useState(!!urlToken);

  const [configError, setConfigError]   = useState(false);

  // No-token name search state
  const [nameQuery, setNameQuery]       = useState("");
  const [nameResults, setNameResults]   = useState([]);
  const [nameSearching, setNameSearching] = useState(false);
  const [selectedToken, setSelectedToken] = useState("");
  const [suggestionFocus, setSuggestionFocus] = useState(-1);

  // activeToken: URL token takes precedence, then one selected from the name dropdown
  const activeToken = urlToken || selectedToken;

  // Open RSVP (#126): the couple disabled guest-list name checking, so the name
  // field is free-text and registration happens server-side at submit time
  // (register_open_rsvp), gated by a mandatory PIN. A token link still wins.
  const openMode = isOpenMode({ wedding, isDemoMode, activeToken });
  const [pin, setPin] = useState("");

  // Smart RSVP (#78): per-event attendance. `invitedEvents` comes from the token
  // lookup (empty unless the couple enabled smart RSVP and invited this guest).
  const PRIMARY_KEY = "__primary__";
  const [invitedEvents, setInvitedEvents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { bodyKey: { eventId: 'confirmed'|'declined' } }
  const [eventMeals, setEventMeals] = useState({}); // { bodyKey: { eventId: mealString } }
  const locEvents = localizeEvents(invitedEvents, locale);
  const useSmartForm = locEvents.length > 0;
  // #131: audience-restricted events only show once the guest's relationship
  // matches (reactive to the form's own relationship select in open mode).
  const visibleEvents = visibleEventsFor(locEvents, relationshipGroup);
  // Bodies = the primary + each named plus-one (blank plus-ones are ignored).
  const bodies = [
    { key: PRIMARY_KEY, name, is_primary: true },
    ...plusOneNames.map((nm, i) => ({ key: `p${i}`, name: nm, is_primary: false })),
  ];
  const setBodyStatus = (bodyKey, eventId, status) =>
    setAttendance((prev) => ({ ...prev, [bodyKey]: { ...(prev[bodyKey] || {}), [eventId]: status } }));
  const setBodyMeal = (bodyKey, eventId, meal) =>
    setEventMeals((prev) => ({ ...prev, [bodyKey]: { ...(prev[bodyKey] || {}), [eventId]: meal } }));

  // Playful options are shown only when the couple opted in (#42).
  const funOptions = !!wedding?.enable_fun_rsvp_options;
  const relationshipOptions = funOptions
    ? [...RELATIONSHIP_OPTIONS, FUN_RELATIONSHIP_OPTION]
    : RELATIONSHIP_OPTIONS;
  const friendSubgroupOptions = funOptions
    ? [...FRIEND_SUBGROUP_OPTIONS, FUN_FRIEND_SUBGROUP_OPTION]
    : FRIEND_SUBGROUP_OPTIONS;

  useEffect(() => {
    if (isDemoMode) return;
    sb.rpc("get_wedding_config", {}).then((rows) => {
      if (Array.isArray(rows) && rows.length) {
        setWedding(rows[0]);
      }
    }).catch(() => { setConfigError(true); });
  }, []);

  // Keep the document title in sync with the couple + active locale.
  useEffect(() => {
    if (w?.bride_name && w?.groom_name) {
      document.title = t("rsvp.docTitle", { bride: w.bride_name, groom: w.groom_name });
    }
  }, [w?.bride_name, w?.groom_name, t]);

  // Hydrate the form from the active token — both the "Update RSVP" deep link and
  // a guest picked from the name search. Also loads the guest's invited events and
  // any existing per-event answers (#78). The full-page spinner only shows for the
  // deep link; the search flow already has the form on screen.
  useEffect(() => {
    if (!activeToken || isDemoMode) return;
    let cancelled = false;
    sb.rpc("get_guest_by_rsvp_token", { p_token: activeToken })
      .then((rows) => {
        const g = Array.isArray(rows) ? rows[0] : rows;
        if (!g || cancelled) return;
        setName(g.name ?? "");
        setEmail(g.email ?? "");
        setAttending(g.rsvp_status === "confirmed" ? true : g.rsvp_status === "declined" ? false : null);
        setMealChoice(g.meal_choice ?? "");
        setDietary(g.dietary_notes ?? "");
        setRelationshipGroup(g.relationship_group ?? "");
        setFriendSubgroup(g.friend_subgroup ?? "");
        setCloserTo(g.party ?? "");
        setWantsToSpeak(g.wants_to_speak ?? "");
        const pous = Array.isArray(g.plus_one_names) ? g.plus_one_names : [];
        setPlusOneNames(pous);
        setMessage(g.rsvp_message ?? "");
        setInvitedEvents(Array.isArray(g.invited_events) ? g.invited_events : []);
        const hbodies = [
          { key: PRIMARY_KEY, name: g.name ?? "", is_primary: true },
          ...pous.map((nm, i) => ({ key: `p${i}`, name: nm, is_primary: false })),
        ];
        const { attendance: att, meals: ml } = hydrateEventState(g.event_responses, hbodies);
        setAttendance(att);
        setEventMeals(ml);
      })
      .catch(() => {})
      .finally(() => { if (urlToken && !cancelled) setTokenLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToken]);

  // Open mode (#126): the token lookup never runs, so fetch the active events
  // directly for the smart per-event form. With no slug or no active events the
  // form gracefully stays on the legacy yes/no flow (locEvents stays empty).
  useEffect(() => {
    if (!openMode || !wedding?.enable_smart_rsvp || !wedding?.slug) return;
    let cancelled = false;
    sb.rpc("get_public_events", { p_slug: wedding.slug })
      .then((rows) => { if (!cancelled && Array.isArray(rows)) setInvitedEvents(rows); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [openMode, wedding?.enable_smart_rsvp, wedding?.slug]);

  // Debounced name search — fires when guest types in the no-token name field.
  // Never in open mode: the whole point is that names are not cross-checked.
  useEffect(() => {
    if (activeToken || isDemoMode || openMode || nameQuery.trim().length < 2) return;
    const t = setTimeout(async () => {
      setNameSearching(true);
      try {
        const rows = await sb.rpc("find_guest_by_name", { p_name: nameQuery.trim() });
        setNameResults(Array.isArray(rows) ? rows : []);
      } catch {
        setNameResults([]);
      } finally {
        setNameSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [nameQuery, activeToken, openMode]);

  function selectGuest(guest) {
    setName(guest.name);
    setSelectedToken(guest.rsvp_token);
    setNameQuery(guest.name);
    setError("");
  }

  function clearNameSelection() {
    setName("");
    setSelectedToken("");
    setNameQuery("");
  }

  // Dropdown is visible only when there is no active token, not in demo mode,
  // and the query is long enough — derived, not stored in state.
  const showSuggestions = !activeToken && !isDemoMode && !openMode && nameQuery.trim().length >= 2;

  const submit = async (e) => {
    e.preventDefault();
    if (!isDemoMode && !activeToken && !openMode) {
      setError(t("rsvp.err.nameSelect"));
      return;
    }
    if (isDemoMode && !name.trim()) { setError(t("rsvp.err.nameEnter")); return; }
    if (openMode) {
      if (!cleanName(name)) { setError(t("rsvp.err.nameEnter")); return; }
      if (!cleanPin(pin)) { setError(t("rsvp.err.pinRequired")); return; }
    }
    if (attending === null) { setError(t("rsvp.err.attendingSelect")); return; }
    // Declining overall skips the rest (#131) — only a "yes" needs the
    // per-event answers (smart mode) and a reachable email.
    if (attending) {
      if (useSmartForm && !primaryAnsweredAllEvents(attendance, PRIMARY_KEY, visibleEvents)) {
        setError(t("rsvp.err.answerAllEvents")); return;
      }
      if (!cleanEmail(email)) { setError(t("rsvp.err.emailInvalid")); return; }
    }
    setError("");
    setSubmitting(true);

    if (isDemoMode) {
      await new Promise((r) => setTimeout(r, 800));
      setDone(true);
      setSubmitting(false);
      return;
    }

    try {
      // Open mode registers at submit time: the RPC verifies the PIN, then
      // finds-or-creates the guest (idempotent per name) and returns the token
      // the normal submit flow needs. Kept in a local variable on purpose —
      // setSelectedToken would fire the hydration effect and clobber the form.
      let token = activeToken;
      if (openMode) {
        const res = await sb.rpc("register_open_rsvp", {
          p_name: cleanName(name),
          p_pin:  cleanPin(pin),
        });
        // PIN failures come back as {error} (not thrown) so the server can
        // record the attempt for its brute-force rate limit.
        if (!res?.token) {
          setError(t(registerResultErrorKey(res?.error)));
          return;
        }
        token = res.token;
      }
      if (useSmartForm) {
        await sb.rpc("submit_rsvp_events", {
          p_token:              token,
          p_email:              cleanEmail(email),
          p_message:            cleanNotes(message),
          p_wants_to_speak:     attending ? cleanSpeech(wantsToSpeak) : "",
          p_relationship_group: cleanRelationshipGroup(relationshipGroup),
          p_friend_subgroup:    relationshipGroup === "friends" ? cleanFriendSubgroup(friendSubgroup) : "",
          p_party:              cleanParty(closerTo),
          p_plus_one_names:     attending
            ? plusOneNames.map((n) => cleanName(n)).filter(Boolean).slice(0, 6)
            : [],
          // Yes → answers for the visible (audience-matched) events; hidden ones
          // stay pending. No → decline the FULL invited list, so the rsvp-status
          // mirror sees every event declined and lands the guest on 'declined'.
          p_event_responses:    attending
            ? buildEventResponses({
                bodies, attendance, meals: eventMeals, events: visibleEvents, dietary: cleanNotes(dietary),
              })
            : declineAllResponses(locEvents, cleanNotes(dietary)),
        });
      } else {
        await sb.rpc("submit_rsvp", {
          p_token:              token,
          p_status:             attending ? "confirmed" : "declined",
          p_meal_choice:        attending ? mealChoice : "",
          p_dietary_notes:      cleanNotes(dietary),
          p_message:            cleanNotes(message),
          p_relationship_group: cleanRelationshipGroup(relationshipGroup),
          p_friend_subgroup:    relationshipGroup === "friends" ? cleanFriendSubgroup(friendSubgroup) : "",
          p_party:              cleanParty(closerTo),
          p_email:              cleanEmail(email),
          p_wants_to_speak:     attending ? cleanSpeech(wantsToSpeak) : "",
          p_plus_one_names:     attending
            ? plusOneNames.map((n) => cleanName(n)).filter(Boolean).slice(0, 6)
            : [],
        });
      }
      setDone(true);
    } catch (err) {
      console.error("[RSVP] submit error:", err);
      setError(t(openRsvpErrorKey(err?.message)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="rsvp-wrap" data-theme={effectiveTheme} style={{ position: "relative", ...(customThemeStyle || {}) }}>
        <LanguageSwitcher availableLocales={availableLocales} style={{ position: "absolute", top: 16, right: 16, zIndex: 20 }} />
        <div className="rsvp-card">
          <div className="rsvp-logo">
            <span className="rsvp-logo-heart">♡</span>
            {w?.bride_name && w?.groom_name
              ? `${w.bride_name} & ${w.groom_name}`
              : t("rsvp.invited")}
          </div>
          {wedding?.wedding_date || wedding?.venue_name ? (
            <div className="rsvp-event-info">
              {[formatDate(wedding.wedding_date, dtLocale), w.venue_name].filter(Boolean).join(" · ")}
            </div>
          ) : null}
          <div className="rsvp-divider" />

          {configError && (
            <div style={{ textAlign: "center", color: "var(--brown)", opacity: 0.7, fontSize: 13, marginBottom: 12 }}>
              {t("rsvp.configError")}
            </div>
          )}

          {tokenLoading ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 40, opacity: 0.65, animation: "rsvp-spin 1.2s linear infinite", display: "inline-block" }}>✦</div>
              <div style={{ marginTop: 12, color: "var(--brown)", opacity: 0.7, fontSize: 13 }}>{t("rsvp.loading")}</div>
            </div>
          ) : done ? (
            <ConfirmationView
              name={cleanName(name)}
              attending={useSmartForm
                ? attending === true && visibleEvents.some((ev) => attendance[PRIMARY_KEY]?.[ev.id] === "confirmed")
                : attending}
              wedding={w}
            />
          ) : (
            <form onSubmit={submit}>
              {isDemoMode && <div className="demo-badge">{t("rsvp.demoBadge")}</div>}

              {/* Name — four modes:
                  1. urlToken present → read-only pre-filled from DB (same as before)
                  2. selectedToken set → read-only after guest picks from search list; × to re-search
                  3. openMode → free-text (#126: no guest-list cross-check; PIN field below)
                  4. Neither → search-and-select dropdown (no-token flow) */}
              <div className="rsvp-field">
                <label className="rsvp-label">{t("rsvp.name.label")}</label>

                {isDemoMode || openMode ? (
                  <input
                    className="rsvp-input"
                    placeholder={t("rsvp.name.placeholder")}
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(""); }}
                    autoFocus
                  />
                ) : activeToken ? (
                  <div className={selectedToken ? "rsvp-name-selected" : ""}>
                    <input
                      className="rsvp-input"
                      value={name}
                      readOnly
                      style={{ opacity: 0.7, cursor: "default", paddingRight: selectedToken ? 36 : undefined }}
                    />
                    {/* Only show clear button for list-selected tokens, not URL tokens */}
                    {selectedToken && (
                      <button type="button" className="rsvp-name-clear" onClick={clearNameSelection} aria-label={t("rsvp.name.clearAria")}>
                        ×
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rsvp-name-wrap">
                    <input
                      className="rsvp-input"
                      placeholder={t("rsvp.name.searchPlaceholder")}
                      value={nameQuery}
                      onChange={(e) => { setNameQuery(e.target.value); setError(""); setSuggestionFocus(-1); }}
                      autoFocus
                      autoComplete="off"
                      role="combobox"
                      aria-expanded={showSuggestions && nameResults.length > 0}
                      aria-autocomplete="list"
                      aria-activedescendant={suggestionFocus >= 0 ? `rsvp-suggestion-${suggestionFocus}` : undefined}
                      onKeyDown={(e) => {
                        if (!showSuggestions || nameResults.length === 0) return;
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setSuggestionFocus((i) => Math.min(i + 1, nameResults.length - 1));
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setSuggestionFocus((i) => Math.max(i - 1, 0));
                        } else if (e.key === "Enter" && suggestionFocus >= 0) {
                          e.preventDefault();
                          selectGuest(nameResults[suggestionFocus]);
                          setSuggestionFocus(-1);
                        } else if (e.key === "Escape") {
                          setSuggestionFocus(-1);
                        }
                      }}
                    />
                    {showSuggestions && nameSearching && (
                      <div className="rsvp-suggestions" role="listbox">
                        <div className="rsvp-suggestion-empty">{t("rsvp.searching")}</div>
                      </div>
                    )}
                    {showSuggestions && !nameSearching && nameResults.length > 0 && (
                      <div className="rsvp-suggestions" role="listbox">
                        {nameResults.map((r, i) => (
                          <div
                            key={r.id}
                            id={`rsvp-suggestion-${i}`}
                            className={`rsvp-suggestion-item${suggestionFocus === i ? " focused" : ""}`}
                            role="option"
                            aria-selected={suggestionFocus === i}
                            onMouseDown={(e) => { e.preventDefault(); selectGuest(r); }}
                            onMouseEnter={() => setSuggestionFocus(i)}
                          >
                            {r.name}
                          </div>
                        ))}
                      </div>
                    )}
                    {showSuggestions && !nameSearching && nameResults.length === 0 && (
                      <div className="rsvp-suggestions" role="listbox">
                        <div className="rsvp-suggestion-empty">{t("rsvp.noMatch")}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Open RSVP (#126): mandatory PIN from the invitation, verified
                  server-side by register_open_rsvp at submit time */}
              {openMode && (
                <div className="rsvp-field">
                  <label className="rsvp-label">{t("rsvp.pin.label")}</label>
                  <input
                    className="rsvp-input"
                    placeholder={t("rsvp.pin.placeholder")}
                    value={pin}
                    maxLength={MAX_PIN}
                    autoComplete="off"
                    onChange={(e) => { setPin(e.target.value); setError(""); }}
                  />
                </div>
              )}

              {/* Email — used to send confirmation + reminder emails */}
              <div className="rsvp-field">
                <label className="rsvp-label">{t("rsvp.email.label")}</label>
                <input
                  className="rsvp-input"
                  type="email"
                  placeholder={t("rsvp.email.placeholder")}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                />
              </div>

              {/* Attendance — single yes/no. In smart mode this gates the per-event
                  section below (#131): "no" hides it and declines every event. */}
              <div className="rsvp-field">
                <span className="rsvp-label">{t("rsvp.attending.q")}</span>
                <div className="attend-btns">
                  <button type="button"
                    className={`attend-btn yes ${attending === true ? "active" : ""}`}
                    onClick={() => { setAttending(true); setError(""); }}>
                    {t("rsvp.attending.yes")}
                  </button>
                  <button type="button"
                    className={`attend-btn no ${attending === false ? "active" : ""}`}
                    onClick={() => { setAttending(false); setError(""); }}>
                    {t("rsvp.attending.no")}
                  </button>
                </div>
              </div>

              {/* Relationship to the couple */}
              <div className="rsvp-field">
                <label className="rsvp-label">{t("rsvp.rel.q")}</label>
                <select
                  className="rsvp-input"
                  value={relationshipGroup}
                  onChange={(e) => { setRelationshipGroup(e.target.value); setFriendSubgroup(""); }}
                >
                  <option value="">{t("common.selectOne")}</option>
                  {relationshipOptions.map((o) => (
                    <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
                  ))}
                </select>
              </div>

              {relationshipGroup === "friends" && (
                <div className="rsvp-field">
                  <label className="rsvp-label">{t("rsvp.friend.q")}</label>
                  <select
                    className="rsvp-input"
                    value={friendSubgroup}
                    onChange={(e) => setFriendSubgroup(e.target.value)}
                  >
                    <option value="">{t("common.selectOne")}</option>
                    {friendSubgroupOptions.map((o) => (
                      <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Only ask "closer to" once the guest is actually coming — for smart
                  mode that means the gate is yes AND some visible event confirmed. */}
              {(useSmartForm
                ? attending === true && visibleEvents.some((ev) => attendance[PRIMARY_KEY]?.[ev.id] === "confirmed")
                : attending) && (
                <div className="rsvp-field">
                  <span className="rsvp-label">{t("rsvp.closerTo")}</span>
                  <div className="attend-btns">
                    <button type="button"
                      className={`attend-btn yes ${closerTo === "bride" ? "active" : ""}`}
                      onClick={() => setCloserTo(closerTo === "bride" ? "" : "bride")}>
                      {w?.bride_name || t("rsvp.side.brideFallback")}
                    </button>
                    <button type="button"
                      className={`attend-btn yes ${closerTo === "groom" ? "active" : ""}`}
                      onClick={() => setCloserTo(closerTo === "groom" ? "" : "groom")}>
                      {w?.groom_name || t("rsvp.side.groomFallback")}
                    </button>
                  </div>
                </div>
              )}

              {/* ── SMART RSVP: per-event attendance (#78), gated on attending (#131) ── */}
              {useSmartForm && attending === true && (
                <>
                  {/* Additional guests first, so each appears in the per-event grid */}
                  <div className="rsvp-field">
                    <label className="rsvp-label">{t("rsvp.plus.q")}</label>
                    <select
                      className="rsvp-input"
                      value={plusOneNames.length}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setPlusOneNames((prev) => {
                          const next = prev.slice(0, n);
                          while (next.length < n) next.push("");
                          return next;
                        });
                        // Drop removed bodies' per-event answers so a re-added slot
                        // (same p{i} key) doesn't inherit the prior occupant's state.
                        const prune = (obj) => {
                          const out = { ...obj };
                          Object.keys(out).forEach((k) => {
                            if (k !== PRIMARY_KEY && Number(k.slice(1)) >= n) delete out[k];
                          });
                          return out;
                        };
                        setAttendance(prune);
                        setEventMeals(prune);
                      }}
                    >
                      {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n === 0 ? t("rsvp.plus.justMe") : t(n === 1 ? "rsvp.plus.more_one" : "rsvp.plus.more_other", { n })}
                        </option>
                      ))}
                    </select>
                    {plusOneNames.map((nm, i) => (
                      <input
                        key={i}
                        className="rsvp-input"
                        style={{ marginTop: 8 }}
                        placeholder={t("rsvp.plus.namePlaceholder", { i: i + 1 })}
                        value={nm}
                        onChange={(e) => setPlusOneNames((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                      />
                    ))}
                  </div>

                  {visibleEvents.length > 0 && (
                  <div className="rsvp-field">
                    <span className="rsvp-label">{t("rsvp.smart.title")}</span>
                    <div style={{ fontSize: 12, color: "var(--brown)", opacity: 0.6, margin: "2px 0 10px" }}>
                      {t("rsvp.smart.hint")}
                    </div>
                    {visibleEvents.map((ev) => (
                      <div key={ev.id} className="rsvp-event-card">
                        <div className="rsvp-event-hd">
                          <span className="rsvp-event-name">{ev.name}</span>
                          {ev.start_time && <span className="rsvp-event-time">{formatEventTime(ev.start_time, dtLocale)}</span>}
                        </div>
                        {ev.location && <div className="rsvp-event-loc">📍 {ev.location}</div>}
                        {bodies.filter((b) => b.is_primary || b.name.trim()).map((body) => {
                          const st = attendance[body.key]?.[ev.id];
                          return (
                            <div key={body.key} className="rsvp-body-row">
                              <span className="rsvp-body-name">{body.is_primary ? t("rsvp.smart.you") : body.name}</span>
                              <div className="rsvp-yn">
                                <button type="button" className={`rsvp-yn-btn yes ${st === "confirmed" ? "active" : ""}`}
                                  onClick={() => { setBodyStatus(body.key, ev.id, "confirmed"); setError(""); }}>
                                  {t("rsvp.attending.yes")}
                                </button>
                                <button type="button" className={`rsvp-yn-btn no ${st === "declined" ? "active" : ""}`}
                                  onClick={() => { setBodyStatus(body.key, ev.id, "declined"); setError(""); }}>
                                  {t("rsvp.attending.no")}
                                </button>
                              </div>
                              {ev.requires_meal && st === "confirmed" && (
                                <select className="rsvp-input rsvp-body-meal"
                                  value={eventMeals[body.key]?.[ev.id] || ""}
                                  onChange={(e) => setBodyMeal(body.key, ev.id, e.target.value)}>
                                  <option value="">{t("rsvp.meal.label")}</option>
                                  {MEAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
                                </select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  )}

                  <div className="rsvp-field">
                    <label className="rsvp-label">
                      {t("rsvp.dietary.label")}
                      <span style={{ opacity: 0.45, fontWeight: 400, marginLeft: 4 }}>{t("common.optional")}</span>
                    </label>
                    <input className="rsvp-input" placeholder={t("rsvp.dietary.placeholder")}
                      value={dietary} onChange={(e) => setDietary(e.target.value)} />
                  </div>

                  <div className="rsvp-field">
                    <span className="rsvp-label">{t("rsvp.speech.q")}</span>
                    <div className="attend-btns">
                      <button type="button" className={`attend-btn yes ${wantsToSpeak === "yes" ? "active" : ""}`}
                        onClick={() => setWantsToSpeak(wantsToSpeak === "yes" ? "" : "yes")}>
                        {t("rsvp.speech.yes")}
                      </button>
                      <button type="button" className={`attend-btn no ${wantsToSpeak === "no" ? "active" : ""}`}
                        onClick={() => setWantsToSpeak(wantsToSpeak === "no" ? "" : "no")}>
                        {t("rsvp.speech.no")}
                      </button>
                    </div>
                  </div>

                  {(w?.parking_notice || w?.smoking_notice || w?.extra_notice) && (
                    <div className="rsvp-field">
                      <span className="rsvp-label">{t("rsvp.notes.title")}</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {w?.parking_notice && (
                          <div style={{ fontSize: 14, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.04)" }}>
                            <strong>{t("rsvp.notes.parking")}</strong> {w.parking_notice}
                          </div>
                        )}
                        {w?.smoking_notice && (
                          <div style={{ fontSize: 14, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.04)" }}>
                            <strong>{t("rsvp.notes.smoking")}</strong> {w.smoking_notice}
                          </div>
                        )}
                        {w?.extra_notice && (
                          <div style={{ fontSize: 14, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.04)" }}>
                            {w.extra_notice}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Meal + dietary — legacy single-attendance flow, animated expand */}
              {!useSmartForm && (
              <div className={`rsvp-collapse${attending === true ? ' open' : ''}`}>
                <div className="rsvp-collapse-inner">
                  <div className="rsvp-field" style={{ paddingTop: 4 }}>
                    <span className="rsvp-label">{t("rsvp.meal.label")}</span>
                    <div className="meal-opts">
                      {MEAL_OPTIONS.map((opt) => (
                        <div key={opt.value}
                          className={`meal-opt ${mealChoice === opt.value ? "active" : ""}`}
                          onClick={() => setMealChoice(opt.value)}>
                          <span className="meal-radio">
                            {mealChoice === opt.value && <span className="meal-radio-dot" />}
                          </span>
                          {t(opt.labelKey)}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rsvp-field">
                    <label className="rsvp-label">
                      {t("rsvp.dietary.label")}
                      <span style={{ opacity: 0.45, fontWeight: 400, marginLeft: 4 }}>{t("common.optional")}</span>
                    </label>
                    <input
                      className="rsvp-input"
                      placeholder={t("rsvp.dietary.placeholder")}
                      value={dietary}
                      onChange={(e) => setDietary(e.target.value)}
                    />
                  </div>

                  {/* Do you want to give a speech? — three-state (unset toggles off) */}
                  <div className="rsvp-field">
                    <span className="rsvp-label">{t("rsvp.speech.q")}</span>
                    <div className="attend-btns">
                      <button type="button"
                        className={`attend-btn yes ${wantsToSpeak === "yes" ? "active" : ""}`}
                        onClick={() => setWantsToSpeak(wantsToSpeak === "yes" ? "" : "yes")}>
                        {t("rsvp.speech.yes")}
                      </button>
                      <button type="button"
                        className={`attend-btn no ${wantsToSpeak === "no" ? "active" : ""}`}
                        onClick={() => setWantsToSpeak(wantsToSpeak === "no" ? "" : "no")}>
                        {t("rsvp.speech.no")}
                      </button>
                    </div>
                  </div>

                  {/* Additional guests — plus-x, up to 6 (#38) */}
                  <div className="rsvp-field">
                    <label className="rsvp-label">{t("rsvp.plus.q")}</label>
                    <select
                      className="rsvp-input"
                      value={plusOneNames.length}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setPlusOneNames((prev) => {
                          const next = prev.slice(0, n);
                          while (next.length < n) next.push("");
                          return next;
                        });
                      }}
                    >
                      {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n === 0 ? t("rsvp.plus.justMe") : t(n === 1 ? "rsvp.plus.more_one" : "rsvp.plus.more_other", { n })}
                        </option>
                      ))}
                    </select>
                    {plusOneNames.map((nm, i) => (
                      <input
                        key={i}
                        className="rsvp-input"
                        style={{ marginTop: 8 }}
                        placeholder={t("rsvp.plus.namePlaceholder", { i: i + 1 })}
                        value={nm}
                        onChange={(e) =>
                          setPlusOneNames((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                        }
                      />
                    ))}
                    {plusOneNames.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, background: "rgba(212,160,80,0.14)", color: "#7a5c1e" }}>
                        {t("rsvp.plus.disclaimer")}
                      </div>
                    )}
                  </div>

                  {/* Note to guests — display-only notices configured by the couple */}
                  {(w?.parking_notice || w?.smoking_notice || w?.extra_notice) && (
                    <div className="rsvp-field">
                      <span className="rsvp-label">{t("rsvp.notes.title")}</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {w?.parking_notice && (
                          <div style={{ fontSize: 14, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.04)" }}>
                            <strong>{t("rsvp.notes.parking")}</strong> {w.parking_notice}
                          </div>
                        )}
                        {w?.smoking_notice && (
                          <div style={{ fontSize: 14, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.04)" }}>
                            <strong>{t("rsvp.notes.smoking")}</strong> {w.smoking_notice}
                          </div>
                        )}
                        {w?.extra_notice && (
                          <div style={{ fontSize: 14, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.04)" }}>
                            {w.extra_notice}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Message */}
              <div className="rsvp-field">
                <label className="rsvp-label">
                  {t("rsvp.message.label")}
                  <span style={{ opacity: 0.45, fontWeight: 400, marginLeft: 4 }}>{t("common.optional")}</span>
                </label>
                <textarea
                  className="rsvp-input"
                  placeholder={t("rsvp.message.placeholder")}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              {error && <div className="rsvp-error">{error}</div>}

              <div className="rsvp-submit-wrap">
                <button type="submit" className="rsvp-submit" disabled={submitting}>
                  {submitting ? t("rsvp.submitting") : t("rsvp.submit")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
