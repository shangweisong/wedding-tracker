import { useState, useEffect, useRef, useCallback } from "react";
import { isDemoMode } from "../lib/supabase.js";
import { Icon } from "../shared/icons.jsx";
import {
  ASSIGNEES,
  OFFSET_PRESETS,
  REMINDER_PRESETS,
  DEFAULT_CHECKLIST_TEMPLATE,
  buildDefaultChecklist,
  resolveDueDate,
  computeReminderDate,
  isTaskOverdue,
  checklistProgress,
  taskReminders,
  usedCategories,
  matchesCategoryFilter,
  dueDateCommitPatch,
} from "../lib/checklistUtils.js";
import { cleanDueDate, cleanNotes } from "../lib/validation.js";
import { localDateISO } from "../lib/budgetUtils.js";
import { toChecklistCSV } from "../lib/csv.js";

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
  .checklist-toolbar-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .checklist-export-btn {
    padding: 8px 16px; border-radius: 20px; cursor: pointer;
    border: 1.5px solid rgba(201,168,76,0.35); background: transparent; color: var(--brown);
    font-weight: 500; font-size: 13px; transition: background 0.15s;
  }
  .checklist-export-btn:hover { background: rgba(201,168,76,0.1); }

  .checklist-filter-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .checklist-filter-chip {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; padding: 3px 10px; border-radius: 20px; cursor: pointer;
    border: 1.5px solid rgba(201,168,76,0.25); background: transparent; color: var(--brown);
    opacity: 0.6; transition: all 0.15s; font-family: inherit;
  }
  .checklist-filter-chip:hover { opacity: 1; }
  .checklist-filter-chip.active { opacity: 1; border-color: var(--gold); background: rgba(201,168,76,0.15); color: var(--gold-dark); font-weight: 500; }
  .checklist-filter-count { opacity: 0.65; font-weight: 400; }

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
  .checklist-due-date-input {
    font-size: 12px; color: var(--brown); background: transparent; border: 1.5px solid rgba(201,168,76,0.2);
    border-radius: 6px; padding: 2px 6px; font-family: inherit; cursor: pointer;
  }
  .checklist-due-date { font-size: 12px; color: var(--brown); opacity: 0.7; }
  .checklist-overdue-badge {
    font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--red); background: var(--red-soft); padding: 2px 8px; border-radius: 20px;
  }

  .checklist-reminder-toggle {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; padding: 3px 9px; border-radius: 20px; cursor: pointer;
    border: 1.5px solid rgba(201,168,76,0.25); background: transparent; color: var(--brown);
    opacity: 0.6; transition: opacity 0.15s, border-color 0.15s;
  }
  .checklist-reminder-toggle:hover { opacity: 1; }
  .checklist-reminder-toggle.active { opacity: 1; border-color: var(--gold); background: rgba(201,168,76,0.15); color: var(--gold-dark); font-weight: 500; }
  .checklist-reminder-toggle svg { width: 12px; height: 12px; }

  .checklist-reminders-panel {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    padding: 8px 10px; border-radius: 8px; background: rgba(201,168,76,0.07);
  }

  .checklist-notes-panel {
    padding: 8px 10px; border-radius: 8px; background: rgba(201,168,76,0.07);
  }
  .checklist-notes-input {
    width: 100%; min-height: 48px; resize: vertical; outline: none;
    border: 1.5px solid rgba(201,168,76,0.25); border-radius: 8px; background: white;
    padding: 8px 10px; font-size: 12px; font-family: inherit;
    color: var(--charcoal); line-height: 1.5;
  }
  .checklist-notes-input:focus { border-color: var(--gold); }
  .checklist-reminder-chip {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 11px; color: var(--gold-dark); background: rgba(201,168,76,0.15);
    border-radius: 20px; padding: 3px 5px 3px 10px;
  }
  .checklist-reminder-chip-date { opacity: 0.65; }
  .checklist-reminder-remove {
    background: transparent; border: none; cursor: pointer; padding: 0 3px;
    color: var(--gold-dark); opacity: 0.55; font-size: 13px; line-height: 1; border-radius: 50%;
  }
  .checklist-reminder-remove:hover { opacity: 1; color: var(--red); }
  .checklist-reminder-add {
    font-size: 11px; color: var(--brown); background: transparent;
    border: 1.5px dashed rgba(201,168,76,0.35); border-radius: 20px;
    padding: 3px 8px; font-family: inherit; cursor: pointer;
  }
  .checklist-reminder-note { font-size: 11px; color: var(--brown); opacity: 0.55; font-style: italic; }

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
// The "Exact date…" mode sits between the dated presets and "No specific
// deadline", so the two lists are rendered separately around it.
const DATED_PRESETS = OFFSET_PRESETS.filter((p) => p.days !== null);
const NO_DEADLINE_PRESET = OFFSET_PRESETS.find((p) => p.days === null);

export default function ChecklistTab({ wedding, onSave, isCouple }) {
  const [items, setItems] = useState([]);
  const [saveStatus, setSaveStatus] = useState("");
  const [remindersOpenId, setRemindersOpenId] = useState(null);
  const [notesOpenId, setNotesOpenId] = useState(null); // per-task remarks panel (#124)
  // null = All, "" = Uncategorized, otherwise a trimmed category name. Not persisted.
  const [categoryFilter, setCategoryFilter] = useState(null);
  // { id, value } | null — in-progress exact-date edit (#120). Committing on
  // every onChange re-sorted the list under the open native picker (moving the
  // row force-committed big jumps) and re-rendered over small in-progress
  // edits, so the value only lands in items on blur/Enter.
  const [dueDateDraft, setDueDateDraft] = useState(null);
  const initialized = useRef(false);
  const saveTimer = useRef(null);
  const statusTimer = useRef(null);

  // Only the status-label timer is cleared on unmount. saveTimer is left to
  // fire so an edit made just before switching tabs still persists (onSave
  // lives in AdminApp, which stays mounted); its setSaveStatus is a no-op.
  useEffect(() => () => clearTimeout(statusTimer.current), []);

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
    // Also drop a pending "saved"-label reset so it can't wipe the fresh
    // "saving" status of this newer edit.
    clearTimeout(statusTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        const ok = await onSave({ checklist: nextItems });
        setSaveStatus(ok !== false ? "saved" : "");
        if (ok !== false) statusTimer.current = setTimeout(() => setSaveStatus(""), 2000);
      } catch {
        setSaveStatus("");
      }
    }, 800);
  }, [onSave]);

  const updateTask = useCallback((id, patch) => {
    setItems((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, ...patch } : item));
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const commitDueDateDraft = useCallback(() => {
    if (!dueDateDraft) return;
    updateTask(dueDateDraft.id, dueDateCommitPatch(dueDateDraft.value));
    setDueDateDraft(null);
  }, [dueDateDraft, updateTask]);

  const toggleDone = useCallback((id) => {
    setItems((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  // Same Blob-download idiom as AdminApp's guest export; the checklist always
  // exports in full, ignoring the category filter.
  const exportChecklistCSV = useCallback(() => {
    const prefix = wedding?.bride_name && wedding?.groom_name
      ? `${wedding.bride_name}-${wedding.groom_name}`.toLowerCase().replace(/\s+/g, "-")
      : "wedding";
    const blob = new Blob([toChecklistCSV(items, wedding?.wedding_date || null)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${prefix}-checklist.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [items, wedding]);

  const addTask = useCallback(() => {
    const newItem = {
      id: crypto.randomUUID(),
      text: "",
      category: "",
      dueOffsetDays: null,
      assignee: "both",
      done: false,
      notes: "",
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

  // Chip set derives from the categories actually in use (#114); a filter whose
  // category vanished (rename/delete) silently falls back to All at render time.
  const filterCategories = usedCategories(items);
  const hasUncategorized = items.some((item) => matchesCategoryFilter(item, ""));
  const filterValid =
    categoryFilter === null ||
    (categoryFilter === "" ? hasUncategorized : filterCategories.includes(categoryFilter));
  const effectiveFilter = filterValid ? categoryFilter : null;

  const rows = items
    .filter((item) => matchesCategoryFilter(item, effectiveFilter))
    .map((item) => ({ item, dueDate: resolveDueDate(weddingDate, item) }))
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
        <div className="checklist-toolbar-actions">
          {items.length > 0 && (
            <button className="checklist-export-btn" onClick={exportChecklistCSV}>
              Export CSV
            </button>
          )}
          <button className="checklist-add-btn" onClick={addTask}>
            <Icon.Plus /> Add task
          </button>
        </div>
      </div>

      {filterCategories.length > 0 && (
        <div className="checklist-filter-row">
          {[
            { value: null, label: "All", count: items.length },
            ...filterCategories.map((category) => ({
              value: category,
              label: category,
              count: items.filter((item) => matchesCategoryFilter(item, category)).length,
            })),
            ...(hasUncategorized
              ? [{
                  value: "",
                  label: "Uncategorized",
                  count: items.filter((item) => matchesCategoryFilter(item, "")).length,
                }]
              : []),
          ].map(({ value, label, count }) => (
            <button
              key={value === null ? "all" : `c:${value}`}
              className={`checklist-filter-chip ${effectiveFilter === value ? "active" : ""}`}
              onClick={() => setCategoryFilter(value)}
            >
              {label} <span className="checklist-filter-count">{count}</span>
            </button>
          ))}
        </div>
      )}

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
            const isExact = cleanDueDate(item.dueDate) !== null;
            // Reminders need a due anchor: a pinned exact date, or an offset
            // (kept even without a wedding date, matching pre-#110 behavior).
            const hasDueConfig = isExact || (item.dueOffsetDays !== null && item.dueOffsetDays !== undefined);
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
                      value={isExact ? "exact" : offsetToOptionValue(item.dueOffsetDays)}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "exact") {
                          // Pin to the currently-resolved date (else today) so exact
                          // mode always holds a valid date — autosave never persists
                          // a blank. Reminders re-anchor automatically.
                          updateTask(item.id, { dueDate: dueDate ?? localDateISO(), dueOffsetDays: null });
                        } else if (value === "none") {
                          // No due date ⇒ no anchor for reminders: clear all in one
                          // patch so a single save round-trip keeps them consistent.
                          updateTask(item.id, { dueOffsetDays: null, dueDate: null, reminders: [] });
                        } else {
                          updateTask(item.id, { dueOffsetDays: optionValueToOffset(value), dueDate: null });
                        }
                      }}
                    >
                      {DATED_PRESETS.map((p) => (
                        <option key={p.label} value={offsetToOptionValue(p.days)}>{p.label}</option>
                      ))}
                      <option value="exact">Exact date…</option>
                      <option value="none">{NO_DEADLINE_PRESET.label}</option>
                    </select>
                    {isExact && (
                      <input
                        type="date"
                        className="checklist-due-date-input"
                        value={dueDateDraft?.id === item.id ? dueDateDraft.value : item.dueDate}
                        onChange={(e) => setDueDateDraft({ id: item.id, value: e.target.value })}
                        onBlur={commitDueDateDraft}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                      />
                    )}
                    {dueDate && (
                      <span
                        className="checklist-due-date"
                        title={isExact ? "Pinned to this exact date — won't move if the wedding date changes" : undefined}
                      >
                        Due {dueDate}{isExact ? " 📌" : ""}
                      </span>
                    )}
                    {overdue && <span className="checklist-overdue-badge">Overdue</span>}
                    {hasDueConfig && (
                      <button
                        className={`checklist-reminder-toggle ${taskReminders(item).length > 0 ? "active" : ""}`}
                        onClick={() => setRemindersOpenId((prev) => (prev === item.id ? null : item.id))}
                        title="Email reminders for this task"
                      >
                        <Icon.Bell />
                        {taskReminders(item).length > 0 ? taskReminders(item).length : ""}
                      </button>
                    )}
                    <button
                      className={`checklist-reminder-toggle ${item.notes?.trim() ? "active" : ""}`}
                      onClick={() => setNotesOpenId((prev) => (prev === item.id ? null : item.id))}
                      title="Remarks for this task"
                    >
                      <Icon.Edit />
                    </button>
                  </div>
                  {notesOpenId === item.id && (
                    <div className="checklist-notes-panel">
                      <textarea
                        className="checklist-notes-input"
                        rows={2}
                        maxLength={500}
                        placeholder="Remarks — vendor contacts, decisions, things to remember…"
                        value={item.notes ?? ""}
                        onChange={(e) => updateTask(item.id, { notes: e.target.value })}
                        onBlur={(e) => {
                          // Trim on commit only (typing mid-sentence needs trailing spaces);
                          // maxLength already enforces the 500 cap live.
                          const cleaned = cleanNotes(e.target.value);
                          if (cleaned !== (item.notes ?? "")) updateTask(item.id, { notes: cleaned });
                        }}
                      />
                    </div>
                  )}
                  {remindersOpenId === item.id && hasDueConfig && (
                    <div className="checklist-reminders-panel">
                      {taskReminders(item).map((r) => {
                        const preset = REMINDER_PRESETS.find((p) => p.days === r.offsetDays);
                        const label = preset ? preset.label : `${-r.offsetDays} days before due`;
                        const fireDate = computeReminderDate(dueDate, r.offsetDays);
                        return (
                          <span key={r.id} className="checklist-reminder-chip">
                            {label}
                            {fireDate && <span className="checklist-reminder-chip-date">{fireDate}</span>}
                            <button
                              className="checklist-reminder-remove"
                              onClick={() => updateTask(item.id, { reminders: taskReminders(item).filter((x) => x.id !== r.id) })}
                              title="Remove reminder"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                      {(() => {
                        const used = new Set(taskReminders(item).map((r) => r.offsetDays));
                        const available = REMINDER_PRESETS.filter((p) => !used.has(p.days));
                        if (available.length === 0) return null;
                        return (
                          <select
                            className="checklist-reminder-add"
                            value=""
                            onChange={(e) => {
                              if (e.target.value === "") return;
                              // The id minted here is the reminder's permanent identity —
                              // the cron's sent-log dedups on it, so it must never change.
                              updateTask(item.id, {
                                reminders: [
                                  ...taskReminders(item),
                                  { id: crypto.randomUUID(), offsetDays: Number(e.target.value) },
                                ],
                              });
                            }}
                          >
                            <option value="">+ Add reminder…</option>
                            {available.map((p) => (
                              <option key={p.label} value={String(p.days)}>{p.label}</option>
                            ))}
                          </select>
                        );
                      })()}
                      <span className="checklist-reminder-note">
                        Emailed to the host on the day{taskReminders(item).length === 0 ? " — add one to get notified" : ""}
                      </span>
                    </div>
                  )}
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
