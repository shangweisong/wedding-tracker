import { useState, useEffect } from "react";
import { cleanName, cleanVenueName, cleanVenueAddress } from "../lib/validation.js";
import { blankEvent } from "../lib/eventDiff.js";
import { LOCALES } from "../i18n/index.jsx";

// Locales guests can switch to on the public page (English is the source).
const TRANSLATABLE_LOCALES = Object.keys(LOCALES).filter((code) => code !== "en");

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

  /* ── Smart RSVP (per-event) ── */
  .setup-card-hd { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .setup-card-title { font-family: 'Cormorant Garamond', serif; font-size: 22px; color: var(--charcoal); }
  .setup-card-sub { font-size: 13px; color: var(--brown); opacity: 0.75; margin-top: 4px; }
  .setup-switch { position: relative; width: 46px; height: 26px; flex-shrink: 0; }
  .setup-switch input { opacity: 0; width: 0; height: 0; }
  .setup-switch-track {
    position: absolute; inset: 0; border-radius: 26px; cursor: pointer;
    background: rgba(92,74,42,0.22); transition: background 0.15s;
  }
  .setup-switch-track::before {
    content: ""; position: absolute; height: 20px; width: 20px; left: 3px; top: 3px;
    background: white; border-radius: 50%; transition: transform 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.25);
  }
  .setup-switch input:checked + .setup-switch-track { background: var(--gold); }
  .setup-switch input:checked + .setup-switch-track::before { transform: translateX(20px); }

  .smart-body { margin-top: 20px; display: flex; flex-direction: column; gap: 14px; }
  .smart-events { display: flex; flex-direction: column; gap: 12px; }
  .smart-event {
    border: 1px solid rgba(201,168,76,0.25); border-radius: 10px; padding: 14px 14px 12px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px; position: relative; background: var(--warm-white);
  }
  .smart-event.inactive { opacity: 0.6; }
  .smart-event .full { grid-column: 1 / -1; }
  .smart-event-remove {
    position: absolute; top: 8px; right: 8px; background: none; border: none; cursor: pointer;
    color: var(--brown); opacity: 0.4; font-size: 16px; line-height: 1; padding: 4px;
  }
  .smart-event-remove:hover { opacity: 0.85; color: var(--red); }
  .smart-checks { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 16px; padding-top: 2px; }
  .smart-tr { grid-column: 1 / -1; border-top: 1px dashed rgba(201,168,76,0.3); padding-top: 10px; }
  .smart-tr-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold-dark); font-weight: 600; margin-bottom: 6px; }
  .smart-check { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--brown); cursor: pointer; }
  .smart-check input { width: 15px; height: 15px; accent-color: var(--gold); cursor: pointer; }
  .smart-add {
    align-self: flex-start; background: none; border: 1.5px dashed rgba(201,168,76,0.5);
    color: var(--gold-dark); border-radius: 8px; padding: 9px 16px; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; transition: all 0.15s;
  }
  .smart-add:hover { border-color: var(--gold); background: var(--warm-white); }
  .smart-events-actions { display: flex; align-items: center; gap: 12px; justify-content: flex-end; }
  .smart-empty { font-size: 13px; color: var(--brown); opacity: 0.6; padding: 4px 0; }
  .smart-warn { font-size: 12px; color: var(--gold-dark); }

  @media (max-width: 640px) {
    .setup-form-grid { grid-template-columns: 1fr; }
    .smart-event { grid-template-columns: 1fr; }
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
  enable_smart_rsvp: false,
  primary_meal_event_id: "",
};

// Map a persisted wedding_events row into the local editable draft shape.
function toDraft(e) {
  return {
    _key: e.id || `new_${Math.random().toString(36).slice(2)}`,
    id: e.id,
    name: e.name || "",
    event_date: e.event_date || "",
    start_time: e.start_time ? String(e.start_time).slice(0, 5) : "",
    location: e.location || "",
    requires_meal: !!e.requires_meal,
    requires_headcount: e.requires_headcount !== false,
    is_active: e.is_active !== false,
    content_translations: e.content_translations && typeof e.content_translations === "object" ? e.content_translations : {},
  };
}

export default function WeddingSetupTab({ wedding, events = [], onSave, onSaveEvents, showToast }) {
  const [form, setForm] = useState(blankForm);
  const [draftEvents, setDraftEvents] = useState([]);
  const [transLocale, setTransLocale] = useState(""); // "" = editing English only

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
        enable_smart_rsvp: !!wedding.enable_smart_rsvp,
        primary_meal_event_id: wedding.primary_meal_event_id || "",
      });
    }
  }, [wedding]);

  // Re-sync the editable list whenever the persisted events change (after a save).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftEvents(Array.isArray(events) ? events.map(toDraft) : []);
  }, [events]);

  if (wedding === undefined) {
    return (
      <>
        <style>{styles}</style>
        <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Loading…</div></div>
      </>
    );
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const setEvent = (key, i) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setDraftEvents((prev) => prev.map((ev, j) => (j === i ? { ...ev, [key]: value } : ev)));
  };

  // Update one translated field (name/location) of an event for the active locale.
  const setEventTr = (i, field, value) =>
    setDraftEvents((prev) => prev.map((ev, j) => {
      if (j !== i) return ev;
      const ct = { ...(ev.content_translations || {}) };
      ct[transLocale] = { ...(ct[transLocale] || {}), [field]: value };
      return { ...ev, content_translations: ct };
    }));

  const addEvent = () =>
    setDraftEvents((prev) => [...prev, { ...blankEvent(), _key: `new_${Math.random().toString(36).slice(2)}` }]);

  const removeEvent = (i) => setDraftEvents((prev) => prev.filter((_, j) => j !== i));

  const timesOutOfOrder =
    form.ceremony_time && form.dinner_time && form.dinner_time < form.ceremony_time;

  // Persisted events that collect a meal — the only valid meal-event designations.
  const mealEventOptions = (events || []).filter((e) => e.requires_meal);
  const noMealEvent = form.enable_smart_rsvp && !form.primary_meal_event_id;

  const saveEventsOnly = async () => {
    if (!onSaveEvents) return;
    await onSaveEvents(draftEvents);
  };

  const save = async () => {
    const bride = cleanName(form.bride_name);
    const groom = cleanName(form.groom_name);
    const venueName = cleanVenueName(form.venue_name);
    if (!bride || !groom || !venueName) {
      showToast("Please fill in both names and the venue before saving");
      return;
    }
    // Flush any event edits first so the meal-event designation references saved ids.
    if (form.enable_smart_rsvp && onSaveEvents) {
      const ok = await onSaveEvents(draftEvents);
      if (ok === false) return;
    }
    onSave({
      bride_name: bride,
      groom_name: groom,
      wedding_date: form.wedding_date || null,
      venue_name: venueName,
      venue_address: cleanVenueAddress(form.venue_address),
      ceremony_time: form.ceremony_time || null,
      dinner_time: form.dinner_time || null,
      tea_ceremony_time: form.tea_ceremony_time || null,
      enable_smart_rsvp: form.enable_smart_rsvp,
      primary_meal_event_id: form.enable_smart_rsvp ? (form.primary_meal_event_id || null) : null,
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
              <label className="setup-form-label">Wedding date</label>
              <input className="setup-form-input" type="date" value={form.wedding_date} onChange={set("wedding_date")} />
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

        {/* ── SMART RSVP (per-event attendance) ── */}
        <div className="setup-card">
          <div className="setup-card-hd">
            <div>
              <div className="setup-card-title">Smart RSVP</div>
              <div className="setup-card-sub">
                Let guests RSVP to each event (tea ceremony, solemnisation, banquet…) individually.
                When off, the RSVP form asks a single yes/no as before.
              </div>
            </div>
            <label className="setup-switch">
              <input
                type="checkbox"
                checked={form.enable_smart_rsvp}
                onChange={(e) => setForm((f) => ({ ...f, enable_smart_rsvp: e.target.checked }))}
              />
              <span className="setup-switch-track" />
            </label>
          </div>

          {form.enable_smart_rsvp && (
            <div className="smart-body">
              {!wedding?.id && (
                <div className="smart-warn">Save your wedding details first, then add events below.</div>
              )}

              {draftEvents.length > 0 && (
                <div className="setup-form-group" style={{ maxWidth: 260 }}>
                  <label className="setup-form-label">Translate event names to</label>
                  <select className="setup-form-select" value={transLocale} onChange={(e) => setTransLocale(e.target.value)}>
                    <option value="">English only</option>
                    {TRANSLATABLE_LOCALES.map((code) => (
                      <option key={code} value={code}>{LOCALES[code].label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="smart-events">
                {draftEvents.length === 0 && (
                  <div className="smart-empty">No events yet — add the events guests can RSVP to.</div>
                )}
                {draftEvents.map((ev, i) => (
                  <div key={ev._key} className={`smart-event${ev.is_active ? "" : " inactive"}`}>
                    <button type="button" className="smart-event-remove" onClick={() => removeEvent(i)} aria-label="Remove event">✕</button>
                    <div className="setup-form-group full">
                      <label className="setup-form-label">Event name</label>
                      <input className="setup-form-input" value={ev.name} onChange={setEvent("name", i)} placeholder="e.g. Tea Ceremony" />
                    </div>
                    <div className="setup-form-group">
                      <label className="setup-form-label">Date <span style={{ fontWeight: 400 }}>(optional)</span></label>
                      <input className="setup-form-input" type="date" value={ev.event_date} onChange={setEvent("event_date", i)} />
                    </div>
                    <div className="setup-form-group">
                      <label className="setup-form-label">Time <span style={{ fontWeight: 400 }}>(optional)</span></label>
                      <select className="setup-form-select" value={ev.start_time} onChange={setEvent("start_time", i)}>
                        {ALL_TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div className="setup-form-group full">
                      <label className="setup-form-label">Location <span style={{ fontWeight: 400 }}>(optional)</span></label>
                      <input className="setup-form-input" value={ev.location} onChange={setEvent("location", i)} placeholder="e.g. Family home" />
                    </div>
                    <div className="smart-checks">
                      <label className="smart-check">
                        <input type="checkbox" checked={ev.requires_meal} onChange={setEvent("requires_meal", i)} />
                        Collects meal choice
                      </label>
                      <label className="smart-check">
                        <input type="checkbox" checked={ev.requires_headcount} onChange={setEvent("requires_headcount", i)} />
                        Counts toward headcount
                      </label>
                      <label className="smart-check">
                        <input type="checkbox" checked={ev.is_active} onChange={setEvent("is_active", i)} />
                        Active
                      </label>
                    </div>

                    {transLocale && (
                      <div className="smart-tr full">
                        <div className="smart-tr-label">{LOCALES[transLocale].label} translation</div>
                        <input
                          className="setup-form-input"
                          value={ev.content_translations?.[transLocale]?.name || ""}
                          onChange={(e) => setEventTr(i, "name", e.target.value)}
                          placeholder={ev.name ? `${ev.name} →` : "Event name translation"}
                        />
                        <input
                          className="setup-form-input"
                          style={{ marginTop: 8 }}
                          value={ev.content_translations?.[transLocale]?.location || ""}
                          onChange={(e) => setEventTr(i, "location", e.target.value)}
                          placeholder={ev.location ? `${ev.location} →` : "Location translation (optional)"}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button type="button" className="smart-add" onClick={addEvent}>+ Add event</button>

              <div className="setup-form-group">
                <label className="setup-form-label">Meal choice comes from</label>
                <select
                  className="setup-form-select"
                  value={form.primary_meal_event_id || ""}
                  onChange={set("primary_meal_event_id")}
                >
                  <option value="">— none —</option>
                  {mealEventOptions.map((e) => (
                    <option key={e.id} value={e.id}>{e.name || "Untitled event"}</option>
                  ))}
                </select>
                {noMealEvent && (
                  <div className="smart-warn">
                    Pick which event's meal feeds each guest's meal choice (used by seating & catering).
                    {mealEventOptions.length === 0 && " Mark an event as “Collects meal choice” and save events first."}
                  </div>
                )}
              </div>

              <div className="smart-events-actions">
                <button type="button" className="btn btn-outline" onClick={saveEventsOnly} disabled={!wedding?.id}>
                  Save events
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
