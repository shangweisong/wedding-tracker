import { useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sb, supabase, isDemoMode } from "../lib/supabase.js";
import { csvCell } from "../lib/csv.js";
import { suggestSeating } from "./seatingSuggestion.js";

const DEMO_TABLES = [
  { id: "t1", table_number: "1", label: "Family", capacity: 10, is_locked: false },
  { id: "t2", table_number: "2", label: "University Friends", capacity: 8, is_locked: false },
  { id: "t3", table_number: "VIP", label: "VIP Table", capacity: 6, is_locked: true },
];

const BLANK_FORM = { table_number: "", label: "", capacity: 10 };

// closestCenter alone picks whichever droppable's *center* is nearest the
// dragged item, regardless of whether the pointer is actually over it. The
// unassigned pool is one large single-column droppable sitting right above
// the table grid, so its center can beat a table card you're visibly
// hovering over (especially the leftmost column). Prefer whatever droppable
// the pointer is actually within, and only fall back to closestCenter if
// the pointer has overshot every droppable.
function collisionDetection(args) {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
}

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

  .seat-drag-handle { cursor: grab; color: var(--brown); opacity: 0.35; font-size: 14px; flex-shrink: 0; touch-action: none; }
  .seat-drag-handle:hover { opacity: 0.7; }
  .seat-unassigned-list.drop-over { background: rgba(201,168,76,0.08); border-radius: 8px; outline: 2px dashed rgba(201,168,76,0.4); outline-offset: 4px; }
  .seat-table-card.drop-over { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(201,168,76,0.2); }
  .seat-drag-overlay { background: white; box-shadow: var(--shadow); border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 500; color: var(--charcoal); border-left: 3px solid var(--gold); }

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

function UnassignedGuestRow({ guest, tables, assignedAt, onAssign }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `guest-${guest.id}`,
    data: { guestId: guest.id },
  });
  return (
    <div
      ref={setNodeRef}
      className="seat-unassigned-row"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <span className="seat-drag-handle" {...attributes} {...listeners} title="Drag to a table">
        ⠿
      </span>
      <span className="seat-ua-name">{guest.name}</span>
      {guest.meal_choice?.trim() && (
        <span className="seat-meal-tag">{guest.meal_choice}</span>
      )}
      <select
        className="seat-assign-select"
        value=""
        onChange={(e) => {
          if (e.target.value) onAssign(guest.id, e.target.value);
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
  );
}

function UnassignedDropZone({ children }) {
  const { setNodeRef, isOver } = useDroppable({ id: "unassigned" });
  return (
    <div ref={setNodeRef} className={`seat-unassigned-list ${isOver ? "drop-over" : ""}`}>
      {children}
    </div>
  );
}

function SeatedGuestRow({ guest, locked, onRemove }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `guest-${guest.id}`,
    data: { guestId: guest.id },
  });
  return (
    <div ref={setNodeRef} className="seat-guest-row" style={{ opacity: isDragging ? 0.4 : 1 }}>
      {!locked && (
        <span className="seat-drag-handle" {...attributes} {...listeners} title="Drag to move">
          ⠿
        </span>
      )}
      <span className="seat-guest-name">{guest.name}</span>
      {guest.meal_choice?.trim() && <span className="seat-meal-mini">{guest.meal_choice}</span>}
      {!locked && (
        <button
          className="seat-remove-btn"
          onClick={() => onRemove(guest.id)}
          title="Remove from table"
        >
          ×
        </button>
      )}
    </div>
  );
}

function TableCard({ table, seated, onToggleLock, onEdit, onDelete, onRemoveGuest }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `table-${table.id}`,
    disabled: table.is_locked,
  });
  const pct = table.capacity > 0 ? (seated.length / table.capacity) * 100 : 0;
  const fillColor = pct >= 100 ? "var(--red)" : "var(--green)";
  return (
    <div
      ref={setNodeRef}
      className={`seat-table-card ${table.is_locked ? "locked" : ""} ${
        isOver && !table.is_locked ? "drop-over" : ""
      }`}
    >
      <div className="seat-card-header">
        <div>
          <div className="seat-table-name">
            Table {table.table_number}
            {table.is_locked && (
              <span style={{ fontSize: 11, color: "var(--red)", marginLeft: 6, fontWeight: 400 }}>
                locked
              </span>
            )}
          </div>
          {table.label && <div className="seat-table-label">{table.label}</div>}
        </div>
        <div className="seat-card-actions">
          <button
            className="seat-icon-btn"
            onClick={() => onToggleLock(table)}
            title={table.is_locked ? "Unlock table" : "Lock table"}
          >
            {table.is_locked ? "🔒" : "🔓"}
          </button>
          <button className="seat-icon-btn" onClick={() => onEdit(table)} title="Edit table">
            ✏️
          </button>
          <button className="seat-icon-btn" onClick={() => onDelete(table)} title="Delete table">
            🗑
          </button>
        </div>
      </div>
      <div className="seat-capacity-bar">
        <div
          className="seat-capacity-fill"
          style={{ width: `${Math.min(pct, 100)}%`, background: fillColor }}
        />
      </div>
      <div className="seat-capacity-label">
        {seated.length} / {table.capacity} seats
      </div>
      <div className="seat-guest-list">
        {seated.length === 0 ? (
          <div className="seat-empty-table">No guests assigned</div>
        ) : (
          seated.map((g) => (
            <SeatedGuestRow
              key={g.id}
              guest={g}
              locked={table.is_locked}
              onRemove={onRemoveGuest}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function SeatingTab({ guests, onUpdate, onResetSeating, showToast }) {
  const [tables, setTables] = useState(() => (isDemoMode ? DEMO_TABLES : []));
  const [loading, setLoading] = useState(!isDemoMode);
  const [modal, setModal] = useState(null);
  const [editTable, setEditTable] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [activeGuestId, setActiveGuestId] = useState(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkCapacity, setBulkCapacity] = useState(10);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

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

  const assignedAt = (tableId) => guests.filter((g) => g.table_id === tableId && g.rsvp_status === "confirmed");
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

  // Returns `count` table numbers not already in use, filling gaps then continuing upward.
  const nextTableNumbers = (count) => {
    const taken = new Set(
      tables.map((t) => parseInt(t.table_number)).filter((n) => !isNaN(n))
    );
    const result = [];
    let n = 1;
    while (result.length < count) {
      if (!taken.has(n)) result.push(String(n));
      n++;
    }
    return result;
  };

  const bulkAddTables = async () => {
    const count = Math.max(1, Math.min(50, bulkCount));
    const numbers = nextTableNumbers(count);
    const rows = numbers.map((table_number) => ({
      table_number,
      label: "",
      capacity: bulkCapacity,
      is_locked: false,
    }));
    setModal(null);
    setSaving(true);
    try {
      if (isDemoMode) {
        setTables((prev) => [
          ...prev,
          ...rows.map((r, i) => ({ ...r, id: `demo-bulk-${Date.now()}-${i}` })),
        ]);
        showToast(`${count} tables added`);
        setSaving(false);
        return;
      }
      const inserted = [];
      for (const row of rows) {
        const res = await sb.insert("tables", row);
        if (Array.isArray(res)) inserted.push(res[0]);
      }
      setTables((prev) => [...prev, ...inserted]);
      showToast(`${inserted.length} tables added`);
    } catch (err) {
      showToast("Could not add tables — " + err.message);
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
      showToast(`Table ${t.table_number} removed`, () => setTables((prev) => [...prev, t].sort((a, b) => Number(a.table_number) - Number(b.table_number))));
      return;
    }
    try {
      await sb.delete("tables", t.id);
      setTables((prev) => prev.filter((x) => x.id !== t.id));
      showToast(`Table ${t.table_number} removed`, async () => {
        try {
          const [inserted] = await sb.insert("tables", { table_number: t.table_number, capacity: t.capacity, is_locked: false });
          setTables((prev) => [...prev, inserted].sort((a, b) => Number(a.table_number) - Number(b.table_number)));
        } catch {
          showToast("Could not undo — please re-add the table manually");
        }
      });
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

  const handleDragStart = (event) => {
    setActiveGuestId(event.active.data.current?.guestId ?? null);
  };

  const handleDragEnd = (event) => {
    setActiveGuestId(null);
    const { active, over } = event;
    if (!over) return;
    const guestId = active.data.current?.guestId;
    if (!guestId) return;
    const guest = guests.find((g) => g.id === guestId);
    if (over.id === "unassigned") {
      if (guest?.table_id) unassignGuest(guestId);
      return;
    }
    if (typeof over.id === "string" && over.id.startsWith("table-")) {
      const tableId = over.id.slice("table-".length);
      if (guest?.table_id === tableId) return;
      assignGuest(guestId, tableId);
    }
  };

  const generateSuggestion = async () => {
    const { assignments, unplacedGuestIds } = suggestSeating(guests, tables);
    if (assignments.length === 0) {
      showToast(
        unplacedGuestIds.length
          ? "Not enough table capacity for the unassigned guests"
          : "No unassigned confirmed guests to seat"
      );
      return;
    }
    await Promise.all(
      assignments.map((a) => {
        const t = tables.find((x) => x.id === a.tableId);
        return onUpdate(a.guestId, {
          table_id: a.tableId,
          table_number: t?.table_number || "",
        });
      })
    );
    showToast(
      unplacedGuestIds.length
        ? `Seated ${assignments.length} guests — ${unplacedGuestIds.length} left unassigned (no capacity left)`
        : `Seated ${assignments.length} guests — review and adjust as needed`
    );
  };

  const exportCSV = () => {
    const rows = tables.flatMap((t) =>
      assignedAt(t.id).map((g) => ({
        table_number: t.table_number,
        table_label: t.label,
        guest_name: g.name,
        meal_choice: g.meal_choice || "",
        party: g.party || "",
      }))
    );
    if (rows.length === 0) {
      showToast("No seating assignments to export");
      return;
    }
    const headers = ["table_number", "table_label", "guest_name", "meal_choice", "party"];
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

  const activeGuest = activeGuestId ? guests.find((g) => g.id === activeGuestId) : null;

  return (
    <>
      <style>{styles}</style>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="seat-tab">
          {/* Toolbar */}
          <div className="seat-toolbar">
            <button className="btn btn-gold" onClick={openAdd}>
              + Add Table
            </button>
            <button className="btn btn-outline" onClick={() => setModal("bulk-add")}>
              + Add Multiple
            </button>
            <button className="btn btn-outline" onClick={generateSuggestion}>
              ✨ Generate Draft Seating
            </button>
            <button className="btn btn-outline" onClick={exportCSV}>
              ⬇ Export CSV
            </button>
            <button className="btn btn-outline" onClick={() => window.print()}>
              🖨 Print
            </button>
            <button
              className="btn btn-outline"
              style={{ color: "#c0392b", borderColor: "rgba(192,57,43,0.3)", marginLeft: "auto" }}
              onClick={() => setResetConfirm(true)}
            >
              ↺ Reset Seating
            </button>
          </div>

          {/* Unassigned pool */}
          {!loading && unassigned.length > 0 && (
            <div>
              <div className="seat-section-title">
                Unassigned Confirmed Guests ({unassigned.length})
              </div>
              <UnassignedDropZone>
                {unassigned.map((g) => (
                  <UnassignedGuestRow
                    key={g.id}
                    guest={g}
                    tables={tables}
                    assignedAt={assignedAt}
                    onAssign={assignGuest}
                  />
                ))}
              </UnassignedDropZone>
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
              {tables.map((t) => (
                <TableCard
                  key={t.id}
                  table={t}
                  seated={assignedAt(t.id)}
                  onToggleLock={toggleLock}
                  onEdit={openEdit}
                  onDelete={deleteTable}
                  onRemoveGuest={unassignGuest}
                />
              ))}
            </div>
          )}
        </div>

        <DragOverlay>
          {activeGuest ? <div className="seat-drag-overlay">{activeGuest.name}</div> : null}
        </DragOverlay>
      </DndContext>

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

      {/* BULK ADD TABLES */}
      {modal === "bulk-add" && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Add Multiple Tables</div>
            <div className="form-grid">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Number of tables</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max="50"
                    value={bulkCount}
                    autoFocus
                    onChange={(e) => setBulkCount(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Capacity each</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max="50"
                    value={bulkCapacity}
                    onChange={(e) => setBulkCapacity(Math.max(1, parseInt(e.target.value) || 10))}
                  />
                </div>
              </div>
              <p style={{ fontSize: 12, color: "var(--brown)", opacity: 0.65, margin: 0 }}>
                Will create tables numbered{" "}
                <strong>{nextTableNumbers(Math.max(1, Math.min(50, bulkCount))).join(", ")}</strong>
                {" "}(skipping any that already exist). You can rename them after.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-gold" onClick={bulkAddTables} disabled={saving}>
                {saving ? "Adding…" : `Add ${Math.max(1, Math.min(50, bulkCount))} Tables`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET SEATING CONFIRMATION */}
      {resetConfirm && (
        <div className="modal-overlay" onClick={() => setResetConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Reset Seating Plan?</div>
            <p style={{ fontSize: 14, color: "var(--charcoal)", lineHeight: 1.6, marginBottom: 24 }}>
              All seat assignments will be cleared — every guest moves back to the unassigned pool. Table definitions are kept.
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setResetConfirm(false)}>Cancel</button>
              <button
                className="btn"
                style={{ background: "#c0392b", color: "white" }}
                onClick={() => { setResetConfirm(false); onResetSeating(); }}
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
