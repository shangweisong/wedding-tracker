// Pure budget computation functions — no side effects, fully testable.
// Milestone shape: { label: string, amount: number, due_date: string, paid: boolean }
// BudgetCategory shape: { key: string, label: string, cap: number }
// Vendor shape: { id, category_key, company_name, quoted_price, milestones: Milestone[], ... }
//
// committed = quoted_price (the agreed contract total).
// paid      = sum of milestones marked paid (optional payment breakdown).

/** How much a vendor has been contracted for.
 *  Enquiring vendors are $0 — not committed until booked. */
export function vendorCommitted(vendor) {
  if (vendor.status === "enquiring") return 0;
  return Number(vendor.quoted_price) || 0;
}

/** How much has been paid.
 *  is_fully_paid overrides milestone totals — returns the full quoted price. */
export function vendorPaid(vendor) {
  if (vendor.is_fully_paid) return Number(vendor.quoted_price) || 0;
  return (vendor.milestones ?? [])
    .filter((m) => m.paid)
    .reduce((s, m) => s + (Number(m.amount) || 0), 0);
}

/**
 * Derive display fields for a single vendor's milestone list.
 * Pass todayISO (YYYY-MM-DD) to make overdue detection deterministic in tests.
 */
export function computeVendorMilestones(milestones, todayISO) {
  const today = todayISO ?? new Date().toISOString().slice(0, 10);
  const total = milestones.reduce((s, m) => s + (Number(m.amount) || 0), 0);
  const paid  = milestones
    .filter((m) => m.paid)
    .reduce((s, m) => s + (Number(m.amount) || 0), 0);
  const balance = total - paid;
  const overdueCount = milestones.filter(
    (m) => !m.paid && m.due_date && m.due_date < today
  ).length;
  const nextDue = milestones
    .filter((m) => !m.paid && m.due_date)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ?? null;

  return { total, paid, balance, overdueCount, nextDue };
}

/**
 * Per-category spend breakdown.
 * Returns array of { category, committed, paid, isOverBudget }.
 * committed = sum of quoted_price across vendors in that category.
 * paid      = sum of paid milestones only.
 */
export function computeCategoryStats(categories, vendors) {
  return categories.map((cat) => {
    const catVendors = vendors.filter((v) => v.category_key === cat.key);
    const committed = catVendors.reduce((s, v) => s + vendorCommitted(v), 0);
    const paid      = catVendors.reduce((s, v) => s + vendorPaid(v), 0);
    const isOverBudget = cat.cap > 0 && committed > cat.cap;
    return { category: cat, committed, paid, isOverBudget };
  });
}

/**
 * Top-level budget summary across all vendors.
 */
export function computeOverallStats(overallCap, vendors) {
  const totalCommitted = vendors.reduce((s, v) => s + vendorCommitted(v), 0);
  const totalPaid      = vendors.reduce((s, v) => s + vendorPaid(v), 0);
  const isOverBudget   = overallCap > 0 && totalCommitted > overallCap;
  return { totalCommitted, totalPaid, isOverBudget };
}

/** Format a number as a dollar amount with thousands separator. */
export function fmtMoney(n) {
  if (!n && n !== 0) return "$0";
  return "$" + Math.round(n).toLocaleString();
}
