import { useState, useEffect } from "react";
import { sb, isDemoMode } from "../lib/supabase.js";
import { theme } from "../shared/theme.js";
import { cleanName, cleanNotes, cleanParty, cleanRelationshipGroup, cleanFriendSubgroup, cleanEmail } from "../lib/validation.js";

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


const styles = theme + `
  .rsvp-wrap {
    min-height: 100vh; display: flex; align-items: center;
    justify-content: center; padding: 24px;
  }
  .rsvp-card {
    background: white; border-radius: 20px; padding: 40px 36px;
    width: 100%; max-width: 480px;
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
  .attend-btn.yes.active { background: var(--green-soft); border-color: var(--green); color: var(--green); }
  .attend-btn.no.active  { background: var(--red-soft);   border-color: var(--red);   color: var(--red);   }

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
    width: 100%; padding: 14px; border-radius: 10px; border: none;
    background: var(--gold); color: white; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500;
    transition: background 0.15s; letter-spacing: 0.02em; margin-top: 4px;
  }
  .rsvp-submit:hover { background: var(--gold-dark); }
  .rsvp-submit:disabled { opacity: 0.6; cursor: default; }

  .rsvp-confirm { text-align: center; }
  .rsvp-confirm-icon { font-size: 48px; margin-bottom: 16px; }
  .rsvp-confirm-title {
    font-family: 'Cormorant Garamond', serif; font-size: 26px;
    color: var(--charcoal); margin-bottom: 10px;
  }
  .rsvp-confirm-msg { font-size: 14px; color: var(--brown); opacity: 0.8; line-height: 1.6; }
  .rsvp-event-info { font-size: 13px; color: var(--brown); opacity: 0.65; text-align: center; margin-bottom: 6px; line-height: 1.5; }

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

function ConfirmationView({ name, attending, wedding }) {
  const couple = wedding?.bride_name && wedding?.groom_name
    ? `${wedding.bride_name} & ${wedding.groom_name}`
    : "the couple";
  return (
    <div className="rsvp-confirm">
      <div className="rsvp-confirm-icon">{attending ? "🎉" : "💌"}</div>
      <div className="rsvp-confirm-title">
        {attending ? "See you there!" : "We'll miss you!"}
      </div>
      <div className="rsvp-confirm-msg">
        {attending
          ? `Thanks ${name}, your RSVP is confirmed. ${couple} can't wait to celebrate with you!`
          : `Thanks ${name} for letting us know. ${couple} will miss you, but hope to see you soon.`}
      </div>
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
  const [wedding, setWedding]         = useState(null);
  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [attending, setAttending]     = useState(null);
  const [mealChoice, setMealChoice]   = useState("");
  const [dietary, setDietary]         = useState("");
  const [relationshipGroup, setRelationshipGroup] = useState("");
  const [friendSubgroup, setFriendSubgroup]        = useState("");
  const [closerTo, setCloserTo]                    = useState("");
  const [message, setMessage]         = useState("");
  const [error, setError]             = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [done, setDone]               = useState(false);

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

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter your name."); return; }
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
      await sb.rpc("submit_rsvp_by_name", {
        p_name:               cleanName(name),
        p_status:             attending ? "confirmed" : "declined",
        p_meal_choice:        attending ? mealChoice : "",
        p_dietary_notes:      cleanNotes(dietary),
        p_message:            cleanNotes(message),
        p_relationship_group: cleanRelationshipGroup(relationshipGroup),
        p_friend_subgroup:    relationshipGroup === "friends" ? cleanFriendSubgroup(friendSubgroup) : "",
        p_party:              cleanParty(closerTo),
        p_email:              cleanEmail(email),
      });
      setDone(true);
    } catch (err) {
      const msg = (err?.message ?? "").toLowerCase();
      console.error("[RSVP] submit error:", err);
      if (msg.includes("not_found")) {
        setError("We couldn't find your name on the guest list. Please check the spelling or contact us.");
      } else if (msg.includes("ambiguous")) {
        setError("We found more than one match for that name. Please enter your full name.");
      } else if (msg.includes("function") || msg.includes("does not exist") || msg.includes("pgrst")) {
        setError("RSVP is not set up yet — the database migration hasn't been run. Contact the couple.");
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
      <div className="rsvp-wrap">
        <div className="rsvp-card">
          <div className="rsvp-logo">
            {wedding?.bride_name && wedding?.groom_name
              ? `♡ ${wedding.bride_name} & ${wedding.groom_name}`
              : "♡ You're Invited"}
          </div>
          {wedding?.wedding_date || wedding?.venue_name ? (
            <div className="rsvp-event-info">
              {[formatDate(wedding.wedding_date), wedding.venue_name].filter(Boolean).join(" · ")}
            </div>
          ) : null}
          <div className="rsvp-eyebrow">RSVP</div>
          <div className="rsvp-divider" />

          {done ? (
            <ConfirmationView name={cleanName(name)} attending={attending} wedding={wedding} />
          ) : (
            <form onSubmit={submit}>
              {isDemoMode && <div className="demo-badge">Demo Mode</div>}

              {/* Name — used for verification on submit */}
              <div className="rsvp-field">
                <label className="rsvp-label">Your Full Name</label>
                <input
                  className="rsvp-input"
                  placeholder="As written on your invitation"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(""); }}
                  autoFocus
                />
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
                  {RELATIONSHIP_OPTIONS.map((o) => (
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
                    {FRIEND_SUBGROUP_OPTIONS.map((o) => (
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

              {/* Meal + dietary — only if attending */}
              {attending === true && (
                <>
                  <div className="rsvp-field">
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
                </>
              )}

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

              <button type="submit" className="rsvp-submit" disabled={submitting}>
                {submitting ? "Sending…" : "Confirm My RSVP"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
