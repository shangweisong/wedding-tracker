import { useState, useEffect, useCallback } from "react";
import { sb, isDemoMode } from "../lib/supabase.js";
import BudgetSummaryCard from "./BudgetSummaryCard.jsx";
import CategorySection from "./CategorySection.jsx";
import VendorModal from "./VendorModal.jsx";
import CategoryManagerModal from "./CategoryManagerModal.jsx";

const DEFAULT_CATEGORIES = [
  { key: "venue",       label: "Venue",                    cap: 0 },
  { key: "photo_video", label: "Photography / Videography", cap: 0 },
  { key: "band_dj",     label: "Live Band / DJ",            cap: 0 },
  { key: "gown",        label: "Gown Rental / Costume",     cap: 0 },
  { key: "prewed",      label: "Pre-wedding Shoot",         cap: 0 },
  { key: "florist",     label: "Florist / Decor",           cap: 0 },
  { key: "catering",    label: "Catering",                  cap: 0 },
  { key: "emcee",       label: "Emcee",                     cap: 0 },
  { key: "hmua",        label: "Hair & Makeup",             cap: 0 },
  { key: "cake",        label: "Wedding Cake",              cap: 0 },
  { key: "stationery",  label: "Invitations / Stationery",  cap: 0 },
  { key: "transport",   label: "Transport",                 cap: 0 },
  { key: "misc",        label: "Miscellaneous",             cap: 0 },
];

const styles = `
  .budget-tab { padding: 0; }
  .budget-uncategorised {
    margin-bottom: 20px;
    background: white; border-radius: var(--radius);
    padding: 16px 18px; box-shadow: var(--shadow);
    border: 1.5px dashed rgba(201,168,76,0.25);
  }
  .budget-uncategorised-title {
    font-size: 13px; font-weight: 500; color: var(--brown); opacity: 0.7; margin-bottom: 8px;
  }
  .budget-empty-cat {
    text-align: center; padding: 32px 20px; opacity: 0.45; color: var(--brown);
  }
  .budget-empty-cat .empty-icon { font-size: 28px; margin-bottom: 8px; }
  .budget-empty-cat .empty-text { font-size: 14px; }
`;

let demoVendors = [];
let demoNextId = 1;

export default function BudgetTab({ wedding, onSaveBudget, showToast, isCouple }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendorLoadError, setVendorLoadError] = useState(false);
  const [vendorModal, setVendorModal] = useState(null); // { mode: 'add'|'edit', vendor?, categoryKey? }
  const [catModal, setCatModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // vendor to delete

  const categories = wedding?.budget_categories ?? [];
  const overallCap = wedding?.overall_budget_cap ?? 0;

  const loadVendors = useCallback(async () => {
    if (isDemoMode) {
      setVendors([...demoVendors]);
      setLoading(false);
      return;
    }
    try {
      const data = await sb.listVendors();
      setVendors(data || []);
      setVendorLoadError(false);
    } catch {
      showToast("Failed to load vendors");
      setVendorLoadError(true);
    }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadVendors();
    if (isDemoMode) return;
    const unsub = sb.subscribeToChanges("vendors", loadVendors);
    return unsub;
  }, [loadVendors]);

  // Seed default categories on first open if none are set.
  // Deps intentionally narrowed to the wedding id: this must run once per wedding,
  // not on every `wedding` object refresh, and it reads the fresh row when it fires.
  useEffect(() => {
    if (!wedding || !isCouple) return;
    const cats = wedding.budget_categories;
    if (!cats || (Array.isArray(cats) && cats.length === 0)) {
      onSaveBudget({
        overall_budget_cap: wedding.overall_budget_cap ?? 0,
        budget_categories: DEFAULT_CATEGORIES,
      });
    }
  }, [wedding?.id, isCouple]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guard: couple only — placed after all hooks to satisfy rules-of-hooks.
  if (!isCouple) {
    return (
      <div className="empty">
        <div className="empty-icon">🔒</div>
        <div className="empty-text">Budget — Couple Access Only</div>
        <div className="empty-sub">This section is only visible to the couple.</div>
      </div>
    );
  }

  // ── Vendor CRUD ────────────────────────────────────────────────────────────

  const saveVendor = async (formData) => {
    try {
      if (vendorModal.mode === "add") {
        if (isDemoMode) {
          const v = { ...formData, id: `demo_${demoNextId++}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
          demoVendors = [...demoVendors, v];
          setVendors([...demoVendors]);
        } else {
          const v = await sb.insertVendor(formData);
          if (v) setVendors((prev) => [...prev, v]);
        }
        showToast("Vendor added");
      } else {
        const updated = { ...formData, updated_at: new Date().toISOString() };
        if (isDemoMode) {
          demoVendors = demoVendors.map((v) => (v.id === vendorModal.vendor.id ? { ...v, ...updated } : v));
          setVendors([...demoVendors]);
        } else {
          const v = await sb.updateVendor(vendorModal.vendor.id, formData);
          if (v) setVendors((prev) => prev.map((x) => (x.id === v.id ? v : x)));
        }
        showToast("Vendor updated");
      }
      setVendorModal(null); // only close on success
    } catch {
      showToast("Could not save vendor — check connection");
      // modal stays open so user can retry
    }
  };

  const confirmDelete = async (vendor) => {
    try {
      if (isDemoMode) {
        demoVendors = demoVendors.filter((v) => v.id !== vendor.id);
        setVendors([...demoVendors]);
      } else {
        await sb.deleteVendor(vendor.id);
        setVendors((prev) => prev.filter((v) => v.id !== vendor.id));
      }
      showToast(`${vendor.company_name} removed`);
    } catch {
      showToast("Could not delete vendor — check connection");
    }
    setDeleteConfirm(null);
  };

  const saveCategories = async (newCats) => {
    const ok = await onSaveBudget({ overall_budget_cap: overallCap, budget_categories: newCats });
    if (ok !== false) setCatModal(false);
  };

  const saveOverallCap = async (cap) => {
    onSaveBudget({ overall_budget_cap: cap, budget_categories: categories });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="empty">
        <div className="empty-icon">⏳</div>
        <div className="empty-text">Loading budget…</div>
      </div>
    );
  }

  // Distinguish a real load failure from a genuinely empty vendor list, so a
  // connectivity blip doesn't masquerade as "no vendors yet" (mirrors AdminApp's
  // guestLoadError retry state).
  if (vendorLoadError && vendors.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">⚠️</div>
        <div className="empty-text">Could not load vendors</div>
        <div className="empty-sub">
          Check your connection, then{" "}
          <button className="btn btn-outline btn-sm" style={{ marginLeft: 8 }} onClick={loadVendors}>Retry</button>
        </div>
      </div>
    );
  }

  const categorised = categories.map((cat) => ({
    cat,
    vendors: vendors.filter((v) => v.category_key === cat.key),
  }));

  const uncategorised = vendors.filter(
    (v) => !categories.some((c) => c.key === v.category_key)
  );

  return (
    <>
      <style>{styles}</style>
      <div className="budget-tab">

        <BudgetSummaryCard
          overallCap={overallCap}
          categories={categories}
          vendors={vendors}
          onEditCap={saveOverallCap}
          onManageCategories={() => setCatModal(true)}
        />

        {categorised.map(({ cat, vendors: catVendors }) => (
          <CategorySection
            key={cat.key}
            category={cat}
            vendors={catVendors}
            onAddVendor={(key) => setVendorModal({ mode: "add", categoryKey: key })}
            onEditVendor={(v) => setVendorModal({ mode: "edit", vendor: v })}
            onDeleteVendor={(v) => setDeleteConfirm(v)}
          />
        ))}

        {uncategorised.length > 0 && (
          <div className="budget-uncategorised">
            <div className="budget-uncategorised-title">Uncategorised vendors</div>
            {uncategorised.map((v) => (
              <div key={v.id} style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 13 }}>{v.company_name}</span>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ marginLeft: 10 }}
                  onClick={() => setVendorModal({ mode: "edit", vendor: v })}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}

        {categories.length === 0 && vendors.length === 0 && (
          <div className="budget-empty-cat">
            <div className="empty-icon">💰</div>
            <div className="empty-text">No categories yet — click "Manage categories" to add some.</div>
          </div>
        )}
      </div>

      {/* Vendor modal — pre-fill category_key when adding from a category section */}
      {vendorModal && (
        <VendorModal
          mode={vendorModal.mode}
          vendor={
            vendorModal.mode === "add"
              ? (vendorModal.categoryKey ? { category_key: vendorModal.categoryKey } : null)
              : (vendorModal.vendor ?? null)
          }
          categories={categories}
          onSave={saveVendor}
          onClose={() => setVendorModal(null)}
        />
      )}

      {/* Category manager modal */}
      {catModal && (
        <CategoryManagerModal
          categories={categories}
          vendors={vendors}
          onSave={saveCategories}
          onClose={() => setCatModal(false)}
          showToast={showToast}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Remove Vendor</div>
            <p style={{ fontSize: 14, color: "var(--charcoal)", lineHeight: 1.6, marginBottom: 16 }}>
              Remove <strong>{deleteConfirm.company_name}</strong>? All milestone data will be lost.
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                className="btn"
                style={{ background: "#c0392b", color: "white" }}
                onClick={() => confirmDelete(deleteConfirm)}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
