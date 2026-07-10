import { describe, it, expect } from "vitest";
import {
  computeDueDate,
  isTaskOverdue,
  checklistProgress,
  buildDefaultChecklist,
  DEFAULT_CHECKLIST_TEMPLATE,
  OFFSET_PRESETS,
} from "./checklistUtils.js";

const TODAY = "2026-07-10";

// ── computeDueDate ───────────────────────────────────────────────────────────

describe("computeDueDate", () => {
  it("subtracts the offset from the wedding date", () => {
    expect(computeDueDate("2026-12-12", -30)).toBe("2026-11-12");
  });

  it("handles offsets that cross a year boundary", () => {
    expect(computeDueDate("2026-01-15", -30)).toBe("2025-12-16");
  });

  it("handles a zero offset (due on the wedding date itself)", () => {
    expect(computeDueDate("2026-12-12", 0)).toBe("2026-12-12");
  });

  it("returns null when the wedding date is missing", () => {
    expect(computeDueDate(null, -30)).toBeNull();
    expect(computeDueDate("", -30)).toBeNull();
  });

  it("returns null when the offset is null or undefined ('no specific deadline')", () => {
    expect(computeDueDate("2026-12-12", null)).toBeNull();
    expect(computeDueDate("2026-12-12", undefined)).toBeNull();
  });

  it("recomputes automatically when the wedding date changes — no stored absolute date", () => {
    const before = computeDueDate("2026-12-12", -180);
    const after = computeDueDate("2027-06-01", -180);
    expect(before).not.toBe(after);
    expect(after).toBe("2026-12-03");
  });
});

// ── isTaskOverdue ────────────────────────────────────────────────────────────

describe("isTaskOverdue", () => {
  it("is overdue when the due date has passed and the task isn't done", () => {
    expect(isTaskOverdue("2026-07-01", false, TODAY)).toBe(true);
  });

  it("is not overdue when done, regardless of due date", () => {
    expect(isTaskOverdue("2026-01-01", true, TODAY)).toBe(false);
  });

  it("is not overdue when there is no due date", () => {
    expect(isTaskOverdue(null, false, TODAY)).toBe(false);
  });

  it("is not overdue when the due date is today or in the future", () => {
    expect(isTaskOverdue(TODAY, false, TODAY)).toBe(false);
    expect(isTaskOverdue("2026-08-01", false, TODAY)).toBe(false);
  });
});

// ── checklistProgress ────────────────────────────────────────────────────────

describe("checklistProgress", () => {
  it("returns zeroes for an empty checklist", () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 0, pct: 0 });
  });

  it("counts done vs total and rounds the percentage", () => {
    const items = [{ done: true }, { done: true }, { done: false }];
    expect(checklistProgress(items)).toEqual({ done: 2, total: 3, pct: 67 });
  });

  it("is 100% when every task is done", () => {
    const items = [{ done: true }, { done: true }];
    expect(checklistProgress(items)).toEqual({ done: 2, total: 2, pct: 100 });
  });
});

// ── buildDefaultChecklist ────────────────────────────────────────────────────

describe("buildDefaultChecklist", () => {
  it("instantiates one item per template task, all undone", () => {
    const items = buildDefaultChecklist();
    expect(items).toHaveLength(DEFAULT_CHECKLIST_TEMPLATE.length);
    expect(items.every((item) => item.done === false)).toBe(true);
  });

  it("assigns each item a unique id", () => {
    const items = buildDefaultChecklist();
    const ids = new Set(items.map((item) => item.id));
    expect(ids.size).toBe(items.length);
  });

  it("carries over the template's text/category/offset/assignee", () => {
    const items = buildDefaultChecklist();
    expect(items[0]).toMatchObject(DEFAULT_CHECKLIST_TEMPLATE[0]);
  });
});

// ── OFFSET_PRESETS ───────────────────────────────────────────────────────────

describe("OFFSET_PRESETS", () => {
  it("includes a 'no specific deadline' option with a null offset", () => {
    const noDeadline = OFFSET_PRESETS.find((p) => p.days === null);
    expect(noDeadline).toBeDefined();
  });

  it("is sorted furthest-in-advance first among dated presets", () => {
    const dated = OFFSET_PRESETS.filter((p) => p.days !== null).map((p) => p.days);
    const sorted = [...dated].sort((a, b) => a - b);
    expect(dated).toEqual(sorted);
  });
});
