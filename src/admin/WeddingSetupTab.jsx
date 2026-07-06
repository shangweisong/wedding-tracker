import { useState, useEffect } from "react";
import { cleanName, cleanVenueName, cleanVenueAddress } from "../lib/validation.js";

const styles = `
  .setup-tab { display: flex; flex-direction: column; gap: 20px; }
  .setup-card { background: white; border-radius: var(--radius); padding: 28px; box-shadow: var(--shadow); }
  .setup-hint-banner {
    background: var(--warm-white); border: 1px solid rgba(201,168,76,0.25); border-radius: 10px;
    padding: 12px 16px; font-size: 13px; color: var(--brown); margin-bottom: 20px;
  }
  .setup-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .setup-form-group { display: flex; flex-direction: column; gap: 6px; }
  .setup-form-group.full { grid-column: 1 / -1; }
  .setup-form-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--brown); font-weight: 500; }
  .setup-form-input, .setup-form-textarea, .setup-form-select {
    padding: 10px 12px; border: 1.5px solid rgba(201,168,76,0.3); border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--charcoal);
    outline: none; background: var(--warm-white); transition: border-color 0.15s;
  }
  .setup-form-select { cursor: pointer; appearance: auto; }
  .setup-form-input:focus, .setup-form-textarea:focus, .setup-form-select:focus { border-color: var(--gold); background: white; }
  .setup-form-textarea { resize: vertical; min-height: 64px; }
  .setup-warn { grid-column: 1 / -1; font-size: 12px; color: var(--gold-dark); }
  .setup-actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; margin-top: 4px; }

  @media (max-width: 640px) {
    .setup-form-grid { grid-template-columns: 1fr; }
  }
`;

// Generates time options every 15 minutes in 12h format (stored as HH:MM 24h).
function makeTimeOpts(startH, endH) {
  const opts = [{ label: "— not set —", value: "" }];
  for (let h = startH; h <= endH; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === endH && m > 0) break;
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const period = h < 12 ? "AM" : "PM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      opts.push({ label: `${h12}:${mm} ${period}`, value: `${hh}:${mm}` });
    }
  }
  return opts;
}

// Solemnisation + tea ceremony: no constraint
const ALL_TIME_OPTIONS = makeTimeOpts(0, 23);
// Meal groups
const LUNCH_TIME_OPTIONS = makeTimeOpts(12, 16);
const DINNER_TIME_OPTIONS = makeTimeOpts(16, 22);

const blankForm = {
  bride_name: "",
  groom_name: "",
  wedding_date: "",
  venue_name: "",
  venue_address: "",
  ceremony_time: "",
  dinner_time: "",
  tea_ceremony_time: "",
};

export default function WeddingSetupTab({ wedding, onSave, showToast }) {
  const [form, setForm] = useState(blankForm);

  useEffect(() => {
    if (wedding) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        bride_name: wedding.bride_name || "",
        groom_name: wedding.groom_name || "",
        wedding_date: wedding.wedding_date || "",
        venue_name: wedding.venue_name || "",
        venue_address: wedding.venue_address || "",
        ceremony_time: wedding.ceremony_time || "",
        dinner_time: wedding.dinner_time || "",
        tea_ceremony_time: wedding.tea_ceremony_time || "",
      });
    }
  }, [wedding]);

  if (wedding === undefined) {
    return (
      <>
        <style>{styles}</style>
        <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Loading…</div></div>
      </>
    );
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const timesOutOfOrder =
    form.ceremony_time && form.dinner_time && form.dinner_time < form.ceremony_time;

  const save = () => {
    const bride = cleanName(form.bride_name);
    const groom = cleanName(form.groom_name);
    const venueName = cleanVenueName(form.venue_name);
    if (!bride || !groom || !venueName) {
      showToast("Please fill in both names and the venue before saving");
      return;
    }
    if (!form.wedding_date) {
      showToast("Please add a wedding date — it's needed for the confirmation email and calendar invite");
      return;
    }
    onSave({
      bride_name: bride,
      groom_name: groom,
      wedding_date: form.wedding_date || null,
      venue_name: venueName,
      venue_address: cleanVenueAddress(form.venue_address),
      ceremony_time: form.ceremony_time || null,
      dinner_time: form.dinner_time || null,
    });
  };

  return (
    <>
      <style>{styles}</style>
      <div className="setup-tab">
        <div className="setup-card">
          {wedding === null && (
            <div className="setup-hint-banner">
              👋 Fill in your wedding details below — they're used for the RSVP
              confirmation email, calendar invite, and reminders.
            </div>
          )}
          <div className="setup-form-grid">
            <div className="setup-form-group">
              <label className="setup-form-label">Bride's name</label>
              <input className="setup-form-input" value={form.bride_name} onChange={set("bride_name")} placeholder="e.g. Siew Yong" />
            </div>
            <div className="setup-form-group">
              <label className="setup-form-label">Groom's name</label>
              <input className="setup-form-input" value={form.groom_name} onChange={set("groom_name")} placeholder="e.g. Wei Ming" />
            </div>

            <div className="setup-form-group">
              <label className="setup-form-label">Wedding date <span style={{ color: "#c0392b", fontWeight: 400 }}>*</span></label>
              <input className="setup-form-input" type="date" value={form.wedding_date} onChange={set("wedding_date")} required />
              {!form.wedding_date && <div style={{ fontSize: 11, color: "rgba(92,74,42,0.55)", marginTop: 4 }}>Required for confirmation email, calendar invite &amp; countdown</div>}
            </div>
            <div className="setup-form-group" />

            <div className="setup-form-group full">
              <label className="setup-form-label">Venue name</label>
              <input className="setup-form-input" value={form.venue_name} onChange={set("venue_name")} placeholder="e.g. The Grand Ballroom" />
            </div>
            <div className="setup-form-group full">
              <label className="setup-form-label">Venue address</label>
              <textarea className="setup-form-textarea" value={form.venue_address} onChange={set("venue_address")} placeholder="e.g. 123 Wedding Ave, Singapore" />
            </div>

            <div className="setup-form-group">
              <label className="setup-form-label">Solemnisation time</label>
              <select className="setup-form-select" value={form.ceremony_time} onChange={set("ceremony_time")}>
                {ALL_TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="setup-form-group">
              <label className="setup-form-label">Tea ceremony time <span style={{ color: "var(--brown)", fontWeight: 400 }}>(optional)</span></label>
              <select className="setup-form-select" value={form.tea_ceremony_time} onChange={set("tea_ceremony_time")}>
                {ALL_TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="setup-form-group">
              <label className="setup-form-label">Meal time</label>
              <select className="setup-form-select" value={form.dinner_time} onChange={set("dinner_time")}>
                <option value="">— not set —</option>
                <optgroup label="Lunch (12 PM – 4 PM)">
                  {LUNCH_TIME_OPTIONS.slice(1).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
                <optgroup label="Evening Reception (4 PM – 10 PM)">
                  {DINNER_TIME_OPTIONS.slice(1).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              </select>
            </div>

            {timesOutOfOrder && (
              <div className="setup-warn">⚠️ Meal time is before ceremony time — double check this is correct.</div>
            )}

            <div className="setup-actions">
              <button className="btn btn-gold" onClick={save}>Save wedding details</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
