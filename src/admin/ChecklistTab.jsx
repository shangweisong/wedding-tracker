import { useState, useEffect, useRef, useCallback } from "react";
import { isDemoMode } from "../lib/supabase.js";
import { Icon } from "../shared/icons.jsx";
import {
  OFFSET_PRESETS,
  DEFAULT_CHECKLIST_TEMPLATE,
  buildDefaultChecklist,
  computeDueDate,
  isTaskOverdue,
  checklistProgress,
} from "../lib/checklistUtils.js";

const ASSIGNEES = [
  { key: "both", label: "Both" },
  { key: "bride", label: "Bride" },
  { key: "groom", label: "Groom" },
];

const styles = `
  .checklist-tab { display: flex; flex-direction: column; gap: 16px; }

  .checklist-progress-card {
    background: white; border-radius: var(--radius); padding: 16px 20px;
    box-shadow: var(--shadow); border: 1.5px solid rgba(201,168,76,0.15);
    display: flex; flex-direction: column; gap: 8px;
  }
  .checklist-progress-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .checklist-progress-label { font-size: 13px; color: var(--brown); font-weight: 500; }
  .checklist-progress-count { font-size: 13px; color: var(--brown); opacity: 0.7; }
  .checklist-progress-bar { height: 8px; border-radius: 20px; background: rgba(201,168,76,0.15); overflow: hidden; }
  .checklist-progress-fill { height: 100%; background: var(--gold); transition: width 0.25s ease; }
  .checklist-progress-fill.complete { background: var(--green); }
  .checklist-date-note { font-size: 12px; color: var(--brown); opacity: 0.6; font-style: italic; }

  .checklist-toolbar {
    display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
  }
  .checklist-save-status { font-size: 12px; color: var(--brown); opacity: 0.5; }
  .checklist-demo-note { font-size: 11px; color: var(--brown); opacity: 0.45; font-style: italic; }
  .checklist-add-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 20px; cursor: pointer;
    border: 1.5px solid var(--gold); background: transparent; color: var(--gold-dark);
    font-weight: 500; font-size: 13px; transition: background 0.15s;
  }
  .checklist-add-btn:hover { background: rgba(201,168,76,0.1); }
  .checklist-add-btn svg { width: 14px; height: 14px; }

  .checklist-list { display: flex; flex-direction: column; gap: 8px; }

  .checklist-row {
    background: white; border-radius: 10px; padding: 12px 14px;
    box-shadow: var(--shadow); border: 1.5px solid rgba(201,168,76,0.12);
    display: flex; align-items: flex-start; gap: 12px;
    transition: border-color 0.15s, opacity 0.15s;
  }
  .checklist-row:hover { border-color: rgba(201,168,76,0.3); }
  .checklist-row.done { opacity: 0.55; }
  .checklist-row.overdue { border-color: rgba(192,57,43,0.35); }

  .checklist-checkbox {
    width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; margin-top: 2px;
    border: 2px solid rgba(201,168,76,0.5); background: white; cursor: pointer;
    display: flex; align-items: center; justify-content: center; padding: 0;
    color: white; transition: background 0.15s, border-color 0.15s;
  }
  .checklist-checkbox.checked { background: var(--green); border-color: var(--green); }
  .checklist-checkbox svg { width: 13px; height: 13px; }

  .checklist-row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .checklist-text-input {
    width: 100%; border: none; background: transparent; font-size: 14px;
    color: var(--charcoal); font-family: inherit; padding: 2px 0; outline: none;
  }
  .checklist-text-input.done { text-decoration: line-through; }
  .checklist-row-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

  .checklist-category-input {
    font-size: 11px; color: var(--gold-dark); background: rgba(201,168,76,0.1);
    border: none; border-radius: 20px; padding: 3px 10px; font-family: inherit;
    outline: none; width: 130px;
  }
  .checklist-category-input::placeholder { color: rgba(160,120,48,0.5); }

  .checklist-assignee-group { display: flex; gap: 3px; }
  .checklist-assignee-pill {
    font-size: 11px; padding: 3px 9px; border-radius: 20px; cursor: pointer;
    border: 1.5px solid rgba(201,168,76,0.25); background: transparent; color: var(--brown);
    opacity: 0.6; transition: all 0.15s;
  }
  .checklist-assignee-pill.active { opacity: 1; border-color: var(--gold); background: rgba(201,168,76,0.15); color: var(--gold-dark); font-weight: 500; }

  .checklist-due-select {
    font-size: 12px; color: var(--brown); background: transparent; border: 1.5px solid rgba(201,168,76,0.2);
    border-radius: 6px; padding: 3px 6px; font-family: inherit; cursor: pointer;
  }
  .checklist-due-date { font-size: 12px; color: var(--brown); opacity: 0.7; }
  .checklist-overdue-badge {
    font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--red); background: var(--red-soft); padding: 2px 8px; border-radius: 20px;
  }

  .checklist-del-btn {
    background: transparent; border: none; cursor: pointer; padding: 4px;
    color: rgba(201,168,76,0.4); border-radius: 4px; flex-shrink: 0; margin-top: 2px;
  }
  .checklist-del-btn:hover { color: var(--red); background: rgba(192,57,43,0.08); }
  .checklist-del-btn svg { width: 14px; height: 14px; }

  .checklist-empty { text-align: center; padding: 40px 20px; color: var(--brown); opacity: 0.45; }
  .checklist-empty .empty-icon { font-size: 28px; margin-bottom: 8px; }

  @media (max-width: 640px) {
    .checklist-row { flex-wrap: wrap; }
    .checklist-row-body { flex: 1 1 auto; }
    .checklist-category-input { width: 100px; }
  }
`;

/** value coding for the due-offset <select> — HTML select options are always strings. */
const offsetToOptionValue = (days) => (days === null || days === undefined ? "none" : String(days));
const optionValueToOffset = (value) => (value === "none" ? null : Number(value));

export default function ChecklistTab({ wedding, onSave, isCouple }) {
  const [items, setItems] = useState([]);
  const [saveStatus, setSaveStatus] = useState("");
  const initialized = useRef(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (initialized.current || !wedding || !isCouple) return;
    initialized.current = true;
    const existing = Array.isArray(wedding.checklist) ? wedding.checklist : [];
    if (existing.length === 0) {
      const seeded = buildDefaultChecklist();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(seeded);
      onSave({ checklist: seeded });
    } else {
      setItems(existing);
    }
  }, [wedding, isCouple, onSave]);

  const scheduleSave = useCallback((nextItems) => {
    clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      const ok = await onSave({ checklist: nextItems });
      setSaveStatus(ok !== false ? "saved" : "");
      if (ok !== false) setTimeout(() => setSaveStatus(""), 2000);
    }, 800);
  }, [onSave]);

  const updateTask = useCallback((id, patch) => {
    setItems((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, ...patch } : item));
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const toggleDone = useCallback((id) => {
    setItems((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const addTask = useCallback(() => {
    const newItem = {
      id: crypto.randomUUID(),
      text: "",
      category: "",
      dueOffsetDays: null,
      assignee: "both",
      done: false,
    };
    setItems((prev) => {
      const next = [...prev, newItem];
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const deleteTask = useCallback((id) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  // Guard: couple only — placed after all hooks to satisfy rules-of-hooks.
  if (!isCouple) {
    return (
      <div className="empty">
        <div className="empty-icon">🔒</div>
        <div className="empty-text">Checklist — Couple Access Only</div>
        <div className="empty-sub">This section is only visible to the couple.</div>
      </div>
    );
  }

  const weddingDate = wedding?.wedding_date || null;
  const { done, total, pct } = checklistProgress(items);

  const rows = items
    .map((item) => ({ item, dueDate: computeDueDate(weddingDate, item.dueOffsetDays) }))
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });

  const categoryOptions = [...new Set([
    ...DEFAULT_CHECKLIST_TEMPLATE.map((t) => t.category),
    ...items.map((t) => t.category).filter(Boolean),
  ])];

  return (
    <div className="checklist-tab">
      <style>{styles}</style>

      <div className="checklist-progress-card">
        <div className="checklist-progress-row">
          <span className="checklist-progress-label">Planning checklist</span>
          <span className="checklist-progress-count">{done} of {total} tasks done{total > 0 ? ` (${pct}%)` : ""}</span>
        </div>
        <div className="checklist-progress-bar">
          <div className={`checklist-progress-fill ${pct === 100 && total > 0 ? "complete" : ""}`} style={{ width: `${pct}%` }} />
        </div>
        {!weddingDate && (
          <div className="checklist-date-note">Set your wedding date in Wedding Page settings to see computed deadlines.</div>
        )}
      </div>

      <div className="checklist-toolbar">
        <div>
          {saveStatus === "saving" && <span className="checklist-save-status">Saving…</span>}
          {saveStatus === "saved" && <span className="checklist-save-status">Saved ✓</span>}
          {isDemoMode && <span className="checklist-demo-note">(demo — data not persisted)</span>}
        </div>
        <button className="checklist-add-btn" onClick={addTask}>
          <Icon.Plus /> Add task
        </button>
      </div>

      <datalist id="checklist-categories">
        {categoryOptions.map((c) => <option key={c} value={c} />)}
      </datalist>

      {rows.length === 0 ? (
        <div className="checklist-empty">
          <div className="empty-icon">✅</div>
          <div>No tasks yet — add one to get started.</div>
        </div>
      ) : (
        <div className="checklist-list">
          {rows.map(({ item, dueDate }) => {
            const overdue = isTaskOverdue(dueDate, item.done);
            return (
              <div key={item.id} className={`checklist-row ${item.done ? "done" : ""} ${overdue ? "overdue" : ""}`}>
                <button
                  className={`checklist-checkbox ${item.done ? "checked" : ""}`}
                  onClick={() => toggleDone(item.id)}
                  title={item.done ? "Mark as not done" : "Mark as done"}
                >
                  {item.done && <Icon.Check />}
                </button>
                <div className="checklist-row-body">
                  <input
                    className={`checklist-text-input ${item.done ? "done" : ""}`}
                    value={item.text}
                    placeholder="Task description"
                    onChange={(e) => updateTask(item.id, { text: e.target.value })}
                  />
                  <div className="checklist-row-meta">
                    <input
                      className="checklist-category-input"
                      list="checklist-categories"
                      value={item.category}
                      placeholder="Category"
                      onChange={(e) => updateTask(item.id, { category: e.target.value })}
                    />
                    <div className="checklist-assignee-group">
                      {ASSIGNEES.map((a) => (
                        <button
                          key={a.key}
                          className={`checklist-assignee-pill ${item.assignee === a.key ? "active" : ""}`}
                          onClick={() => updateTask(item.id, { assignee: a.key })}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                    <select
                      className="checklist-due-select"
                      value={offsetToOptionValue(item.dueOffsetDays)}
                      onChange={(e) => updateTask(item.id, { dueOffsetDays: optionValueToOffset(e.target.value) })}
                    >
                      {OFFSET_PRESETS.map((p) => (
                        <option key={p.label} value={offsetToOptionValue(p.days)}>{p.label}</option>
                      ))}
                    </select>
                    {dueDate && <span className="checklist-due-date">Due {dueDate}</span>}
                    {overdue && <span className="checklist-overdue-badge">Overdue</span>}
                  </div>
                </div>
                <button className="checklist-del-btn" onClick={() => deleteTask(item.id)} title="Delete task">
                  <Icon.Trash />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
