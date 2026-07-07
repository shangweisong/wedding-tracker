import { useState } from "react";
import { inviteKey } from "../lib/eventTargeting.js";

const AUDIENCES = [
  ["all", "All shown"],
  ["bride", "Bride side"],
  ["groom", "Groom side"],
  ["family", "Family"],
  ["friends", "Friends"],
  ["colleagues", "Colleagues"],
  ["other", "Other"],
];

function audienceGuests(primaries, audience) {
  switch (audience) {
    case "bride":
    case "groom":
      return primaries.filter((g) => (g.party || "") === audience);
    case "family":
    case "friends":
    case "colleagues":
    case "other":
      return primaries.filter((g) => g.relationship_group === audience);
    default:
      return primaries;
  }
}

const styles = `
  .et-panel { background: white; border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
  .et-hd { display: flex; align-items: center; gap: 12px; padding: 16px 18px; cursor: pointer; user-select: none; }
  .et-hd-title { font-size: 14px; font-weight: 600; color: var(--charcoal); }
  .et-hd-sub { font-size: 12px; color: var(--brown); opacity: 0.6; }
  .et-chevron { margin-left: auto; color: var(--brown); opacity: 0.5; transition: transform 0.15s; }
  .et-chevron.open { transform: rotate(90deg); }

  .et-body { border-top: 1px solid rgba(201,168,76,0.15); padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; }
  .et-bulk { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .et-bulk-label { font-size: 12px; color: var(--brown); opacity: 0.7; }
  .et-select { padding: 7px 10px; border: 1px solid rgba(201,168,76,0.3); border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--charcoal); background: white; cursor: pointer; }
  .et-bulk-btn { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid; font-family: 'DM Sans', sans-serif; }
  .et-btn-invite { border-color: var(--gold); background: var(--warm-white); color: var(--gold-dark); }
  .et-btn-invite:hover { background: rgba(201,168,76,0.12); }
  .et-btn-remove { border-color: rgba(92,74,42,0.2); background: white; color: var(--brown); }
  .et-btn-remove:hover { border-color: var(--brown); }

  .et-grid-wrap { overflow-x: auto; }
  .et-grid { border-collapse: collapse; width: 100%; min-width: 420px; }
  .et-grid th, .et-grid td { padding: 8px 10px; text-align: center; border-bottom: 1px solid rgba(201,168,76,0.12); font-size: 13px; }
  .et-grid th.et-guest-col, .et-grid td.et-guest-col { text-align: left; position: sticky; left: 0; background: white; z-index: 1; min-width: 160px; }
  .et-grid thead th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--brown); opacity: 0.7; font-weight: 600; }
  .et-ev-head { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .et-ev-name { color: var(--charcoal); opacity: 0.85; }
  .et-check { width: 16px; height: 16px; accent-color: var(--gold); cursor: pointer; }
  .et-guest-name { color: var(--charcoal); font-weight: 500; }
  .et-guest-meta { font-size: 11px; color: var(--brown); opacity: 0.55; }
  .et-empty { font-size: 13px; color: var(--brown); opacity: 0.6; padding: 8px 2px; }
`;

export default function EventTargeting({ primaries, events, inviteSet, onSetInvited, onBulkInvite }) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState("all");
  const [bulkEvent, setBulkEvent] = useState(events[0]?.id || "");

  const shown = audienceGuests(primaries, audience);
  const invitedCount = inviteSet.size;

  const applyBulk = (invited) => {
    if (!bulkEvent || shown.length === 0) return;
    onBulkInvite(shown, bulkEvent, invited);
  };

  // Toggle an event column for every currently-shown guest.
  const toggleColumn = (eventId, invited) => onBulkInvite(shown, eventId, invited);
  const columnAllInvited = (eventId) =>
    shown.length > 0 && shown.every((g) => inviteSet.has(inviteKey(g.id, eventId)));

  return (
    <>
      <style>{styles}</style>
      <div className="et-panel">
        <div className="et-hd" onClick={() => setOpen((o) => !o)}>
          <span className="et-hd-title">Event invitations</span>
          <span className="et-hd-sub">
            {events.length} event{events.length !== 1 ? "s" : ""} · {invitedCount} invitation{invitedCount !== 1 ? "s" : ""}
          </span>
          <span className={`et-chevron${open ? " open" : ""}`}>▶</span>
        </div>

        {open && (
          <div className="et-body">
            <div className="et-bulk">
              <span className="et-bulk-label">Invite</span>
              <select className="et-select" value={audience} onChange={(e) => setAudience(e.target.value)}>
                {AUDIENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <span className="et-bulk-label">to</span>
              <select className="et-select" value={bulkEvent} onChange={(e) => setBulkEvent(e.target.value)}>
                {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name || "Untitled event"}</option>)}
              </select>
              <button className="et-bulk-btn et-btn-invite" onClick={() => applyBulk(true)}>Invite {shown.length}</button>
              <button className="et-bulk-btn et-btn-remove" onClick={() => applyBulk(false)}>Remove</button>
            </div>

            <div className="et-grid-wrap">
              {shown.length === 0 ? (
                <div className="et-empty">No guests match this selection.</div>
              ) : (
                <table className="et-grid">
                  <thead>
                    <tr>
                      <th className="et-guest-col">Guest</th>
                      {events.map((ev) => (
                        <th key={ev.id}>
                          <div className="et-ev-head">
                            <span className="et-ev-name">{ev.name || "Untitled"}</span>
                            <input
                              type="checkbox"
                              className="et-check"
                              title="Invite/remove all shown"
                              checked={columnAllInvited(ev.id)}
                              onChange={(e) => toggleColumn(ev.id, e.target.checked)}
                            />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((g) => (
                      <tr key={g.id}>
                        <td className="et-guest-col">
                          <div className="et-guest-name">{g.name}</div>
                          <div className="et-guest-meta">
                            {[g.party ? `${g.party} side` : null, g.relationship_group || null].filter(Boolean).join(" · ")}
                          </div>
                        </td>
                        {events.map((ev) => (
                          <td key={ev.id}>
                            <input
                              type="checkbox"
                              className="et-check"
                              checked={inviteSet.has(inviteKey(g.id, ev.id))}
                              onChange={(e) => onSetInvited(g, ev.id, e.target.checked)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
