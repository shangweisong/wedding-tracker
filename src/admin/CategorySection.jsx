import { useState } from "react";
import VendorCard from "./VendorCard.jsx";
import { fmtMoney, computeCategoryStats } from "../lib/budgetUtils.js";

const styles = `
  .cat-section { margin-bottom: 20px; }
  .cat-section-header {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; border-radius: 8px; cursor: pointer;
    background: white; box-shadow: var(--shadow);
    border: 1.5px solid rgba(201,168,76,0.15);
    transition: border-color 0.15s; margin-bottom: 8px;
    user-select: none;
  }
  .cat-section-header:hover { border-color: rgba(201,168,76,0.35); }
  .cat-section-header.over-budget { border-color: rgba(241,148,138,0.5); }
  .cat-section-title { flex: 1; font-size: 14px; font-weight: 500; color: var(--charcoal); }
  .cat-section-meta { font-size: 12px; color: var(--brown); opacity: 0.65; }
  .cat-section-meta.over { color: var(--red); opacity: 1; font-weight: 500; }
  .cat-chevron { font-size: 12px; color: var(--brown); opacity: 0.4; transition: transform 0.2s; }
  .cat-chevron.open { transform: rotate(90deg); }
  .cat-vendor-list { display: flex; flex-direction: column; gap: 8px; padding-left: 8px; }
  .cat-add-btn {
    display: flex; align-items: center; gap: 6px; width: 100%;
    padding: 9px 14px; border-radius: 8px; border: 1.5px dashed rgba(201,168,76,0.3);
    background: transparent; cursor: pointer; font-family: 'DM Sans', sans-serif;
    font-size: 12px; color: var(--brown); opacity: 0.7; transition: all 0.15s;
  }
  .cat-add-btn:hover { opacity: 1; border-color: var(--gold); background: rgba(201,168,76,0.04); }

  @media (max-width: 640px) {
    .cat-section-header { flex-wrap: wrap; row-gap: 4px; }
    .cat-chevron { order: 2; align-self: flex-start; }
    .cat-section-meta { order: 3; flex: 0 0 100%; font-size: 11px; }
  }
`;

export default function CategorySection({
  category,
  vendors,
  onAddVendor,
  onEditVendor,
  onDeleteVendor,
}) {
  const [open, setOpen] = useState(true);

  const [{ isOverBudget, committed, paid }] = computeCategoryStats([category], vendors);

  return (
    <>
      <style>{styles}</style>
      <div className="cat-section">
        <div
          className={`cat-section-header ${isOverBudget ? "over-budget" : ""}`}
          onClick={() => setOpen((o) => !o)}
        >
          <div className="cat-section-title">
            {category.label}
            {isOverBudget && " ⚠"}
          </div>
          <div className={`cat-section-meta ${isOverBudget ? "over" : ""}`}>
            {fmtMoney(committed)} committed
            {category.cap > 0 && ` / ${fmtMoney(category.cap)} cap`}
            {paid > 0 && ` · ${fmtMoney(paid)} paid`}
            {vendors.length > 0 && ` · ${vendors.length} vendor${vendors.length !== 1 ? "s" : ""}`}
          </div>
          <span className={`cat-chevron ${open ? "open" : ""}`}>▶</span>
        </div>

        {open && (
          <div className="cat-vendor-list">
            {vendors.map((v) => (
              <VendorCard
                key={v.id}
                vendor={v}
                onEdit={() => onEditVendor(v)}
                onDelete={() => onDeleteVendor(v)}
              />
            ))}
            <button
              type="button"
              className="cat-add-btn"
              onClick={() => onAddVendor(category.key)}
            >
              + Add vendor to {category.label}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
