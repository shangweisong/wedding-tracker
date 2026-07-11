import { useState } from "react";
import { computeCategoryStats, computeOverallStats, fmtMoney } from "../lib/budgetUtils.js";

const styles = `
  .budget-summary-card {
    background: var(--charcoal); border-radius: var(--radius);
    padding: 24px 28px; margin-bottom: 24px;
    border: 1px solid rgba(201,168,76,0.2);
  }
  .budget-summary-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 20px;
  }
  .budget-summary-title {
    font-family: 'Cormorant Garamond', serif; font-size: 18px;
    color: var(--gold-light); font-weight: 400;
  }

  /* ── Total budget cap ── */
  .budget-cap-row { margin-bottom: 16px; }
  .budget-cap-display { display: flex; align-items: baseline; gap: 10px; }
  .budget-big-num {
    font-family: 'Cormorant Garamond', serif; font-size: 34px;
    color: var(--gold-light); font-weight: 400; line-height: 1;
  }
  .budget-big-label {
    font-size: 12px; color: rgba(255,255,255,0.35);
    text-transform: uppercase; letter-spacing: 0.1em;
  }

  /* ── Three-segment execution bar ── */
  .budget-exec-bar {
    display: flex; height: 10px; border-radius: 5px;
    background: rgba(255,255,255,0.07); overflow: hidden;
    margin-bottom: 10px;
  }
  .budget-exec-bar-seg { height: 100%; transition: width 0.4s ease; }
  .budget-exec-stats {
    display: flex; gap: 0; flex-wrap: wrap;
    margin-bottom: 4px;
  }
  .exec-stat {
    display: flex; align-items: center; gap: 5px;
    font-size: 12px; color: rgba(255,255,255,0.55);
    padding-right: 16px;
  }
  .exec-stat.over { color: #f1948a; }
  .exec-dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  }
  .exec-stat strong { color: rgba(255,255,255,0.85); font-weight: 500; }

  /* ── Category planning ── */
  .budget-planning-section {
    margin-top: 18px; padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.07);
  }
  .budget-planning-header {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 8px;
  }
  .budget-planning-title {
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;
    color: rgba(255,255,255,0.35);
  }
  .budget-planning-amount {
    font-size: 12px; color: rgba(255,255,255,0.6);
  }
  .budget-planning-amount.over { color: #f1948a; }
  .budget-plan-bar {
    height: 5px; border-radius: 3px;
    background: rgba(255,255,255,0.07); overflow: hidden;
    margin-bottom: 6px;
  }
  .budget-plan-bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
  .budget-planning-sub {
    font-size: 11px; color: rgba(255,255,255,0.3);
  }

  /* ── Per-category rows ── */
  .budget-cat-list {
    margin-top: 18px; padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.07);
    display: flex; flex-direction: column; gap: 6px;
  }
  .budget-cat-row {
    display: grid; grid-template-columns: 1fr 110px 130px;
    gap: 8px; align-items: center;
    padding: 5px 0;
  }
  .budget-cat-name { font-size: 13px; color: rgba(255,255,255,0.7); }
  .budget-cat-name.over { color: #f1948a; }
  .budget-cat-amounts { font-size: 12px; color: rgba(255,255,255,0.4); text-align: right; }
  .budget-cat-bar-wrap {
    position: relative; height: 4px;
    background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;
  }
  .budget-cat-bar-fill {
    position: absolute; left: 0; top: 0; height: 100%;
    border-radius: 2px; transition: width 0.3s ease;
  }

  /* ── Cap editing ── */
  .cap-edit-form { display: flex; align-items: center; gap: 8px; }
  .cap-edit-input {
    width: 130px; padding: 6px 10px; border-radius: 6px;
    border: 1.5px solid rgba(201,168,76,0.4); background: rgba(255,255,255,0.08);
    color: white; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none;
  }
  .cap-edit-input:focus { border-color: var(--gold); }
  .cap-save-btn {
    padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer;
    background: var(--gold); color: #1a1a1a; font-size: 12px; font-weight: 600;
  }
  .cap-cancel-btn {
    padding: 6px 10px; border-radius: 6px; border: none; cursor: pointer;
    background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); font-size: 12px;
  }
  .cap-hint-btn {
    background: none; border: none; cursor: pointer;
    color: rgba(255,255,255,0.3); font-size: 11px; letter-spacing: 0.05em;
    text-decoration: underline; font-family: 'DM Sans', sans-serif; padding: 0;
    transition: color 0.15s;
  }
  .cap-hint-btn:hover { color: var(--gold-light); }

  @media (max-width: 640px) {
    .budget-summary-card { padding: 16px 18px; }
    .budget-cat-row { grid-template-columns: 1fr auto; }
    .budget-cat-bar-wrap { grid-column: 1 / -1; margin-top: 1px; }
    .budget-cat-amounts { text-align: left; font-size: 11px; }
  }
`;

export default function BudgetSummaryCard({
  overallCap,
  categories,
  vendors,
  onEditCap,
  onManageCategories,
}) {
  const [editingCap, setEditingCap] = useState(false);
  const [capInput, setCapInput] = useState("");

  const { totalCommitted, totalPaid, isOverBudget } = computeOverallStats(overallCap, vendors);
  const catStats = computeCategoryStats(categories, vendors);

  const totalToPayOut = Math.max(0, totalCommitted - totalPaid);
  const available = overallCap > 0 ? overallCap - totalCommitted : 0;

  // Three-segment bar — each as % of overallCap, capped so they don't overflow visually
  const paidPct      = overallCap > 0 ? Math.min(100, (totalPaid      / overallCap) * 100) : 0;
  const toPayPct     = overallCap > 0 ? Math.min(100 - paidPct, (totalToPayOut / overallCap) * 100) : 0;

  // Category planning — only categories with a cap set count
  const cappedCats       = categories.filter((c) => c.cap > 0);
  const categoryAllocated = cappedCats.reduce((s, c) => s + c.cap, 0);
  const isOverPlanned    = overallCap > 0 && categoryAllocated > overallCap;
  const unplanned        = overallCap > 0 ? overallCap - categoryAllocated : 0;
  const planPct          = overallCap > 0 ? Math.min(100, (categoryAllocated / overallCap) * 100) : 0;

  const startEditCap = () => {
    setCapInput(overallCap > 0 ? String(overallCap) : "");
    setEditingCap(true);
  };
  const saveCap = () => {
    // Clamp to non-negative: min="0" is only a UI hint; a pasted/typed negative
    // would otherwise persist ("-500" is truthy, so `|| 0` doesn't catch it).
    onEditCap(Math.max(0, Number(capInput) || 0));
    setEditingCap(false);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="budget-summary-card">

        {/* Header */}
        <div className="budget-summary-header">
          <div className="budget-summary-title">Budget Overview</div>
          <button className="cap-hint-btn" onClick={onManageCategories}>
            Manage categories →
          </button>
        </div>

        {/* Total budget */}
        <div className="budget-cap-row">
          {editingCap ? (
            <div className="cap-edit-form">
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Total budget $</span>
              <input
                className="cap-edit-input"
                type="number"
                min="0"
                autoFocus
                value={capInput}
                onChange={(e) => setCapInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCap();
                  if (e.key === "Escape") setEditingCap(false);
                }}
              />
              <button className="cap-save-btn" onClick={saveCap}>OK</button>
              <button className="cap-cancel-btn" onClick={() => setEditingCap(false)}>✕</button>
            </div>
          ) : (
            <div className="budget-cap-display">
              <div className="budget-big-num">
                {overallCap > 0 ? fmtMoney(overallCap) : "—"}
              </div>
              <div className="budget-big-label">total budget</div>
              <button className="cap-hint-btn" onClick={startEditCap}>
                {overallCap > 0 ? "edit" : "set budget"}
              </button>
            </div>
          )}
        </div>

        {/* Three-segment execution bar + stats */}
        {overallCap > 0 && (
          <>
            <div className="budget-exec-bar">
              <div
                className="budget-exec-bar-seg"
                style={{ width: `${paidPct}%`, background: "#82d9a0" }}
              />
              <div
                className="budget-exec-bar-seg"
                style={{
                  width: `${toPayPct}%`,
                  background: isOverBudget ? "#f1948a" : "var(--gold)",
                }}
              />
            </div>

            <div className="budget-exec-stats">
              <span className="exec-stat">
                <span className="exec-dot" style={{ background: "#82d9a0" }} />
                <strong>{fmtMoney(totalPaid)}</strong>&nbsp;paid
              </span>
              {totalToPayOut > 0 && (
                <span className="exec-stat">
                  <span className="exec-dot" style={{ background: isOverBudget ? "#f1948a" : "var(--gold)" }} />
                  <strong>{fmtMoney(totalToPayOut)}</strong>&nbsp;to pay
                </span>
              )}
              <span className={`exec-stat ${isOverBudget ? "over" : ""}`}>
                <span className="exec-dot" style={{ background: isOverBudget ? "#f1948a" : "rgba(255,255,255,0.2)" }} />
                {isOverBudget ? (
                  <><strong>{fmtMoney(Math.abs(available))}</strong>&nbsp;over budget ⚠</>
                ) : (
                  <><strong>{fmtMoney(available)}</strong>&nbsp;available</>
                )}
              </span>
            </div>

            {/* Category planning section */}
            {cappedCats.length > 0 && (
              <div className="budget-planning-section">
                <div className="budget-planning-header">
                  <span className="budget-planning-title">Category budgets</span>
                  <span className={`budget-planning-amount ${isOverPlanned ? "over" : ""}`}>
                    {fmtMoney(categoryAllocated)} planned of {fmtMoney(overallCap)}
                    {isOverPlanned && " ⚠"}
                  </span>
                </div>
                <div className="budget-plan-bar">
                  <div
                    className="budget-plan-bar-fill"
                    style={{
                      width: `${planPct}%`,
                      background: isOverPlanned ? "#f1948a" : "rgba(201,168,76,0.55)",
                    }}
                  />
                </div>
                <div className="budget-planning-sub">
                  {cappedCats.length} {cappedCats.length === 1 ? "category" : "categories"} with budgets set
                  {!isOverPlanned && unplanned > 0 && (
                    <> · <span style={{ color: "rgba(255,255,255,0.45)" }}>{fmtMoney(unplanned)} unplanned</span></>
                  )}
                  {isOverPlanned && (
                    <> · <span style={{ color: "#f1948a" }}>categories exceed total budget by {fmtMoney(categoryAllocated - overallCap)}</span></>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Per-category breakdown */}
        {catStats.length > 0 && (
          <div className="budget-cat-list">
            {catStats.map(({ category, committed, isOverBudget: catOver }) => {
              const catPct = category.cap > 0
                ? Math.min(100, (committed / category.cap) * 100)
                : committed > 0 ? 100 : 0;
              const catColor = catOver ? "#f1948a" : catPct > 80 ? "#f0c060" : "var(--gold)";
              return (
                <div key={category.key} className="budget-cat-row">
                  <div className={`budget-cat-name ${catOver ? "over" : ""}`}>
                    {category.label}{catOver && " ⚠"}
                  </div>
                  <div className="budget-cat-amounts">
                    {fmtMoney(committed)}
                    {category.cap > 0 && (
                      <span style={{ opacity: 0.5 }}> / {fmtMoney(category.cap)}</span>
                    )}
                  </div>
                  <div className="budget-cat-bar-wrap">
                    <div
                      className="budget-cat-bar-fill"
                      style={{ width: `${catPct}%`, background: catColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </>
  );
}
