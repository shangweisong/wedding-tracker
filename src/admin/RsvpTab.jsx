import { useState } from "react";

const MEAL_OPTIONS = ["", "Halal", "Vegetarian", "Normal"];

// Includes the opt-in playful options (#42) unconditionally so helpers can see
// and set them regardless of the couple's public-form toggle.
const RELATIONSHIP_OPTIONS = [
  ["", "Not set"], ["family", "Family"], ["colleagues", "Colleagues"],
  ["friends", "Friends"], ["other", "Other"], ["complicated", "It's complicated 😅"],
];
const FRIEND_SUBGROUP_OPTIONS = [
  ["", "Not set"], ["army", "Army / NS"], ["primary_school", "Primary School"],
  ["secondary_school", "Secondary School"], ["tertiary", "JC / Poly"],
  ["university", "University"], ["other", "Other"], ["secret", "😏 It's a secret"],
];
const SPEECH_OPTIONS = [["", "Not set"], ["yes", "Yes"], ["no", "No"]];
const PARTY_OPTIONS = [
  ["", "Not set"], ["bride", "Bride"], ["groom", "Groom"],
];

const styles = `
  .rsvp-tab { display: flex; flex-direction: column; gap: 20px; }
  .rsvp-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .rsvp-stat-card { background: white; border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); }
  .rsvp-stat-big { font-family: 'Cormorant Garamond', serif; font-size: 36px; font-weight: 400; color: var(--gold); line-height: 1; }
  .rsvp-stat-big.green { color: var(--green); }
  .rsvp-stat-big.red { color: var(--red); }
  .rsvp-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--brown); opacity: 0.6; margin-top: 6px; }
  .rsvp-stat-sub { font-size: 12px; color: var(--brown); opacity: 0.7; margin-top: 4px; }
  .rsvp-meal-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .rsvp-meal-chip { background: var(--warm-white); border: 1px solid rgba(201,168,76,0.2); border-radius: 20px; padding: 2px 9px; font-size: 11px; color: var(--brown); }

  .rsvp-filters { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .rsvp-filter-tabs { display: flex; border: 1px solid rgba(201,168,76,0.25); border-radius: 8px; overflow: hidden; }
  .rsvp-filter-tab { padding: 7px 14px; border: none; background: white; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--brown); opacity: 0.7; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
  .rsvp-filter-tab + .rsvp-filter-tab { border-left: 1px solid rgba(201,168,76,0.25); }
  .rsvp-filter-tab.active { background: var(--gold); color: white; opacity: 1; }
  .rsvp-party-select { padding: 7px 12px; border: 1px solid rgba(201,168,76,0.25); border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--brown); background: white; cursor: pointer; }
  .rsvp-filter-count { margin-left: auto; font-size: 13px; color: var(--brown); opacity: 0.5; }

  .rsvp-list { display: flex; flex-direction: column; gap: 6px; }
  .rsvp-row { background: white; border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; border: 1.5px solid transparent; transition: border-color 0.15s; }
  .rsvp-row:hover { border-color: rgba(201,168,76,0.25); }
  .rsvp-row-main { display: flex; align-items: center; gap: 12px; padding: 14px 18px; }
  .rsvp-name-col { flex: 1; min-width: 0; }
  .rsvp-guest-name { font-size: 14px; font-weight: 500; color: var(--charcoal); }
  .rsvp-guest-meta { font-size: 11px; color: var(--brown); opacity: 0.6; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rsvp-status-badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0; }
  .rsvp-status-confirmed { background: #edf7f2; color: #2d6a4f; border: 1px solid rgba(45,106,79,0.3); }
  .rsvp-status-declined { background: #fdf0ee; color: #c0392b; border: 1px solid rgba(192,57,43,0.3); }
  .rsvp-status-pending { background: var(--warm-white); color: var(--gold-dark); border: 1px solid rgba(201,168,76,0.3); }
  .rsvp-meal-col { font-size: 12px; color: var(--brown); opacity: 0.75; flex-shrink: 0; min-width: 90px; }
  .rsvp-row-actions { display: flex; gap: 6px; flex-shrink: 0; }
  .rsvp-btn { padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid; transition: all 0.15s; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
  .rsvp-btn-edit { border-color: rgba(201,168,76,0.3); background: var(--warm-white); color: var(--brown); }
  .rsvp-btn-edit:hover { border-color: var(--gold); color: var(--gold-dark); }
  .rsvp-btn-link { border-color: rgba(92,74,42,0.15); background: white; color: var(--brown); opacity: 0.65; }
  .rsvp-btn-link:hover { opacity: 1; border-color: var(--gold); }
  .rsvp-btn-save { border-color: var(--green); background: var(--green); color: white; }
  .rsvp-btn-save:hover { background: #1e4d38; }
  .rsvp-btn-cancel { border-color: rgba(92,74,42,0.2); background: white; color: var(--brown); }
  .rsvp-btn-delete { border-color: rgba(192,57,43,0.25); background: white; color: #c0392b; opacity: 0.7; margin-left: 8px; }
  .rsvp-btn-delete:hover { opacity: 1; border-color: #c0392b; background: rgba(192,57,43,0.05); }

  .rsvp-edit-panel { border-top: 1px solid rgba(201,168,76,0.15); padding: 14px 18px; background: var(--warm-white); display: grid; grid-template-columns: 1fr 1fr; gap: 12px; animation: fadeIn 0.15s ease; }
  .rsvp-edit-group { display: flex; flex-direction: column; gap: 4px; }
  .rsvp-edit-group.full { grid-column: 1 / -1; }
  .rsvp-edit-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--brown); opacity: 0.6; font-weight: 600; }
  .rsvp-edit-select, .rsvp-edit-input { padding: 8px 10px; border: 1px solid rgba(201,168,76,0.3); border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--charcoal); background: white; }
  .rsvp-edit-select:focus, .rsvp-edit-input:focus { outline: none; border-color: var(--gold); }
  .rsvp-edit-footer { grid-column: 1 / -1; display: flex; gap: 8px; justify-content: flex-end; }

  .rsvp-empty { text-align: center; padding: 48px; color: var(--brown); opacity: 0.45; font-size: 14px; }

  @media (max-width: 640px) {
    .rsvp-stats-grid { grid-template-columns: repeat(2, 1fr); }
    .rsvp-meal-col { display: none; }
    .rsvp-edit-panel { grid-template-columns: 1fr; }
  }
`;

export default function RsvpTab({ guests, onUpdate, onDelete, showToast }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [partyFilter, setPartyFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingId, setSavingId] = useState(null);

  // Plus-ones (#38) are their own child guest rows. Responder stats count only
  // primaries (the invitations); headcount counts every confirmed body.
  const primaries = guests.filter((g) => !g.primary_guest_id);
  const confirmed = primaries.filter((g) => g.rsvp_status === "confirmed");
  const declined = primaries.filter((g) => g.rsvp_status === "declined");
  const pending = primaries.filter((g) => g.rsvp_status === "pending");
  const headcount = guests.filter((g) => g.rsvp_status === "confirmed").length;

  // Look-ups for labelling child rows and showing a primary's party size.
  const nameById = Object.fromEntries(guests.map((g) => [g.id, g.name]));
  const childCount = guests.reduce((acc, g) => {
    if (g.primary_guest_id) acc[g.primary_guest_id] = (acc[g.primary_guest_id] || 0) + 1;
    return acc;
  }, {});

  const mealCounts = confirmed.reduce((acc, g) => {
    const m = g.meal_choice?.trim() || "Not set";
    acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {});

  const filtered = guests
    .filter((g) => statusFilter === "all" || g.rsvp_status === statusFilter)
    .filter((g) => partyFilter === "all" || (g.party || "") === partyFilter)
    .sort((a, b) => a.name.localeCompare(b.name));

  const startEdit = (g) => {
    setEditingId(g.id);
    setEditForm({
      rsvp_status: g.rsvp_status || "pending",
      meal_choice: g.meal_choice || "",
      dietary_notes: g.dietary_notes || "",
      relationship_group: g.relationship_group || "",
      friend_subgroup: g.friend_subgroup || "",
      party: g.party || "",
      email: g.email || "",
      wants_to_speak: g.wants_to_speak || "",
    });
  };

  const saveEdit = async (g) => {
    const patch = {
      rsvp_status: editForm.rsvp_status,
      meal_choice: editForm.meal_choice,
      dietary_notes: editForm.dietary_notes,
      relationship_group: editForm.relationship_group,
      friend_subgroup: editForm.relationship_group === "friends" ? editForm.friend_subgroup : "",
      party: editForm.party,
      email: editForm.email.trim(),
      wants_to_speak: editForm.wants_to_speak,
    };
    if (editForm.rsvp_status !== (g.rsvp_status || "pending")) {
      patch.rsvp_at = new Date().toISOString();
    }
    setSavingId(g.id);
    try {
      await onUpdate(g.id, patch);
      setEditingId(null);
      showToast("RSVP updated");
    } finally {
      setSavingId(null);
    }
  };

  const copyLink = async (g) => {
    const url = `${window.location.origin}/rsvp?token=${g.rsvp_token}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("RSVP link copied");
    } catch {
      showToast("Copy failed — check browser clipboard permissions");
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="rsvp-tab">
        {/* Stats */}
        <div className="rsvp-stats-grid">
          <div className="rsvp-stat-card">
            <div className="rsvp-stat-big">{primaries.length}</div>
            <div className="rsvp-stat-label">Total Invited</div>
          </div>
          <div className="rsvp-stat-card">
            <div className="rsvp-stat-big green">{confirmed.length}</div>
            <div className="rsvp-stat-label">Confirmed</div>
            <div className="rsvp-stat-sub">Headcount: {headcount}</div>
            {Object.keys(mealCounts).length > 0 && (
              <div className="rsvp-meal-row">
                {Object.entries(mealCounts).map(([m, c]) => (
                  <span key={m} className="rsvp-meal-chip">
                    {m}: {c}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="rsvp-stat-card">
            <div className="rsvp-stat-big red">{declined.length}</div>
            <div className="rsvp-stat-label">Declined</div>
          </div>
          <div className="rsvp-stat-card">
            <div className="rsvp-stat-big">{pending.length}</div>
            <div className="rsvp-stat-label">Awaiting Reply</div>
            <div className="rsvp-stat-sub">
              {primaries.length > 0
                ? Math.round(((primaries.length - pending.length) / primaries.length) * 100)
                : 0}
              % responded
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="rsvp-filters">
          <div className="rsvp-filter-tabs">
            {[
              ["all", "All"],
              ["confirmed", "Confirmed"],
              ["declined", "Declined"],
              ["pending", "Pending"],
            ].map(([k, l]) => (
              <button
                key={k}
                className={`rsvp-filter-tab ${statusFilter === k ? "active" : ""}`}
                onClick={() => setStatusFilter(k)}
              >
                {l}
              </button>
            ))}
          </div>
          <select
            className="rsvp-party-select"
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
          >
            <option value="all">All guests</option>
            <option value="bride">Bride side</option>
            <option value="groom">Groom side</option>
          </select>
          <span className="rsvp-filter-count">
            {filtered.length} guest{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* List */}
        <div className="rsvp-list">
          {filtered.length === 0 ? (
            <div className="rsvp-empty">No guests match this filter</div>
          ) : (
            filtered.map((g) => (
              <div key={g.id} className="rsvp-row">
                <div className="rsvp-row-main">
                  <div className="rsvp-name-col">
                    <div className="rsvp-guest-name">{g.name}</div>
                    <div className="rsvp-guest-meta">
                      {g.primary_guest_id
                        ? `↳ additional guest of ${nameById[g.primary_guest_id] || "a guest"}`
                        : [
                            g.party ? `${g.party} side` : null,
                            g.relationship_group
                              ? (g.relationship_group === "friends" && g.friend_subgroup
                                  ? `friend (${g.friend_subgroup.replace(/_/g, " ")})`
                                  : g.relationship_group)
                              : null,
                            childCount[g.id] ? `+${childCount[g.id]} guest${childCount[g.id] > 1 ? "s" : ""}` : null,
                            g.wants_to_speak === "yes" ? "🎤 speech" : null,
                            g.dietary_notes?.trim() || null,
                            g.email?.trim() || null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                    </div>
                  </div>
                  <span
                    className={`rsvp-status-badge rsvp-status-${g.rsvp_status || "pending"}`}
                  >
                    {g.rsvp_status || "pending"}
                  </span>
                  <span className="rsvp-meal-col">
                    {g.meal_choice?.trim() ||
                      (g.rsvp_status === "confirmed" ? "No meal set" : "—")}
                  </span>
                  <div className="rsvp-row-actions">
                    <button
                      className="rsvp-btn rsvp-btn-link"
                      onClick={() => copyLink(g)}
                      title="Copy RSVP link"
                    >
                      🔗 Link
                    </button>
                    <button
                      className="rsvp-btn rsvp-btn-edit"
                      onClick={() =>
                        editingId === g.id ? setEditingId(null) : startEdit(g)
                      }
                    >
                      {editingId === g.id ? "Cancel" : "Edit"}
                    </button>
                    <button
                      className="rsvp-btn rsvp-btn-delete"
                      onClick={() => onDelete(g)}
                      title="Delete guest"
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>

                {editingId === g.id && (
                  <div className="rsvp-edit-panel">
                    <div className="rsvp-edit-group">
                      <label className="rsvp-edit-label">RSVP Status</label>
                      <select
                        className="rsvp-edit-select"
                        value={editForm.rsvp_status}
                        onChange={(e) =>
                          setEditForm({ ...editForm, rsvp_status: e.target.value })
                        }
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="declined">Declined</option>
                      </select>
                    </div>
                    <div className="rsvp-edit-group">
                      <label className="rsvp-edit-label">Meal Choice</label>
                      <select
                        className="rsvp-edit-select"
                        value={editForm.meal_choice}
                        onChange={(e) =>
                          setEditForm({ ...editForm, meal_choice: e.target.value })
                        }
                      >
                        {MEAL_OPTIONS.map((m) => (
                          <option key={m} value={m}>
                            {m || "Not set"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="rsvp-edit-group">
                      <label className="rsvp-edit-label">Email</label>
                      <input
                        className="rsvp-edit-input"
                        type="email"
                        value={editForm.email}
                        onChange={(e) =>
                          setEditForm({ ...editForm, email: e.target.value })
                        }
                        placeholder="guest@example.com"
                      />
                    </div>
                    <div className="rsvp-edit-group">
                      <label className="rsvp-edit-label">Dietary Notes</label>
                      <input
                        className="rsvp-edit-input"
                        value={editForm.dietary_notes}
                        onChange={(e) =>
                          setEditForm({ ...editForm, dietary_notes: e.target.value })
                        }
                        placeholder="e.g. No pork, Halal…"
                      />
                    </div>
                    <div className="rsvp-edit-group">
                      <label className="rsvp-edit-label">Side</label>
                      <select
                        className="rsvp-edit-select"
                        value={editForm.party}
                        onChange={(e) =>
                          setEditForm({ ...editForm, party: e.target.value })
                        }
                      >
                        {PARTY_OPTIONS.map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div className="rsvp-edit-group">
                      <label className="rsvp-edit-label">Relationship</label>
                      <select
                        className="rsvp-edit-select"
                        value={editForm.relationship_group}
                        onChange={(e) =>
                          setEditForm({ ...editForm, relationship_group: e.target.value, friend_subgroup: "" })
                        }
                      >
                        {RELATIONSHIP_OPTIONS.map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                    {editForm.relationship_group === "friends" && (
                      <div className="rsvp-edit-group">
                        <label className="rsvp-edit-label">Friend Type</label>
                        <select
                          className="rsvp-edit-select"
                          value={editForm.friend_subgroup}
                          onChange={(e) =>
                            setEditForm({ ...editForm, friend_subgroup: e.target.value })
                          }
                        >
                          {FRIEND_SUBGROUP_OPTIONS.map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="rsvp-edit-group">
                      <label className="rsvp-edit-label">Wants to speak?</label>
                      <select
                        className="rsvp-edit-select"
                        value={editForm.wants_to_speak}
                        onChange={(e) =>
                          setEditForm({ ...editForm, wants_to_speak: e.target.value })
                        }
                      >
                        {SPEECH_OPTIONS.map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div className="rsvp-edit-footer">
                      <button
                        className="rsvp-btn rsvp-btn-cancel"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="rsvp-btn rsvp-btn-save"
                        onClick={() => saveEdit(g)}
                        disabled={savingId === g.id}
                      >
                        {savingId === g.id ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
