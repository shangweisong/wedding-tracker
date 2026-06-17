import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { sb, isDemoMode } from "../lib/supabase.js";
import { theme } from "../shared/theme.js";
import { cleanName, cleanNotes } from "../lib/validation.js";

const MEAL_OPTIONS = ["Chicken", "Fish", "Vegetarian"];

const BLANK_GUEST = {
  rsvp_status: "pending", meal_choice: "", plus_one_name: "",
  dietary_notes: "", rsvp_message: "",
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = theme + `
  .rsvp-wrap {
    min-height: 100vh; display: flex; align-items: center;
    justify-content: center; padding: 24px;
  }
  .rsvp-card {
    background: white; border-radius: 20px; padding: 40px 36px;
    width: 100%; max-width: 500px;
    box-shadow: var(--shadow-lg); border: 1.5px solid rgba(201,168,76,0.15);
  }
  .rsvp-logo {
    font-family: 'Cormorant Garamond', serif; font-size: 28px;
    color: var(--gold-dark); text-align: center; margin-bottom: 4px;
  }
  .rsvp-eyebrow {
    font-size: 11px; color: var(--brown); opacity: 0.5;
    letter-spacing: 0.2em; text-transform: uppercase;
    text-align: center; margin-bottom: 24px;
  }
  .rsvp-divider { height: 1px; background: rgba(201,168,76,0.2); margin-bottom: 24px; }

  .rsvp-greeting {
    font-family: 'Cormorant Garamond', serif; font-size: 24px;
    color: var(--charcoal); margin-bottom: 6px;
  }
  .rsvp-sub { font-size: 13px; color: var(--brown); opacity: 0.7; margin-bottom: 24px; line-height: 1.5; }

  .rsvp-label {
    display: block; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--brown); font-weight: 500; margin-bottom: 8px;
  }
  .rsvp-field { margin-bottom: 20px; }

  /* Attendance */
  .attend-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .attend-btn {
    padding: 14px; border-radius: 10px;
    border: 1.5px solid rgba(201,168,76,0.25); background: white;
    cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 14px;
    font-weight: 500; color: var(--brown); transition: all 0.15s; text-align: center;
  }
  .attend-btn:hover { border-color: var(--gold); }
  .attend-btn.yes.active { background: var(--green-soft); border-color: var(--green); color: var(--green); }
  .attend-btn.no.active  { background: var(--red-soft);   border-color: var(--red);   color: var(--red);   }

  /* Meal */
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

  /* Toggle */
  .toggle-row { display: flex; align-items: center; gap: 10px; }
  .toggle {
    width: 40px; height: 22px; border-radius: 11px; border: none; cursor: pointer;
    background: rgba(201,168,76,0.25); position: relative; transition: background 0.2s;
    flex-shrink: 0;
  }
  .toggle.on { background: var(--gold); }
  .toggle-knob {
    position: absolute; top: 3px; left: 3px; width: 16px; height: 16px;
    border-radius: 50%; background: white; transition: left 0.2s;
  }
  .toggle.on .toggle-knob { left: 21px; }
  .toggle-label { font-size: 14px; color: var(--charcoal); }

  /* Inputs */
  .rsvp-input {
    width: 100%; padding: 11px 13px; box-sizing: border-box;
    border: 1.5px solid rgba(201,168,76,0.3); border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--charcoal);
    outline: none; background: var(--warm-white); transition: border-color 0.15s;
  }
  .rsvp-input:focus { border-color: var(--gold); background: white; }
  .rsvp-input::placeholder { color: rgba(92,74,42,0.35); }
  textarea.rsvp-input { resize: vertical; min-height: 80px; }

  /* Error */
  .rsvp-error {
    font-size: 13px; color: var(--red); margin-bottom: 16px;
    padding: 10px 13px; background: var(--red-soft);
    border-radius: 8px; border-left: 3px solid var(--red);
  }

  /* Submit */
  .rsvp-submit {
    width: 100%; padding: 14px; border-radius: 10px; border: none;
    background: var(--gold); color: white; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500;
    transition: background 0.15s; letter-spacing: 0.02em; margin-top: 4px;
  }
  .rsvp-submit:hover { background: var(--gold-dark); }
  .rsvp-submit:disabled { opacity: 0.6; cursor: default; }

  /* Confirmation */
  .rsvp-confirm { text-align: center; }
  .rsvp-confirm-icon { font-size: 48px; margin-bottom: 16px; }
  .rsvp-confirm-title {
    font-family: 'Cormorant Garamond', serif; font-size: 26px;
    color: var(--charcoal); margin-bottom: 10px;
  }
  .rsvp-confirm-msg {
    font-size: 14px; color: var(--brown); opacity: 0.8;
    line-height: 1.6; margin-bottom: 20px;
  }
  .rsvp-confirm-summary {
    background: var(--warm-white); border-radius: 10px; padding: 16px;
    font-size: 13px; color: var(--brown); text-align: left;
    display: flex; flex-direction: column; gap: 8px;
  }
  .rsvp-confirm-row { display: flex; gap: 8px; }
  .rsvp-confirm-key { font-weight: 500; color: var(--charcoal); min-width: 90px; }

  /* Search */
  .rsvp-search-form { display: flex; flex-direction: column; gap: 14px; }

  /* Loading / misc */
  .rsvp-loading { font-size: 14px; color: var(--brown); opacity: 0.6; text-align: center; }

  /* Demo badge */
  .demo-badge {
    display: inline-block; font-size: 11px; letter-spacing: 0.1em;
    text-transform: uppercase; padding: 3px 10px; border-radius: 20px;
    background: rgba(192,57,43,0.1); color: var(--red);
    border: 1px solid rgba(192,57,43,0.2); margin-bottom: 16px;
  }

  @media (max-width: 560px) {
    .rsvp-card { padding: 28px 20px; }
    .attend-btns { grid-template-columns: 1fr; }
  }
`;

// ─── SUB-VIEWS ────────────────────────────────────────────────────────────────

function NameSearchView({ onFound }) {
  const [name, setName] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const search = async (e) => {
    e.preventDefault();
    const cleaned = cleanName(name);
    if (!cleaned) return;
    setError("");

    if (isDemoMode) {
      onFound({ ...BLANK_GUEST, name: cleaned }, null);
      return;
    }

    setSearching(true);
    try {
      const matches = await sb.rpc("find_guest_by_name", { p_name: cleaned });
      if (!matches || matches.length === 0) {
        setError("We couldn't find your name on the guest list. Please check the spelling or contact the couple.");
        return;
      }
      const match = matches[0];
      const rows = await sb.rpc("get_guest_by_rsvp_token", { p_token: match.rsvp_token });
      const guest = (Array.isArray(rows) ? rows[0] : rows) ?? { ...BLANK_GUEST, name: match.name };
      onFound(guest, match.rsvp_token);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <>
      <div className="rsvp-sub">Enter your full name to find your invitation.</div>
      <form className="rsvp-search-form" onSubmit={search}>
        {error && <div className="rsvp-error">{error}</div>}
        <div className="rsvp-field">
          <label className="rsvp-label">Your Full Name</label>
          <input
            className="rsvp-input" autoFocus
            placeholder="e.g. Tan Wei Ming"
            value={name} onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button type="submit" className="rsvp-submit" disabled={!name.trim() || searching}>
          {searching ? "Searching…" : "Find My Invitation"}
        </button>
      </form>
    </>
  );
}

function RsvpFormView({ guest, rsvpToken, onDone }) {
  const alreadyRsvped = guest.rsvp_status === "confirmed" || guest.rsvp_status === "declined";

  const [form, setForm] = useState({
    attending:     guest.rsvp_status === "confirmed" ? true : guest.rsvp_status === "declined" ? false : null,
    meal_choice:   guest.meal_choice   || "",
    has_plus_one:  !!guest.plus_one_name,
    plus_one_name: guest.plus_one_name  || "",
    dietary_notes: guest.dietary_notes  || "",
    message:       guest.rsvp_message   || "",
  });
  const [error, setError]         = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.attending === null) { setError("Please select whether you'll be attending."); return; }
    setError("");
    setSubmitting(true);

    if (isDemoMode) {
      await new Promise((r) => setTimeout(r, 700));
      onDone(form);
      return;
    }

    try {
      await sb.rpc("submit_rsvp", {
        p_token:              rsvpToken,
        p_status:             form.attending ? "confirmed" : "declined",
        p_meal_choice:        form.attending ? form.meal_choice : "",
        p_plus_one_name:      form.attending && form.has_plus_one ? cleanName(form.plus_one_name) : "",
        p_dietary_notes:      cleanNotes(form.dietary_notes),
        p_relationship_group: "",
        p_message:            cleanNotes(form.message),
      });
      onDone(form);
    } catch {
      setError("Something went wrong saving your response. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <>
      {isDemoMode && <div className="demo-badge">Demo Mode</div>}
      <div className="rsvp-greeting">Hi {guest.name} 👋</div>
      <div className="rsvp-sub">
        {alreadyRsvped
          ? "You've already responded — feel free to update your details below."
          : "We'd love to know if you can join us on our special day."}
      </div>

      <form onSubmit={submit}>
        {/* Attendance */}
        <div className="rsvp-field">
          <span className="rsvp-label">Will you be attending?</span>
          <div className="attend-btns">
            <button type="button"
              className={`attend-btn yes ${form.attending === true ? "active" : ""}`}
              onClick={() => set({ attending: true })}>
              ✓&nbsp; Yes, I'll be there!
            </button>
            <button type="button"
              className={`attend-btn no ${form.attending === false ? "active" : ""}`}
              onClick={() => set({ attending: false })}>
              ✗&nbsp; Sorry, I can't make it
            </button>
          </div>
        </div>

        {form.attending === true && (
          <>
            {/* Meal choice */}
            <div className="rsvp-field">
              <span className="rsvp-label">Meal Choice</span>
              <div className="meal-opts">
                {MEAL_OPTIONS.map((opt) => (
                  <div key={opt}
                    className={`meal-opt ${form.meal_choice === opt ? "active" : ""}`}
                    onClick={() => set({ meal_choice: opt })}>
                    <span className="meal-radio">
                      {form.meal_choice === opt && <span className="meal-radio-dot" />}
                    </span>
                    {opt}
                  </div>
                ))}
              </div>
            </div>

            {/* Plus one */}
            <div className="rsvp-field">
              <label className="rsvp-label">Bringing a Plus One?</label>
              <div className="toggle-row">
                <button type="button"
                  className={`toggle ${form.has_plus_one ? "on" : ""}`}
                  onClick={() => set({ has_plus_one: !form.has_plus_one })}>
                  <span className="toggle-knob" />
                </button>
                <span className="toggle-label">{form.has_plus_one ? "Yes" : "No"}</span>
              </div>
              {form.has_plus_one && (
                <input
                  className="rsvp-input" style={{ marginTop: "10px" }}
                  placeholder="Plus one's full name"
                  value={form.plus_one_name}
                  onChange={(e) => set({ plus_one_name: e.target.value })}
                />
              )}
            </div>

            {/* Dietary */}
            <div className="rsvp-field">
              <label className="rsvp-label">Dietary Requirements</label>
              <input
                className="rsvp-input"
                placeholder="Any allergies or special dietary needs?"
                value={form.dietary_notes}
                onChange={(e) => set({ dietary_notes: e.target.value })}
              />
            </div>
          </>
        )}

        {/* Message */}
        <div className="rsvp-field">
          <label className="rsvp-label">
            Message to the Couple&nbsp;
            <span style={{ opacity: 0.45, fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            className="rsvp-input"
            placeholder="Write a message or well wishes…"
            value={form.message}
            onChange={(e) => set({ message: e.target.value })}
          />
        </div>

        {error && <div className="rsvp-error">{error}</div>}

        <button type="submit" className="rsvp-submit" disabled={submitting}>
          {submitting ? "Sending…" : "Confirm My RSVP"}
        </button>
      </form>
    </>
  );
}

function ConfirmationView({ guest, form }) {
  return (
    <div className="rsvp-confirm">
      {isDemoMode && <div className="demo-badge">Demo Mode</div>}
      <div className="rsvp-confirm-icon">{form.attending ? "🎉" : "💌"}</div>
      <div className="rsvp-confirm-title">
        {form.attending ? "See you there!" : "We'll miss you!"}
      </div>
      <div className="rsvp-confirm-msg">
        {form.attending
          ? `Thanks ${guest.name}, your RSVP is confirmed. We can't wait to celebrate with you!`
          : `Thanks ${guest.name} for letting us know. We'll miss you, but hope to see you soon.`}
      </div>
      {form.attending && (form.meal_choice || form.plus_one_name || form.dietary_notes) && (
        <div className="rsvp-confirm-summary">
          {form.meal_choice && (
            <div className="rsvp-confirm-row">
              <span className="rsvp-confirm-key">Meal</span>
              <span>{form.meal_choice}</span>
            </div>
          )}
          {form.has_plus_one && form.plus_one_name && (
            <div className="rsvp-confirm-row">
              <span className="rsvp-confirm-key">Plus one</span>
              <span>{form.plus_one_name}</span>
            </div>
          )}
          {form.dietary_notes && (
            <div className="rsvp-confirm-row">
              <span className="rsvp-confirm-key">Dietary</span>
              <span>{form.dietary_notes}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function RsvpPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [view, setView] = useState(() => {
    if (!token) return "search";
    if (isDemoMode) return "form";
    return "loading";
  });
  const [guest, setGuest] = useState(() =>
    isDemoMode && token ? { ...BLANK_GUEST, name: "Demo Guest" } : null
  );
  const [rsvpToken, setRsvpToken] = useState(token);
  const [submittedForm, setSubmittedForm] = useState(null);

  useEffect(() => {
    if (!token || isDemoMode) return;
    sb.rpc("get_guest_by_rsvp_token", { p_token: token })
      .then((rows) => {
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (row) { setGuest(row); setView("form"); }
        else setView("invalid");
      })
      .catch(() => setView("invalid"));
  }, [token]);

  const handleFound = (foundGuest, foundToken) => {
    setGuest(foundGuest);
    if (foundToken) setRsvpToken(foundToken);
    setView("form");
  };

  const handleDone = (form) => {
    setSubmittedForm(form);
    setView("done");
  };

  return (
    <>
      <style>{styles}</style>
      <div className="rsvp-wrap">
        <div className="rsvp-card">
          <div className="rsvp-logo">♡ You're Invited</div>
          <div className="rsvp-eyebrow">RSVP</div>
          <div className="rsvp-divider" />

          {view === "loading" && <div className="rsvp-loading">Loading your invitation…</div>}

          {view === "invalid" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔍</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "20px", color: "var(--charcoal)", marginBottom: "10px" }}>Invitation not found</div>
              <div style={{ fontSize: "13px", color: "var(--brown)", lineHeight: 1.6 }}>We couldn't find an invitation for this link. Please check the link in your email or contact the couple directly.</div>
            </div>
          )}

          {view === "search" && <NameSearchView onFound={handleFound} />}

          {view === "form" && guest && (
            <RsvpFormView guest={guest} rsvpToken={rsvpToken} onDone={handleDone} />
          )}

          {view === "done" && guest && submittedForm && (
            <ConfirmationView guest={guest} form={submittedForm} />
          )}
        </div>
      </div>
    </>
  );
}
