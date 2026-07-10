import { useState, useEffect, useRef, useCallback } from "react";
import { isDemoMode } from "../lib/supabase.js";

const styles = `
  .runsheet-tab { display: flex; flex-direction: column; height: 100%; }

  .runsheet-toolbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 20px; background: white; flex-wrap: wrap; gap: 10px;
    border-bottom: 1.5px solid rgba(201,168,76,0.15);
  }
  .runsheet-toolbar-left { display: flex; align-items: center; gap: 10px; }
  .runsheet-toolbar-right { display: flex; align-items: center; gap: 10px; }
  .runsheet-save-status { font-size: 12px; color: var(--brown); opacity: 0.5; }
  .runsheet-readonly-badge {
    font-size: 11px; padding: 3px 10px; border-radius: 20px;
    background: rgba(201,168,76,0.12); color: var(--brown);
    font-weight: 500; letter-spacing: 0.04em;
  }
  .runsheet-demo-note { font-size: 11px; color: var(--brown); opacity: 0.45; font-style: italic; }

  .rs-publish-row { display: flex; align-items: center; gap: 8px; }
  .rs-publish-label { font-size: 12px; color: var(--brown); opacity: 0.7; }
  .rs-toggle { position: relative; display: inline-block; width: 36px; height: 20px; }
  .rs-toggle input { opacity: 0; width: 0; height: 0; }
  .rs-toggle-slider {
    position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(201,168,76,0.25); border-radius: 20px; transition: 0.2s;
  }
  .rs-toggle-slider:before {
    position: absolute; content: ""; height: 14px; width: 14px;
    left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.2s;
  }
  .rs-toggle input:checked + .rs-toggle-slider { background: var(--gold); }
  .rs-toggle input:checked + .rs-toggle-slider:before { transform: translateX(16px); }

  .runsheet-share-btn {
    font-size: 12px; padding: 5px 14px; border-radius: 20px; cursor: pointer;
    border: 1.5px solid var(--gold); background: transparent; color: var(--gold-dark);
    font-weight: 500; transition: background 0.15s;
  }
  .runsheet-share-btn:hover { background: rgba(201,168,76,0.1); }

  .runsheet-table-wrap { overflow-x: auto; flex: 1; }

  .runsheet-table {
    width: 100%; border-collapse: collapse; font-size: 13px; min-width: 760px;
    table-layout: fixed;
  }
  .runsheet-table col.rs-col-drag { width: 28px; }
  .runsheet-table col.rs-col-time { width: 90px; }
  .runsheet-table col.rs-col-event { width: 200px; }
  .runsheet-table col.rs-col-duration { width: 80px; }
  .runsheet-table col.rs-col-involved { width: 160px; }
  .runsheet-table col.rs-col-comments { width: auto; }
  .runsheet-table col.rs-col-del { width: 36px; }

  .runsheet-table thead tr { background: var(--charcoal); }
  .runsheet-table thead th {
    color: var(--gold-light); text-transform: uppercase; font-size: 11px;
    letter-spacing: 0.08em; padding: 10px 8px; text-align: left; font-weight: 500;
  }
  .runsheet-table thead th.rs-th-drag,
  .runsheet-table thead th.rs-th-del { padding: 10px 4px; }

  .runsheet-table tbody tr { border-bottom: 1px solid rgba(201,168,76,0.1); }
  .runsheet-table tbody tr:hover { background: rgba(201,168,76,0.04); }
  .runsheet-table tbody tr.dragging { opacity: 0.4; }
  .runsheet-table tbody tr.drag-over {
    background: rgba(201,168,76,0.12);
    box-shadow: inset 0 2px 0 var(--gold);
  }

  .runsheet-table td { padding: 4px 6px; vertical-align: top; }

  .rs-cell-input {
    width: 100%; border: none; background: transparent; font-size: 13px;
    color: var(--charcoal); font-family: inherit; padding: 6px 4px;
    border-radius: 4px; resize: none; line-height: 1.4; outline: none;
    display: block;
  }
  .rs-cell-input:focus { background: rgba(201,168,76,0.08); }
  .rs-cell-input[readonly] { cursor: default; color: var(--charcoal); }

  .rs-drag {
    width: 28px; color: rgba(201,168,76,0.4); cursor: grab;
    text-align: center; padding-top: 10px; user-select: none; font-size: 16px;
  }
  .rs-drag:active { cursor: grabbing; }

  .rs-del-btn {
    background: transparent; border: none; cursor: pointer; padding: 6px 4px;
    color: rgba(201,168,76,0.4); border-radius: 4px; display: flex; align-items: center;
    justify-content: center; width: 28px;
  }
  .rs-del-btn:hover { color: #e53e3e; background: rgba(229,62,62,0.08); }
  .rs-del-btn svg { width: 14px; height: 14px; }

  .runsheet-add-row {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    width: 100%; padding: 12px; border: none; background: transparent;
    border-top: 1.5px dashed rgba(201,168,76,0.3); color: var(--gold-dark);
    font-size: 13px; font-family: inherit; cursor: pointer; transition: background 0.15s;
  }
  .runsheet-add-row:hover { background: rgba(201,168,76,0.06); }

  .rs-empty-readonly {
    text-align: center; padding: 40px 20px; color: var(--brown); opacity: 0.45;
  }
  .rs-empty-readonly .rs-empty-icon { font-size: 28px; margin-bottom: 8px; }
  .rs-empty-readonly .rs-empty-text { font-size: 14px; }
`;

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,6 5,6 21,6"/>
      <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
      <path d="M10,11v6"/><path d="M14,11v6"/>
      <path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V6"/>
    </svg>
  );
}

export default function RunsheetTab({ wedding, onSave, showToast, isReadOnly }) {
  const [items, setItems] = useState([]);
  const [published, setPublished] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const initialized = useRef(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (initialized.current || !wedding) return;
    initialized.current = true;
    setItems(Array.isArray(wedding.runsheet) ? wedding.runsheet : []);
    setPublished(wedding.is_runsheet_published ?? false);
  }, [wedding]);

  const scheduleSave = useCallback((nextItems, nextPublished) => {
    clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      const ok = await onSave({ runsheet: nextItems, is_runsheet_published: nextPublished });
      setSaveStatus(ok !== false ? "saved" : "");
      if (ok !== false) {
        setTimeout(() => setSaveStatus(""), 2000);
      }
    }, 800);
  }, [onSave]);

  const updateField = useCallback((id, field, value) => {
    setItems((prev) => {
      const next = prev.map((item) => item.id === id ? { ...item, [field]: value } : item);
      scheduleSave(next, published);
      return next;
    });
  }, [published, scheduleSave]);

  const addRow = useCallback(() => {
    const newItem = { id: crypto.randomUUID(), time: "", event: "", duration: "", involved: "", comments: "" };
    setItems((prev) => {
      const next = [...prev, newItem];
      scheduleSave(next, published);
      return next;
    });
  }, [published, scheduleSave]);

  const deleteRow = useCallback((id) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      scheduleSave(next, published);
      return next;
    });
  }, [published, scheduleSave]);

  const togglePublished = useCallback(() => {
    setPublished((prev) => {
      const next = !prev;
      scheduleSave(items, next);
      return next;
    });
  }, [items, scheduleSave]);

  const copyShareLink = useCallback(() => {
    if (!wedding?.slug) {
      showToast("Set a wedding URL slug first in Wedding Page settings");
      return;
    }
    const url = `${window.location.origin}/runsheet/${wedding.slug}`;
    navigator.clipboard.writeText(url).then(
      () => showToast("Share link copied to clipboard"),
      () => showToast("Could not copy — link: " + url),
    );
  }, [wedding, showToast]);

  const onDragStart = useCallback((e, idx) => {
    if (isReadOnly) return;
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  }, [isReadOnly]);

  const onDragOver = useCallback((e, idx) => {
    e.preventDefault();
    setOverIdx(idx);
  }, []);

  const onDrop = useCallback((e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null); setOverIdx(null);
      return;
    }
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      scheduleSave(next, published);
      return next;
    });
    setDragIdx(null); setOverIdx(null);
  }, [dragIdx, published, scheduleSave]);

  const onDragEnd = useCallback(() => {
    setDragIdx(null); setOverIdx(null);
  }, []);

  return (
    <div className="runsheet-tab">
      <style>{styles}</style>

      <div className="runsheet-toolbar">
        <div className="runsheet-toolbar-left">
          {isReadOnly && <span className="runsheet-readonly-badge">View only</span>}
          {saveStatus === "saving" && <span className="runsheet-save-status">Saving…</span>}
          {saveStatus === "saved" && <span className="runsheet-save-status">Saved ✓</span>}
          {isDemoMode && <span className="runsheet-demo-note">(demo — data not persisted)</span>}
        </div>
        {!isReadOnly && (
          <div className="runsheet-toolbar-right">
            <div className="rs-publish-row">
              <label className="rs-toggle" title={published ? "Runsheet is public" : "Runsheet is private"}>
                <input type="checkbox" checked={published} onChange={togglePublished} />
                <span className="rs-toggle-slider" />
              </label>
              <span className="rs-publish-label">{published ? "Published" : "Private"}</span>
            </div>
            <button className="runsheet-share-btn" onClick={copyShareLink}>
              Copy share link
            </button>
          </div>
        )}
      </div>

      <div className="runsheet-table-wrap">
        <table className="runsheet-table">
          <colgroup>
            {!isReadOnly && <col className="rs-col-drag" />}
            <col className="rs-col-time" />
            <col className="rs-col-event" />
            <col className="rs-col-duration" />
            <col className="rs-col-involved" />
            <col className="rs-col-comments" />
            {!isReadOnly && <col className="rs-col-del" />}
          </colgroup>
          <thead>
            <tr>
              {!isReadOnly && <th className="rs-th-drag" />}
              <th>Time</th>
              <th>Event</th>
              <th>Duration</th>
              <th>Involved</th>
              <th>Comments</th>
              {!isReadOnly && <th className="rs-th-del" />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && isReadOnly ? (
              <tr>
                <td colSpan={5}>
                  <div className="rs-empty-readonly">
                    <div className="rs-empty-icon">📋</div>
                    <div className="rs-empty-text">No runsheet items yet</div>
                  </div>
                </td>
              </tr>
            ) : items.map((item, idx) => (
              <tr
                key={item.id}
                className={[dragIdx === idx ? "dragging" : "", overIdx === idx && dragIdx !== idx ? "drag-over" : ""].filter(Boolean).join(" ")}
                draggable={!isReadOnly}
                onDragStart={!isReadOnly ? (e) => onDragStart(e, idx) : undefined}
                onDragOver={!isReadOnly ? (e) => onDragOver(e, idx) : undefined}
                onDrop={!isReadOnly ? (e) => onDrop(e, idx) : undefined}
                onDragEnd={!isReadOnly ? onDragEnd : undefined}
              >
                {!isReadOnly && (
                  <td>
                    <div className="rs-drag" title="Drag to reorder">⠿</div>
                  </td>
                )}
                <td>
                  <input
                    className="rs-cell-input"
                    value={item.time}
                    placeholder="e.g. 7am, 3:30 PM"
                    readOnly={isReadOnly}
                    onChange={isReadOnly ? undefined : (e) => updateField(item.id, "time", e.target.value)}
                  />
                </td>
                <td>
                  <textarea
                    className="rs-cell-input"
                    rows={2}
                    value={item.event}
                    placeholder="Event description"
                    readOnly={isReadOnly}
                    onChange={isReadOnly ? undefined : (e) => updateField(item.id, "event", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="rs-cell-input"
                    value={item.duration}
                    placeholder="30 mins"
                    readOnly={isReadOnly}
                    onChange={isReadOnly ? undefined : (e) => updateField(item.id, "duration", e.target.value)}
                  />
                </td>
                <td>
                  <textarea
                    className="rs-cell-input"
                    rows={2}
                    value={item.involved}
                    placeholder="Bride, MUA"
                    readOnly={isReadOnly}
                    onChange={isReadOnly ? undefined : (e) => updateField(item.id, "involved", e.target.value)}
                  />
                </td>
                <td>
                  <textarea
                    className="rs-cell-input"
                    rows={2}
                    value={item.comments}
                    placeholder="Additional notes…"
                    readOnly={isReadOnly}
                    onChange={isReadOnly ? undefined : (e) => updateField(item.id, "comments", e.target.value)}
                  />
                </td>
                {!isReadOnly && (
                  <td>
                    <button className="rs-del-btn" onClick={() => deleteRow(item.id)} title="Delete row">
                      <TrashIcon />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!isReadOnly && (
          <button className="runsheet-add-row" onClick={addRow}>
            + Add row
          </button>
        )}
      </div>
    </div>
  );
}
