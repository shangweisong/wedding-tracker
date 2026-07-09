import { useState } from "react";

const styles = `
  .catmgr-row {
    display: grid; grid-template-columns: 1fr 120px 36px;
    gap: 8px; align-items: center;
  }
  .catmgr-header {
    display: grid; grid-template-columns: 1fr 120px 36px;
    gap: 8px; font-size: 10px; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--brown); opacity: 0.6; padding-bottom: 2px;
  }
  .catmgr-del {
    width: 30px; height: 30px; border-radius: 6px; border: none; cursor: pointer;
    background: transparent; font-size: 14px; color: var(--brown); opacity: 0.5;
    transition: all 0.12s; display: flex; align-items: center; justify-content: center;
  }
  .catmgr-del:hover:not(:disabled) { opacity: 1; background: var(--red-soft); color: var(--red); }
  .catmgr-del:disabled { cursor: default; opacity: 0.2; }
  .catmgr-add {
    display: flex; align-items: center; gap: 6px;
    background: none; border: 1.5px dashed rgba(201,168,76,0.4);
    border-radius: 8px; padding: 8px 12px; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 12px;
    color: var(--brown); opacity: 0.7; width: 100%;
    transition: all 0.15s; margin-top: 4px;
  }
  .catmgr-add:hover { opacity: 1; border-color: var(--gold); color: var(--gold-dark); }
`;

export default function CategoryManagerModal({ categories, vendors, onSave, onClose, showToast }) {
  const [cats, setCats] = useState(() => categories.map((c) => ({ ...c })));
  const [saving, setSaving] = useState(false);

  const vendorCountForKey = (key) => vendors.filter((v) => v.category_key === key).length;

  const updateCat = (idx, field, value) => {
    setCats((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const addCategory = () => {
    const key = `cat_${crypto.randomUUID().slice(0, 8)}`;
    setCats((prev) => [...prev, { key, label: "", cap: 0 }]);
  };

  const removeCategory = (idx) => {
    setCats((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    const valid = cats.filter((c) => c.label.trim());
    const dropped = cats.length - valid.length;
    if (dropped > 0) showToast(`${dropped} unnamed ${dropped === 1 ? "category" : "categories"} skipped`);
    setSaving(true);
    try {
      await onSave(valid.map((c) => ({ ...c, cap: Math.max(0, Number(c.cap) || 0) })));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal"
          style={{ maxWidth: 500, maxHeight: "85vh", overflowY: "auto" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-title">Manage Budget Categories</div>

          <div className="form-grid">
            {cats.length > 0 && (
              <div className="catmgr-header">
                <span>Category name</span>
                <span>Budget cap ($)</span>
                <span />
              </div>
            )}

            {cats.map((cat, idx) => {
              const count = vendorCountForKey(cat.key);
              return (
                <div key={cat.key} className="catmgr-row">
                  <input
                    className="form-input"
                    style={{ padding: "7px 10px", fontSize: 13 }}
                    placeholder="Category name"
                    value={cat.label}
                    onChange={(e) => updateCat(idx, "label", e.target.value)}
                  />
                  <input
                    className="form-input"
                    style={{ padding: "7px 10px", fontSize: 13 }}
                    type="number"
                    min="0"
                    placeholder="0 = no cap"
                    value={cat.cap ?? ""}
                    onChange={(e) => updateCat(idx, "cap", e.target.value)}
                  />
                  <button
                    type="button"
                    className="catmgr-del"
                    disabled={count > 0}
                    title={count > 0 ? `${count} vendor(s) use this category` : "Remove"}
                    onClick={() => removeCategory(idx)}
                  >
                    ×
                  </button>
                </div>
              );
            })}

            <button type="button" className="catmgr-add" onClick={addCategory}>
              + Add category
            </button>

            <p style={{ fontSize: 12, color: "var(--brown)", opacity: 0.55, margin: 0 }}>
              Set cap to 0 to skip budget tracking for a category. Categories with
              existing vendors cannot be deleted.
            </p>
          </div>

          <div className="modal-actions">
            <button className="btn btn-outline" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Categories"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
