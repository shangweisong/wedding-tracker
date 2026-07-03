import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { sb, isDemoMode } from "../lib/supabase.js";
import { theme } from "../shared/theme.js";
import { cleanName, cleanNotes, cleanParty, cleanRelationshipGroup, cleanFriendSubgroup, cleanEmail, cleanSpeech } from "../lib/validation.js";

const MEAL_OPTIONS = ["Halal", "Vegetarian", "Normal"];

const RELATIONSHIP_OPTIONS = [
  { value: "family", label: "Family" },
  { value: "colleagues", label: "Colleagues" },
  { value: "friends", label: "Friends" },
  { value: "other", label: "Other" },
];

const FRIEND_SUBGROUP_OPTIONS = [
  { value: "army", label: "Army / NS" },
  { value: "primary_school", label: "Primary School" },
  { value: "secondary_school", label: "Secondary School" },
  { value: "tertiary", label: "JC / Poly" },
  { value: "university", label: "University" },
  { value: "other", label: "Other" },
];

// Opt-in playful options (#42) — appended only when the couple enables
// `enable_fun_rsvp_options` in Wedding Setup.
const FUN_RELATIONSHIP_OPTION = { value: "complicated", label: "It's complicated 😅" };
const FUN_FRIEND_SUBGROUP_OPTION = { value: "secret", label: "😏 It's a secret" };


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
    animation: rsvpPulse 2.5s ease-in-out infinite;
  }
  @keyframes rsvpPulse {
    0%, 100% { transform: scale(1); }
    50%       { transform: scale(1.15); }
  }
  .rsvp-eyebrow {
    font-size: 11px; color: var(--brown); opacity: 0.5;
    letter-spacing: 0.35em; text-transform: uppercase;
    text-align: center; margin-bottom: 24px;
  }
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
  .rsvp-input::placeholder { color: rgba(92,74,42,0.35); }
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
    font-size: 56px; margin-bottom: 16px;
    display: inline-block; animation: rsvpPulse 2.5s ease-in-out infinite;
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
  .rsvp-suggestion-item:hover { background: rgba(201,168,76,0.07); }
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
      background: linear-gradient(to top, white 65%, transparent);
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
  const couple = wedding?.bride_name && wedding?.groom_name
    ? `${wedding.bride_name} & ${wedding.groom_name}`
    : "the couple";
  const date = wedding?.wedding_date ? formatDate(wedding.wedding_date) : null;
  const venue = wedding?.venue_name || null;
  return (
    <div className="rsvp-confirm">
      <div className="rsvp-confirm-heart">{attending ? "♡" : "💌"}</div>
      <div className="rsvp-confirm-title">
        {attending ? "See you there!" : "We'll miss you!"}
      </div>
      <div className="rsvp-confirm-name">{name}</div>
      <div className="rsvp-confirm-msg">
        {attending
          ? `Your RSVP is confirmed. ${couple} can't wait to celebrate with you!`
          : `Thanks for letting us know. ${couple} will miss you, but hope to see you soon.`}
      </div>
      {attending && (date || venue) && (
        <div className="rsvp-confirm-details">
          {date  && <div className="rsvp-confirm-detail-row">📅 {date}</div>}
          {venue && <div className="rsvp-confirm-detail-row">📍 {venue}</div>}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}

export default function RsvpPage() {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get("token") || "";

  const [wedding, setWedding]         = useState(null);
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

  // No-token name search state
  const [nameQuery, setNameQuery]       = useState("");
  const [nameResults, setNameResults]   = useState([]);
  const [nameSearching, setNameSearching] = useState(false);
  const [selectedToken, setSelectedToken] = useState("");

  // activeToken: URL token takes precedence, then one selected from the name dropdown
  const activeToken = urlToken || selectedToken;

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
        const { bride_name, groom_name } = rows[0];
        if (bride_name && groom_name) document.title = `RSVP · ${bride_name} & ${groom_name}'s Wedding`;
      }
    }).catch(() => {});
  }, []);

  // Pre-fill form from URL token when arriving via an "Update RSVP" link.
  useEffect(() => {
    if (!urlToken || isDemoMode) return;
    sb.rpc("get_guest_by_rsvp_token", { p_token: urlToken })
      .then((rows) => {
        const g = Array.isArray(rows) ? rows[0] : rows;
        if (!g) return;
        setName(g.name ?? "");
        setEmail(g.email ?? "");
        setAttending(g.rsvp_status === "confirmed" ? true : g.rsvp_status === "declined" ? false : null);
        setMealChoice(g.meal_choice ?? "");
        setDietary(g.dietary_notes ?? "");
        setRelationshipGroup(g.relationship_group ?? "");
        setFriendSubgroup(g.friend_subgroup ?? "");
        setCloserTo(g.party ?? "");
        setWantsToSpeak(g.wants_to_speak ?? "");
        setPlusOneNames(Array.isArray(g.plus_one_names) ? g.plus_one_names : []);
        setMessage(g.rsvp_message ?? "");
      })
      .catch(() => {})
      .finally(() => setTokenLoading(false));
  }, [urlToken]);

  // Debounced name search — fires when guest types in the no-token name field.
  useEffect(() => {
    if (activeToken || isDemoMode || nameQuery.trim().length < 2) return;
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
  }, [nameQuery, activeToken]);

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
  const showSuggestions = !activeToken && !isDemoMode && nameQuery.trim().length >= 2;

  const submit = async (e) => {
    e.preventDefault();
    if (!isDemoMode && !activeToken) {
      setError("Please type your name above and select it from the list.");
      return;
    }
    if (isDemoMode && !name.trim()) { setError("Please enter your name."); return; }
    if (attending === null) { setError("Please select whether you'll be attending."); return; }
    if (!cleanEmail(email)) { setError("Please enter a valid email address."); return; }
    setError("");
    setSubmitting(true);

    if (isDemoMode) {
      await new Promise((r) => setTimeout(r, 800));
      setDone(true);
      setSubmitting(false);
      return;
    }

    try {
      await sb.rpc("submit_rsvp", {
        p_token:              activeToken,
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
      setDone(true);
    } catch (err) {
      const msg = (err?.message ?? "").toLowerCase();
      console.error("[RSVP] submit error:", err);
      if (msg.includes("function") || msg.includes("does not exist") || msg.includes("pgrst")) {
        setError("RSVP is not set up yet — the database migration hasn't been run. Contact the couple.");
      } else if (msg.includes("invalid rsvp token")) {
        setError("Your RSVP link has expired. Please contact the couple for a new link.");
      } else {
        setError(`Something went wrong: ${err?.message ?? "unknown error"}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="rsvp-wrap" data-theme={wedding?.theme || "minimal"}>
        <div className="rsvp-card">
          <div className="rsvp-logo">
            <span className="rsvp-logo-heart">♡</span>
            {wedding?.bride_name && wedding?.groom_name
              ? `${wedding.bride_name} & ${wedding.groom_name}`
              : "You're Invited"}
          </div>
          {wedding?.wedding_date || wedding?.venue_name ? (
            <div className="rsvp-event-info">
              {[formatDate(wedding.wedding_date), wedding.venue_name].filter(Boolean).join(" · ")}
            </div>
          ) : null}
          <div className="rsvp-eyebrow">RSVP</div>
          <div className="rsvp-divider" />

          {tokenLoading ? (
            <p style={{ textAlign: "center", color: "var(--brown)", opacity: 0.6, fontSize: 14 }}>Loading your details…</p>
          ) : done ? (
            <ConfirmationView name={cleanName(name)} attending={attending} wedding={wedding} />
          ) : (
            <form onSubmit={submit}>
              {isDemoMode && <div className="demo-badge">Demo Mode</div>}

              {/* Name — three modes:
                  1. urlToken present → read-only pre-filled from DB (same as before)
                  2. selectedToken set → read-only after guest picks from search list; × to re-search
                  3. Neither → search-and-select dropdown (no-token flow) */}
              <div className="rsvp-field">
                <label className="rsvp-label">Your Full Name</label>

                {isDemoMode ? (
                  <input
                    className="rsvp-input"
                    placeholder="As written on your invitation"
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
                      <button type="button" className="rsvp-name-clear" onClick={clearNameSelection} aria-label="Clear name selection">
                        ×
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rsvp-name-wrap">
                    <input
                      className="rsvp-input"
                      placeholder="Start typing your name…"
                      value={nameQuery}
                      onChange={(e) => { setNameQuery(e.target.value); setError(""); }}
                      autoFocus
                      autoComplete="off"
                    />
                    {showSuggestions && nameSearching && (
                      <div className="rsvp-suggestions">
                        <div className="rsvp-suggestion-empty">Searching…</div>
                      </div>
                    )}
                    {showSuggestions && !nameSearching && nameResults.length > 0 && (
                      <div className="rsvp-suggestions">
                        {nameResults.map((r) => (
                          <div
                            key={r.id}
                            className="rsvp-suggestion-item"
                            onMouseDown={(e) => { e.preventDefault(); selectGuest(r); }}
                          >
                            {r.name}
                          </div>
                        ))}
                      </div>
                    )}
                    {showSuggestions && !nameSearching && nameResults.length === 0 && (
                      <div className="rsvp-suggestions">
                        <div className="rsvp-suggestion-empty">No match found — check spelling or contact the couple</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Email — used to send confirmation + reminder emails */}
              <div className="rsvp-field">
                <label className="rsvp-label">Your Email</label>
                <input
                  className="rsvp-input"
                  type="email"
                  placeholder="So we can send your confirmation"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                />
              </div>

              {/* Attendance */}
              <div className="rsvp-field">
                <span className="rsvp-label">Will you be attending?</span>
                <div className="attend-btns">
                  <button type="button"
                    className={`attend-btn yes ${attending === true ? "active" : ""}`}
                    onClick={() => { setAttending(true); setError(""); }}>
                    ✓&nbsp; Yes, I'll be there!
                  </button>
                  <button type="button"
                    className={`attend-btn no ${attending === false ? "active" : ""}`}
                    onClick={() => { setAttending(false); setError(""); }}>
                    ✗&nbsp; Sorry, I can't make it
                  </button>
                </div>
              </div>

              {/* Relationship to the couple */}
              <div className="rsvp-field">
                <label className="rsvp-label">How do you know the couple?</label>
                <select
                  className="rsvp-input"
                  value={relationshipGroup}
                  onChange={(e) => { setRelationshipGroup(e.target.value); setFriendSubgroup(""); }}
                >
                  <option value="">Select one…</option>
                  {relationshipOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {relationshipGroup === "friends" && (
                <div className="rsvp-field">
                  <label className="rsvp-label">Which kind of friend?</label>
                  <select
                    className="rsvp-input"
                    value={friendSubgroup}
                    onChange={(e) => setFriendSubgroup(e.target.value)}
                  >
                    <option value="">Select one…</option>
                    {friendSubgroupOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="rsvp-field">
                <label className="rsvp-label">Closer to</label>
                <select
                  className="rsvp-input"
                  value={closerTo}
                  onChange={(e) => setCloserTo(e.target.value)}
                >
                  <option value="">Select one…</option>
                  <option value="bride">💐 {wedding?.bride_name || "Bride"}</option>
                  <option value="groom">🤵 {wedding?.groom_name || "Groom"}</option>
                </select>
              </div>

              {/* Meal + dietary — only if attending, animated expand */}
              <div className={`rsvp-collapse${attending === true ? ' open' : ''}`}>
                <div className="rsvp-collapse-inner">
                  <div className="rsvp-field" style={{ paddingTop: 4 }}>
                    <span className="rsvp-label">Meal Choice</span>
                    <div className="meal-opts">
                      {MEAL_OPTIONS.map((opt) => (
                        <div key={opt}
                          className={`meal-opt ${mealChoice === opt ? "active" : ""}`}
                          onClick={() => setMealChoice(opt)}>
                          <span className="meal-radio">
                            {mealChoice === opt && <span className="meal-radio-dot" />}
                          </span>
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rsvp-field">
                    <label className="rsvp-label">
                      Dietary Requirements
                      <span style={{ opacity: 0.45, fontWeight: 400, marginLeft: 4 }}>(optional)</span>
                    </label>
                    <input
                      className="rsvp-input"
                      placeholder="Any allergies or dietary needs?"
                      value={dietary}
                      onChange={(e) => setDietary(e.target.value)}
                    />
                  </div>

                  {/* Do you want to give a speech? — three-state (unset toggles off) */}
                  <div className="rsvp-field">
                    <span className="rsvp-label">Would you like to give a speech?</span>
                    <div className="attend-btns">
                      <button type="button"
                        className={`attend-btn yes ${wantsToSpeak === "yes" ? "active" : ""}`}
                        onClick={() => setWantsToSpeak(wantsToSpeak === "yes" ? "" : "yes")}>
                        🎤&nbsp; Yes, I'd love to
                      </button>
                      <button type="button"
                        className={`attend-btn no ${wantsToSpeak === "no" ? "active" : ""}`}
                        onClick={() => setWantsToSpeak(wantsToSpeak === "no" ? "" : "no")}>
                        No, thanks
                      </button>
                    </div>
                  </div>

                  {/* Additional guests — plus-x, up to 6 (#38) */}
                  <div className="rsvp-field">
                    <label className="rsvp-label">Bringing additional guests?</label>
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
                          {n === 0 ? "Just me" : `${n} more guest${n > 1 ? "s" : ""}`}
                        </option>
                      ))}
                    </select>
                    {plusOneNames.map((nm, i) => (
                      <input
                        key={i}
                        className="rsvp-input"
                        style={{ marginTop: 8 }}
                        placeholder={`Guest ${i + 1} full name`}
                        value={nm}
                        onChange={(e) =>
                          setPlusOneNames((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                        }
                      />
                    ))}
                    {plusOneNames.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, background: "rgba(212,160,80,0.14)", color: "#7a5c1e" }}>
                        ⚠️ Please inform the bride &amp; groom of this addition.
                      </div>
                    )}
                  </div>

                  {/* Note to guests — display-only notices configured by the couple */}
                  {(wedding?.parking_notice || wedding?.smoking_notice) && (
                    <div className="rsvp-field">
                      <span className="rsvp-label">Note to guests</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {wedding?.parking_notice && (
                          <div style={{ fontSize: 14, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.04)" }}>
                            <strong>🅿️ Parking:</strong> {wedding.parking_notice}
                          </div>
                        )}
                        {wedding?.smoking_notice && (
                          <div style={{ fontSize: 14, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.04)" }}>
                            <strong>🚭 Smoking:</strong> {wedding.smoking_notice}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Message */}
              <div className="rsvp-field">
                <label className="rsvp-label">
                  Message to the Couple
                  <span style={{ opacity: 0.45, fontWeight: 400, marginLeft: 4 }}>(optional)</span>
                </label>
                <textarea
                  className="rsvp-input"
                  placeholder="Write a message or well wishes…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              {error && <div className="rsvp-error">{error}</div>}

              <div className="rsvp-submit-wrap">
                <button type="submit" className="rsvp-submit" disabled={submitting}>
                  {submitting ? "Sending…" : "Confirm My RSVP"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
