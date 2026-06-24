import { useState, useEffect } from "react";
import { sb, supabase, isDemoMode } from "../lib/supabase.js";
import { csvCell } from "../lib/csv.js";

const DEMO_TABLES = [
  { id: "t1", table_number: "1", label: "Family", capacity: 10, is_locked: false },
  { id: "t2", table_number: "2", label: "University Friends", capacity: 8, is_locked: false },
  { id: "t3", table_number: "VIP", label: "VIP Table", capacity: 6, is_locked: true },
];

const BLANK_FORM = { table_number: "", label: "", capacity: 10 };

const styles = `
  .seat-tab { display: flex; flex-direction: column; gap: 20px; }
  .seat-toolbar { display: flex; gap: 8px; flex-wrap: wrap; }

  .seat-section-title { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--brown); opacity: 0.7; margin-bottom: 10px; }
  .seat-unassigned-list { display: flex; flex-direction: column; gap: 6px; }
  .seat-unassigned-row { background: white; border-radius: 8px; padding: 12px 16px; box-shadow: var(--shadow); display: flex; align-items: center; gap: 12px; border-left: 3px solid var(--gold); }
  .seat-ua-name { flex: 1; font-size: 14px; font-weight: 500; color: var(--charcoal); }
  .seat-meal-tag { font-size: 11px; background: var(--warm-white); border: 1px solid rgba(201,168,76,0.2); border-radius: 20px; padding: 2px 8px; color: var(--brown); flex-shrink: 0; }
  .seat-assign-select { padding: 6px 10px; border: 1px solid rgba(201,168,76,0.3); border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--charcoal); background: white; cursor: pointer; flex-shrink: 0; }
  .seat-assign-select:focus { outline: none; border-color: var(--gold); }

  .seat-tables-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .seat-table-card { background: white; border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; border: 1.5px solid transparent; transition: border-color 0.15s; }
  .seat-table-card:hover { border-color: rgba(201,168,76,0.25); }
  .seat-table-card.locked { border-color: rgba(192,57,43,0.15); }
  .seat-card-header { padding: 16px 16px 10px; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .seat-table-name { font-size: 15px; font-weight: 600; color: var(--charcoal); }
  .seat-table-label { font-size: 12px; color: var(--brown); opacity: 0.6; margin-top: 2px; }
  .seat-card-actions { display: flex; gap: 2px; flex-shrink: 0; }
  .seat-icon-btn { width: 30px; height: 30px; border: none; background: transparent; cursor: pointer; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 14px; opacity: 0.6; transition: all 0.15s; }
  .seat-icon-btn:hover { background: var(--warm-white); opacity: 1; }

  .seat-capacity-bar { height: 4px; background: rgba(201,168,76,0.15); margin: 0 16px; border-radius: 2px; overflow: hidden; }
  .seat-capacity-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
  .seat-capacity-label { font-size: 11px; color: var(--brown); opacity: 0.5; text-align: right; padding: 4px 16px 0; }

  .seat-guest-list { padding: 8px 0 12px; }
  .seat-guest-row { display: flex; align-items: center; gap: 8px; padding: 5px 16px; }
  .seat-guest-name { flex: 1; font-size: 13px; color: var(--charcoal); }
  .seat-meal-mini { font-size: 11px; color: var(--brown); opacity: 0.55; }
  .seat-remove-btn { width: 20px; height: 20px; border: none; background: transparent; cursor: pointer; color: var(--brown); opacity: 0.3; font-size: 16px; line-height: 1; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; padding: 0; }
  .seat-remove-btn:hover { background: var(--red-soft); color: var(--red); opacity: 1; }
  .seat-empty-table { padding: 10px 16px; font-size: 13px; color: var(--brown); opacity: 0.4; font-style: italic; }

  @media (max-width: 600px) {
    .seat-tables-grid { grid-template-columns: 1fr; }
    .seat-unassigned-row { flex-wrap: wrap; }
    .seat-assign-select { width: 100%; }
  }
  @media print {
    .seat-toolbar, .seat-toolbar *, .view-tabs, .toolbar, .header, .setup-panel, .seat-card-actions { display: none !important; }
    .seat-tables-grid { grid-template-columns: repeat(3, 1fr); }
  }
`;

export default function SeatingTab({ guests, onUpdate, showToast }) {
  const [tables, setTables] = useState(() => (isDemoMode ? DEMO_TABLES : []));
  const [loading, setLoading] = useState(!isDemoMode);
  const [modal, setModal] = useState(null);
  const [editTable, setEditTable] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isDemoMode) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("tables")
          .select("*")
          .order("created_at", { ascending: true });
        if (error) throw error;
        setTables(data);
      } catch {
        showToast("Could not load tables — check connection");
      } finally {
        setLoading(false);
      }
    })();
  }, [showToast]);

  const assignedAt = (tableId) => guests.filter((g) => g.table_id === tableId);
  const unassigned = guests.filter(
    (g) => g.rsvp_status === "confirmed" && !g.table_id
  );

  const openAdd = () => {
    setEditTable(null);
    setForm(BLANK_FORM);
    setModal("add");
  };

  const openEdit = (t) => {
    setEditTable(t);
    setForm({ table_number: t.table_number, label: t.label, capacity: t.capacity });
    setModal("edit");
  };

  const saveTable = async () => {
    if (!form.table_number.trim()) {
      showToast("Table number is required");
      return;
    }
    setSaving(true);
    try {
      if (isDemoMode) {
        if (editTable) {
          setTables((prev) =>
            prev.map((x) => (x.id === editTable.id ? { ...x, ...form } : x))
          );
          showToast("Table updated");
        } else {
          setTables((prev) => [
            ...prev,
            { ...form, id: `demo-${Date.now()}`, is_locked: false },
          ]);
          showToast("Table added");
        }
        setModal(null);
        return;
      }
      if (editTable) {
        const rows = await sb.update("tables", editTable.id, form);
        setTables((prev) =>
          prev.map((x) => (x.id === editTable.id ? rows[0] : x))
        );
        showToast("Table updated");
      } else {
        const rows = await sb.insert("tables", { ...form, is_locked: false });
        setTables((prev) => [...prev, rows[0]]);
        showToast("Table added");
      }
      setModal(null);
    } catch (err) {
      showToast("Could not save — " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTable = async (t) => {
    if (assignedAt(t.id).length > 0) {
      showToast("Remove all guests from this table first");
      return;
    }
    if (isDemoMode) {
      setTables((prev) => prev.filter((x) => x.id !== t.id));
      showToast("Table removed");
      return;
    }
    try {
      await sb.delete("tables", t.id);
      setTables((prev) => prev.filter((x) => x.id !== t.id));
      showToast("Table removed");
    } catch {
      showToast("Could not delete table");
    }
  };

  const toggleLock = async (t) => {
    const patch = { is_locked: !t.is_locked };
    if (isDemoMode) {
      setTables((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
      return;
    }
    try {
      await sb.update("tables", t.id, patch);
      setTables((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
    } catch {
      showToast("Could not update table");
    }
  };

  const assignGuest = async (guestId, tableId) => {
    const t = tables.find((x) => x.id === tableId);
    if (!t) return;
    if (t.is_locked) { showToast("This table is locked"); return; }
    if (assignedAt(tableId).length >= t.capacity) {
      showToast(`Table ${t.table_number} is at full capacity`);
      return;
    }
    await onUpdate(guestId, { table_id: tableId, table_number: t.table_number });
  };

  const unassignGuest = async (guestId) => {
    await onUpdate(guestId, { table_id: null, table_number: "" });
  };

  const exportCSV = () => {
    const rows = tables.flatMap((t) =>
      assignedAt(t.id).map((g) => ({
        table_number: t.table_number,
        table_label: t.label,
        guest_name: g.name,
        meal_choice: g.meal_choice || "",
        plus_one: g.plus_one_name || "",
        party: g.party || "",
      }))
    );
    if (rows.length === 0) {
      showToast("No seating assignments to export");
      return;
    }
    const headers = ["table_number", "table_label", "guest_name", "meal_choice", "plus_one", "party"];
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seating-plan.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="seat-tab">
        {/* Toolbar */}
        <div className="seat-toolbar">
          <button className="btn btn-gold" onClick={openAdd}>
            + Add Table
          </button>
          <button className="btn btn-outline" onClick={exportCSV}>
            ⬇ Export CSV
          </button>
          <button className="btn btn-outline" onClick={() => window.print()}>
            🖨 Print
          </button>
        </div>

        {/* Unassigned pool */}
        {unassigned.length > 0 && (
          <div>
            <div className="seat-section-title">
              Unassigned Confirmed Guests ({unassigned.length})
            </div>
            <div className="seat-unassigned-list">
              {unassigned.map((g) => (
                <div key={g.id} className="seat-unassigned-row">
                  <span className="seat-ua-name">{g.name}</span>
                  {g.meal_choice?.trim() && (
                    <span className="seat-meal-tag">{g.meal_choice}</span>
                  )}
                  <select
                    className="seat-assign-select"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) assignGuest(g.id, e.target.value);
                    }}
                  >
                    <option value="">Assign to table…</option>
                    {tables
                      .filter((t) => !t.is_locked)
                      .map((t) => {
                        const count = assignedAt(t.id).length;
                        const full = count >= t.capacity;
                        return (
                          <option key={t.id} value={t.id} disabled={full}>
                            Table {t.table_number}
                            {t.label ? ` — ${t.label}` : ""} ({count}/{t.capacity}
                            {full ? ", full" : ""})
                          </option>
                        );
                      })}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Table cards */}
        {loading ? (
          <div className="empty">
            <div className="empty-icon">⏳</div>
            <div className="empty-text">Loading tables…</div>
          </div>
        ) : tables.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🪑</div>
            <div className="empty-text">No tables yet</div>
            <div className="empty-sub">
              Create tables above to start planning your seating
            </div>
          </div>
        ) : (
          <div className="seat-tables-grid">
            {tables.map((t) => {
              const seated = assignedAt(t.id);
              const pct = t.capacity > 0 ? (seated.length / t.capacity) * 100 : 0;
              const fillColor = pct >= 100 ? "var(--red)" : "var(--green)";
              return (
                <div
                  key={t.id}
                  className={`seat-table-card ${t.is_locked ? "locked" : ""}`}
                >
                  <div className="seat-card-header">
                    <div>
                      <div className="seat-table-name">
                        Table {t.table_number}
                        {t.is_locked && (
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--red)",
                              marginLeft: 6,
                              fontWeight: 400,
                            }}
                          >
                            locked
                          </span>
                        )}
                      </div>
                      {t.label && (
                        <div className="seat-table-label">{t.label}</div>
                      )}
                    </div>
                    <div className="seat-card-actions">
                      <button
                        className="seat-icon-btn"
                        onClick={() => toggleLock(t)}
                        title={t.is_locked ? "Unlock table" : "Lock table"}
                      >
                        {t.is_locked ? "🔒" : "🔓"}
                      </button>
                      <button
                        className="seat-icon-btn"
                        onClick={() => openEdit(t)}
                        title="Edit table"
                      >
                        ✏️
                      </button>
                      <button
                        className="seat-icon-btn"
                        onClick={() => deleteTable(t)}
                        title="Delete table"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  <div className="seat-capacity-bar">
                    <div
                      className="seat-capacity-fill"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        background: fillColor,
                      }}
                    />
                  </div>
                  <div className="seat-capacity-label">
                    {seated.length} / {t.capacity} seats
                  </div>
                  <div className="seat-guest-list">
                    {seated.length === 0 ? (
                      <div className="seat-empty-table">No guests assigned</div>
                    ) : (
                      seated.map((g) => (
                        <div key={g.id} className="seat-guest-row">
                          <span className="seat-guest-name">{g.name}</span>
                          {g.meal_choice?.trim() && (
                            <span className="seat-meal-mini">{g.meal_choice}</span>
                          )}
                          {!t.is_locked && (
                            <button
                              className="seat-remove-btn"
                              onClick={() => unassignGuest(g.id)}
                              title="Remove from table"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit table modal */}
      {(modal === "add" || modal === "edit") && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              {modal === "edit" ? "Edit Table" : "Add Table"}
            </div>
            <div className="form-grid">
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Table Number *</label>
                  <input
                    className="form-input"
                    placeholder="e.g. 1 or VIP"
                    value={form.table_number}
                    onChange={(e) =>
                      setForm({ ...form, table_number: e.target.value })
                    }
                    autoFocus
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Capacity</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max="50"
                    value={form.capacity}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        capacity: Math.max(1, parseInt(e.target.value) || 10),
                      })
                    }
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Label (optional)</label>
                <input
                  className="form-input"
                  placeholder="e.g. Family, Bride's Side…"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="btn btn-gold"
                onClick={saveTable}
                disabled={saving}
              >
                {saving ? "Saving…" : modal === "edit" ? "Save Changes" : "Add Table"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
