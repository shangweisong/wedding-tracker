import { describe, it, expect } from "vitest";
import {
  vendorCommitted,
  vendorPaid,
  computeVendorMilestones,
  computeCategoryStats,
  computeOverallStats,
} from "./budgetUtils.js";

const TODAY = "2026-07-08";

const mkVendor = (overrides = {}) => ({
  id: "v1",
  category_key: "photo",
  company_name: "Test Vendor",
  status: "booked",
  quoted_price: 0,
  is_fully_paid: false,
  milestones: [],
  ...overrides,
});

// ── vendorCommitted ────────────────────────────────────────────────────────────

describe("vendorCommitted", () => {
  it("returns quoted_price for booked vendor", () => {
    expect(vendorCommitted(mkVendor({ quoted_price: 5000, status: "booked" }))).toBe(5000);
  });

  it("returns 0 for enquiring vendor regardless of quoted_price", () => {
    expect(vendorCommitted(mkVendor({ quoted_price: 5000, status: "enquiring" }))).toBe(0);
  });

  it("returns 0 when quoted_price is missing", () => {
    expect(vendorCommitted(mkVendor({ quoted_price: undefined }))).toBe(0);
  });
});

// ── vendorPaid ─────────────────────────────────────────────────────────────────

describe("vendorPaid", () => {
  it("sums only paid milestones", () => {
    const v = mkVendor({
      milestones: [
        { amount: 1000, paid: true },
        { amount: 2000, paid: false },
      ],
    });
    expect(vendorPaid(v)).toBe(1000);
  });

  it("returns 0 with no milestones", () => {
    expect(vendorPaid(mkVendor())).toBe(0);
  });

  it("returns quoted_price when is_fully_paid regardless of milestones", () => {
    const v = mkVendor({
      quoted_price: 5000,
      is_fully_paid: true,
      milestones: [{ amount: 1000, paid: true }],
    });
    expect(vendorPaid(v)).toBe(5000);
  });

  it("returns 0 when is_fully_paid but quoted_price is 0", () => {
    expect(vendorPaid(mkVendor({ is_fully_paid: true, quoted_price: 0 }))).toBe(0);
  });
});

// ── computeVendorMilestones ────────────────────────────────────────────────────

describe("computeVendorMilestones", () => {
  it("returns all zeroes for empty milestones", () => {
    const r = computeVendorMilestones([], TODAY);
    expect(r).toEqual({ total: 0, paid: 0, balance: 0, overdueCount: 0, nextDue: null });
  });

  it("sums all milestone amounts as total regardless of paid status", () => {
    const milestones = [
      { label: "Deposit", amount: 1000, due_date: "2026-01-01", paid: true },
      { label: "Final",   amount: 2000, due_date: "2026-08-01", paid: false },
    ];
    expect(computeVendorMilestones(milestones, TODAY).total).toBe(3000);
  });

  it("sums only paid milestones as paid", () => {
    const milestones = [
      { label: "Deposit", amount: 1000, due_date: "2026-01-01", paid: true },
      { label: "Final",   amount: 2000, due_date: "2026-08-01", paid: false },
    ];
    expect(computeVendorMilestones(milestones, TODAY).paid).toBe(1000);
  });

  it("computes balance as total minus paid", () => {
    const milestones = [
      { label: "Deposit",  amount: 500,  due_date: "2026-01-01", paid: true },
      { label: "Midpoint", amount: 500,  due_date: "2026-04-01", paid: true },
      { label: "Final",    amount: 1000, due_date: "2026-08-01", paid: false },
    ];
    expect(computeVendorMilestones(milestones, TODAY).balance).toBe(1000);
  });

  it("counts overdue as unpaid milestones with due_date before today", () => {
    const milestones = [
      { label: "A", amount: 500, due_date: "2026-01-01", paid: false },
      { label: "B", amount: 500, due_date: "2026-06-01", paid: false },
      { label: "C", amount: 500, due_date: "2026-09-01", paid: false },
    ];
    expect(computeVendorMilestones(milestones, TODAY).overdueCount).toBe(2);
  });

  it("does not count paid milestones as overdue", () => {
    const milestones = [{ label: "D", amount: 500, due_date: "2026-01-01", paid: true }];
    expect(computeVendorMilestones(milestones, TODAY).overdueCount).toBe(0);
  });

  it("returns nextDue as earliest unpaid milestone with a date", () => {
    const milestones = [
      { label: "Far",    amount: 500, due_date: "2026-12-01", paid: false },
      { label: "Sooner", amount: 500, due_date: "2026-08-01", paid: false },
    ];
    expect(computeVendorMilestones(milestones, TODAY).nextDue?.label).toBe("Sooner");
  });

  it("returns nextDue null when no unpaid milestone has a date", () => {
    const milestones = [{ label: "TBD", amount: 500, due_date: "", paid: false }];
    expect(computeVendorMilestones(milestones, TODAY).nextDue).toBeNull();
  });

  it("treats non-numeric amount strings as 0", () => {
    const milestones = [{ label: "TBD", amount: "", due_date: "", paid: false }];
    expect(computeVendorMilestones(milestones, TODAY).total).toBe(0);
  });
});

// ── computeCategoryStats ───────────────────────────────────────────────────────

const CAT_PHOTO = { key: "photo", label: "Photography", cap: 5000 };
const CAT_VENUE = { key: "venue", label: "Venue",       cap: 10000 };
const CAT_MISC  = { key: "misc",  label: "Misc",        cap: 0 };

describe("computeCategoryStats", () => {
  it("returns zeros for categories with no vendors", () => {
    const r = computeCategoryStats([CAT_PHOTO], []);
    expect(r[0]).toMatchObject({ committed: 0, paid: 0, isOverBudget: false });
  });

  it("uses quoted_price as committed", () => {
    const vendors = [mkVendor({ category_key: "photo", quoted_price: 6000 })];
    const r = computeCategoryStats([CAT_PHOTO], vendors);
    expect(r[0].committed).toBe(6000);
    expect(r[0].isOverBudget).toBe(true);
  });

  it("does not flag isOverBudget when cap is 0", () => {
    const vendors = [mkVendor({ category_key: "misc", quoted_price: 99999 })];
    const r = computeCategoryStats([CAT_MISC], vendors);
    expect(r[0].isOverBudget).toBe(false);
  });

  it("counts vendors only in their matching category", () => {
    const vendors = [
      mkVendor({ category_key: "photo", quoted_price: 3000 }),
      mkVendor({ category_key: "venue", quoted_price: 8000 }),
    ];
    const r = computeCategoryStats([CAT_PHOTO, CAT_VENUE], vendors);
    expect(r[0].committed).toBe(3000);
    expect(r[1].committed).toBe(8000);
  });

  it("counts only paid milestones as paid", () => {
    const vendors = [
      mkVendor({
        category_key: "photo",
        quoted_price: 3000,
        milestones: [
          { amount: 1000, paid: true },
          { amount: 2000, paid: false },
        ],
      }),
    ];
    const r = computeCategoryStats([CAT_PHOTO], vendors);
    expect(r[0].paid).toBe(1000);
    expect(r[0].committed).toBe(3000);
  });
});

// ── computeOverallStats ────────────────────────────────────────────────────────

describe("computeOverallStats", () => {
  it("returns zeros for empty vendor list", () => {
    expect(computeOverallStats(18000, [])).toEqual({
      totalCommitted: 0, totalPaid: 0, isOverBudget: false,
    });
  });

  it("flags isOverBudget when totalCommitted exceeds overallCap", () => {
    const vendors = [
      mkVendor({ quoted_price: 10000 }),
      mkVendor({ quoted_price: 10000 }),
    ];
    const r = computeOverallStats(18000, vendors);
    expect(r.isOverBudget).toBe(true);
    expect(r.totalCommitted).toBe(20000);
  });

  it("does not flag isOverBudget when overallCap is 0", () => {
    const vendors = [mkVendor({ quoted_price: 99999 })];
    expect(computeOverallStats(0, vendors).isOverBudget).toBe(false);
  });

  it("sums only paid milestones as totalPaid", () => {
    const vendors = [
      mkVendor({
        quoted_price: 1000,
        milestones: [{ amount: 500, paid: true }, { amount: 500, paid: false }],
      }),
    ];
    const r = computeOverallStats(5000, vendors);
    expect(r.totalPaid).toBe(500);
    expect(r.totalCommitted).toBe(1000);
  });
});
