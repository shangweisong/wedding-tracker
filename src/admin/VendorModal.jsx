import { useState } from "react";
import MilestoneEditor from "./MilestoneEditor.jsx";
import { fmtMoney } from "../lib/budgetUtils.js";

const BLANK = {
  company_name: "",
  contact_name: "",
  phone: "",
  email: "",
  website: "",
  notes: "",
  status: "enquiring",
  quoted_price: "",
  is_fully_paid: false,
  category_key: "",
  milestones: [],
  arrival_time: "",
};

export default function VendorModal({ mode, vendor, categories, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    ...BLANK,
    ...(vendor ?? {}),
    milestones: (vendor?.milestones ?? []).map((m) => ({ ...m, _key: m._key ?? crypto.randomUUID() })),
  }));
  const [saving, setSaving] = useState(false);
  const [showArrival, setShowArrival] = useState(Boolean(vendor?.arrival_time));

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.company_name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        company_name: form.company_name.trim(),
        quoted_price: Number(form.quoted_price) || 0,
        arrival_time: form.arrival_time || null,
        milestones: form.milestones.map((m) => ({
          ...m,
          amount: Number(m.amount) || 0,
        })),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-title">
          {mode === "edit" ? "Edit Vendor" : "Add Vendor"}
        </div>

        <div className="form-grid">
          {/* Company + Category */}
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Company / Vendor name *</label>
              <input
                className="form-input"
                autoFocus
                placeholder="e.g. XYZ Photography"
                value={form.company_name}
                onChange={(e) => set("company_name", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-input"
                value={form.category_key}
                onChange={(e) => set("category_key", e.target.value)}
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Contract total + Status */}
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">
                Contract total ($){" "}
                <span style={{ fontWeight: 400, opacity: 0.6, fontSize: 11 }}>
                  — the agreed price with this vendor
                </span>
              </label>
              <input
                className="form-input"
                type="number"
                min={0}
                step={100}
                placeholder="e.g. 5000"
                value={form.quoted_price}
                onChange={(e) => set("quoted_price", e.target.value)}
                style={{ fontWeight: 600, fontSize: 15 }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-input"
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                <option value="enquiring">Enquiring</option>
                <option value="booked">Booked</option>
              </select>
            </div>
          </div>

          {/* Contact */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contact person</label>
              <input
                className="form-input"
                placeholder="Name"
                value={form.contact_name}
                onChange={(e) => set("contact_name", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                className="form-input"
                type="tel"
                placeholder="+65 9123 4567"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="vendor@email.com"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Website</label>
              <input
                className="form-input"
                type="url"
                placeholder="https://..."
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Contract details, special requirements…"
              style={{ resize: "vertical" }}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          {/* Arrival time — collapsed by default */}
          <div className="form-group">
            <button
              type="button"
              onClick={() => setShowArrival((v) => !v)}
              style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                color: "var(--brown)", fontSize: 12, opacity: 0.6,
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <span style={{ fontSize: 10 }}>{showArrival ? "▾" : "▸"}</span>
              D-Day arrival time
            </button>
            {showArrival && (
              <input
                className="form-input"
                type="time"
                style={{ marginTop: 6 }}
                value={form.arrival_time ?? ""}
                onChange={(e) => set("arrival_time", e.target.value)}
              />
            )}
          </div>

          {/* Milestones */}
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label className="form-label" style={{ margin: 0 }}>Payment milestones</label>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer", color: form.is_fully_paid ? "var(--green, #2e7d4f)" : "var(--brown)", fontWeight: form.is_fully_paid ? 600 : 400 }}>
                <input
                  type="checkbox"
                  checked={form.is_fully_paid}
                  onChange={(e) => set("is_fully_paid", e.target.checked)}
                  style={{ width: 15, height: 15, cursor: "pointer" }}
                />
                Fully paid
              </label>
            </div>
            {form.is_fully_paid ? (
              <div style={{ padding: "10px 14px", background: "rgba(46,125,79,0.07)", borderRadius: 8, fontSize: 13, color: "#2e7d4f", border: "1.5px solid rgba(46,125,79,0.2)" }}>
                Marked as fully paid — total paid = contract total ({fmtMoney(Number(form.quoted_price) || 0)})
              </div>
            ) : (
              <MilestoneEditor
                milestones={form.milestones}
                onChange={(milestones) => set("milestones", milestones)}
              />
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn btn-gold"
            onClick={handleSave}
            disabled={saving || !form.company_name.trim()}
          >
            {saving ? "Saving…" : mode === "edit" ? "Save Changes" : "Add Vendor"}
          </button>
        </div>
      </div>
    </div>
  );
}
