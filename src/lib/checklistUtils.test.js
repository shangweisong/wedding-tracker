import { describe, it, expect } from "vitest";
import {
  computeDueDate,
  resolveDueDate,
  isTaskOverdue,
  checklistProgress,
  buildDefaultChecklist,
  DEFAULT_CHECKLIST_TEMPLATE,
  OFFSET_PRESETS,
  REMINDER_PRESETS,
  taskReminders,
  computeReminderDate,
  isReminderDue,
  selectDueReminders,
  usedCategories,
  matchesCategoryFilter,
  dueDateCommitPatch,
} from "./checklistUtils.js";

const TODAY = "2026-07-10";

// ── dueDateCommitPatch ───────────────────────────────────────────────────────

describe("dueDateCommitPatch", () => {
  it("pins a valid date without touching reminders", () => {
    expect(dueDateCommitPatch("2026-09-01")).toEqual({ dueDate: "2026-09-01" });
  });

  it("normalizes surrounding whitespace", () => {
    expect(dueDateCommitPatch(" 2026-09-01 ")).toEqual({ dueDate: "2026-09-01" });
  });

  it("clears the deadline and reminders together when the input is emptied", () => {
    expect(dueDateCommitPatch("")).toEqual({ dueDate: null, reminders: [] });
  });

  it("treats invalid values as a clear (impossible calendar date, garbage, null)", () => {
    expect(dueDateCommitPatch("2026-02-30")).toEqual({ dueDate: null, reminders: [] });
    expect(dueDateCommitPatch("not-a-date")).toEqual({ dueDate: null, reminders: [] });
    expect(dueDateCommitPatch(null)).toEqual({ dueDate: null, reminders: [] });
  });
});

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

// ── resolveDueDate ───────────────────────────────────────────────────────────

describe("resolveDueDate", () => {
  it("returns the exact date when dueDate is set", () => {
    expect(resolveDueDate("2026-12-12", { dueDate: "2026-03-17", dueOffsetDays: null })).toBe("2026-03-17");
  });

  it("resolves an exact date even when the wedding date is unset", () => {
    expect(resolveDueDate(null, { dueDate: "2026-03-17", dueOffsetDays: null })).toBe("2026-03-17");
  });

  it("prefers the exact date when both fields are set (legacy/raced saves)", () => {
    expect(resolveDueDate("2026-12-12", { dueDate: "2026-03-17", dueOffsetDays: -30 })).toBe("2026-03-17");
  });

  it("falls back to the offset when dueDate is absent or null", () => {
    expect(resolveDueDate("2026-12-12", { dueOffsetDays: -30 })).toBe("2026-11-12");
    expect(resolveDueDate("2026-12-12", { dueDate: null, dueOffsetDays: -30 })).toBe("2026-11-12");
  });

  it("falls back to the offset when dueDate is invalid or corrupt", () => {
    expect(resolveDueDate("2026-12-12", { dueDate: "2026-13-45", dueOffsetDays: -30 })).toBe("2026-11-12");
    expect(resolveDueDate("2026-12-12", { dueDate: "banana", dueOffsetDays: -30 })).toBe("2026-11-12");
    expect(resolveDueDate("2026-12-12", { dueDate: "", dueOffsetDays: -30 })).toBe("2026-11-12");
  });

  it("returns null when neither field resolves", () => {
    expect(resolveDueDate("2026-12-12", { dueDate: null, dueOffsetDays: null })).toBeNull();
    expect(resolveDueDate(null, { dueOffsetDays: -30 })).toBeNull();
  });

  it("tolerates a null or undefined task", () => {
    expect(resolveDueDate("2026-12-12", null)).toBeNull();
    expect(resolveDueDate("2026-12-12", undefined)).toBeNull();
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

// ── REMINDER_PRESETS ─────────────────────────────────────────────────────────

describe("REMINDER_PRESETS", () => {
  it("only offers due-relative offsets at or before the due date (days <= 0)", () => {
    expect(REMINDER_PRESETS.length).toBeGreaterThan(0);
    expect(REMINDER_PRESETS.every((p) => Number.isInteger(p.days) && p.days <= 0)).toBe(true);
  });

  it("includes an on-due-date option and is sorted furthest-in-advance first", () => {
    expect(REMINDER_PRESETS.some((p) => p.days === 0)).toBe(true);
    const days = REMINDER_PRESETS.map((p) => p.days);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });
});

// ── taskReminders ────────────────────────────────────────────────────────────

describe("taskReminders", () => {
  it("returns the reminders array when present", () => {
    const reminders = [{ id: "r1", offsetDays: -7 }];
    expect(taskReminders({ reminders })).toBe(reminders);
  });

  it("returns [] for tasks without a reminders field (pre-existing checklists)", () => {
    expect(taskReminders({})).toEqual([]);
    expect(taskReminders({ reminders: null })).toEqual([]);
    expect(taskReminders({ reminders: "bogus" })).toEqual([]);
  });
});

// ── computeReminderDate ──────────────────────────────────────────────────────

describe("computeReminderDate", () => {
  it("resolves the reminder date relative to the task's resolved due date", () => {
    // due = 2026-11-12; reminder 7d before due = 2026-11-05
    expect(computeReminderDate("2026-11-12", -7)).toBe("2026-11-05");
  });

  it("supports an on-due-date reminder (offset 0)", () => {
    expect(computeReminderDate("2026-11-12", 0)).toBe("2026-11-12");
  });

  it("returns null when the task has no resolved due date", () => {
    expect(computeReminderDate(null, -7)).toBeNull();
    expect(computeReminderDate("", -7)).toBeNull();
    expect(computeReminderDate(undefined, -7)).toBeNull();
  });

  it("returns null when the reminder offset is missing — null must not coerce to 0", () => {
    expect(computeReminderDate("2026-11-12", null)).toBeNull();
    expect(computeReminderDate("2026-11-12", undefined)).toBeNull();
  });
});

// ── isReminderDue ────────────────────────────────────────────────────────────

describe("isReminderDue", () => {
  it("is due when the reminder date is today", () => {
    expect(isReminderDue(TODAY, TODAY, false)).toBe(true);
  });

  it("is due when the reminder date has passed (missed cron day fires late, not never)", () => {
    expect(isReminderDue("2026-07-01", TODAY, false)).toBe(true);
  });

  it("is not due for future dates, done tasks, or missing dates", () => {
    expect(isReminderDue("2026-08-01", TODAY, false)).toBe(false);
    expect(isReminderDue(TODAY, TODAY, true)).toBe(false);
    expect(isReminderDue(null, TODAY, false)).toBe(false);
  });
});

// ── selectDueReminders ───────────────────────────────────────────────────────

describe("selectDueReminders", () => {
  const WEDDING = "2026-08-09"; // due for -30 = 2026-07-10 = TODAY
  const task = (overrides) => ({
    id: "t1",
    text: "Book florist",
    category: "Venue & Vendors",
    dueOffsetDays: -30,
    assignee: "both",
    done: false,
    ...overrides,
  });

  it("selects a not-done task whose reminder date is today", () => {
    const checklist = [task({ reminders: [{ id: "r1", offsetDays: 0 }] })];
    const due = selectDueReminders(checklist, WEDDING, new Set(), TODAY);
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({
      task: { id: "t1" },
      reminder: { id: "r1" },
      reminderDate: TODAY,
      dueDate: TODAY,
    });
  });

  it("includes catch-up reminders whose date passed but were never sent", () => {
    const checklist = [task({ reminders: [{ id: "r1", offsetDays: -7 }] })];
    const due = selectDueReminders(checklist, WEDDING, new Set(), TODAY);
    expect(due).toHaveLength(1);
    expect(due[0].reminderDate).toBe("2026-07-03");
  });

  it("excludes reminders already in the sent set", () => {
    const checklist = [task({ reminders: [{ id: "r1", offsetDays: 0 }] })];
    const due = selectDueReminders(checklist, WEDDING, new Set(["t1:r1"]), TODAY);
    expect(due).toEqual([]);
  });

  it("excludes done tasks and future reminders", () => {
    const checklist = [
      task({ id: "t1", done: true, reminders: [{ id: "r1", offsetDays: 0 }] }),
      task({ id: "t2", dueOffsetDays: -1, reminders: [{ id: "r2", offsetDays: 0 }] }),
    ];
    expect(selectDueReminders(checklist, WEDDING, new Set(), TODAY)).toEqual([]);
  });

  it("excludes tasks with no due date even if stale reminders linger", () => {
    const checklist = [task({ dueOffsetDays: null, reminders: [{ id: "r1", offsetDays: -7 }] })];
    expect(selectDueReminders(checklist, WEDDING, new Set(), TODAY)).toEqual([]);
  });

  it("returns one entry per due reminder, across tasks and within a task", () => {
    const checklist = [
      task({ reminders: [{ id: "r1", offsetDays: -7 }, { id: "r2", offsetDays: 0 }] }),
      task({ id: "t2", dueOffsetDays: -60, reminders: [{ id: "r3", offsetDays: -14 }] }),
    ];
    const due = selectDueReminders(checklist, WEDDING, new Set(), TODAY);
    expect(due.map((d) => d.reminder.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("tolerates tasks without a reminders field and empty inputs", () => {
    expect(selectDueReminders([task()], WEDDING, new Set(), TODAY)).toEqual([]);
    expect(selectDueReminders([], WEDDING, new Set(), TODAY)).toEqual([]);
    expect(selectDueReminders(null, WEDDING, new Set(), TODAY)).toEqual([]);
  });

  it("returns nothing for offset-based tasks when the wedding date is unset", () => {
    const checklist = [task({ reminders: [{ id: "r1", offsetDays: 0 }] })];
    expect(selectDueReminders(checklist, null, new Set(), TODAY)).toEqual([]);
  });

  it("fires exact-date task reminders even when the wedding date is unset", () => {
    const checklist = [
      task({ dueOffsetDays: null, dueDate: TODAY, reminders: [{ id: "r1", offsetDays: 0 }] }),
    ];
    const due = selectDueReminders(checklist, null, new Set(), TODAY);
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ reminderDate: TODAY, dueDate: TODAY });
  });

  it("handles a mixed checklist of offset and exact-date tasks", () => {
    const checklist = [
      task({ reminders: [{ id: "r1", offsetDays: 0 }] }), // offset: due TODAY
      task({
        id: "t2",
        dueOffsetDays: null,
        dueDate: "2026-07-05",
        reminders: [{ id: "r2", offsetDays: -3 }], // fires 2026-07-02, past ⇒ catch-up
      }),
    ];
    const due = selectDueReminders(checklist, WEDDING, new Set(), TODAY);
    expect(due.map((d) => [d.reminder.id, d.dueDate])).toEqual([
      ["r1", TODAY],
      ["r2", "2026-07-05"],
    ]);
  });

  it("anchors on the exact date when both dueDate and dueOffsetDays are set", () => {
    // The offset alone would resolve to TODAY, but the pinned exact date wins.
    const checklist = [task({ dueDate: "2026-07-07", reminders: [{ id: "r1", offsetDays: 0 }] })];
    const due = selectDueReminders(checklist, WEDDING, new Set(), TODAY);
    expect(due).toHaveLength(1);
    expect(due[0].dueDate).toBe("2026-07-07");
    expect(due[0].reminderDate).toBe("2026-07-07");
  });
});

// ── usedCategories ───────────────────────────────────────────────────────────

describe("usedCategories", () => {
  it("returns the distinct categories actually present, sorted alphabetically", () => {
    const items = [
      { category: "Venue & Vendors" },
      { category: "Attire" },
      { category: "Venue & Vendors" },
    ];
    expect(usedCategories(items)).toEqual(["Attire", "Venue & Vendors"]);
  });

  it("trims whitespace and dedupes by the trimmed value", () => {
    const items = [{ category: " Attire " }, { category: "Attire" }];
    expect(usedCategories(items)).toEqual(["Attire"]);
  });

  it("drops blank, whitespace-only, and missing categories", () => {
    const items = [{ category: "" }, { category: "   " }, { category: null }, {}];
    expect(usedCategories(items)).toEqual([]);
  });

  it("returns [] for empty or non-array input", () => {
    expect(usedCategories([])).toEqual([]);
    expect(usedCategories(null)).toEqual([]);
    expect(usedCategories(undefined)).toEqual([]);
  });
});

// ── matchesCategoryFilter ────────────────────────────────────────────────────

describe("matchesCategoryFilter", () => {
  it("matches everything when the filter is null (All)", () => {
    expect(matchesCategoryFilter({ category: "Attire" }, null)).toBe(true);
    expect(matchesCategoryFilter({ category: "" }, null)).toBe(true);
    expect(matchesCategoryFilter({}, null)).toBe(true);
  });

  it("matches by trimmed category equality", () => {
    expect(matchesCategoryFilter({ category: "Attire" }, "Attire")).toBe(true);
    expect(matchesCategoryFilter({ category: " Attire " }, "Attire")).toBe(true);
    expect(matchesCategoryFilter({ category: "Venue & Vendors" }, "Attire")).toBe(false);
  });

  it("treats the empty-string filter as 'uncategorized'", () => {
    expect(matchesCategoryFilter({ category: "" }, "")).toBe(true);
    expect(matchesCategoryFilter({ category: "   " }, "")).toBe(true);
    expect(matchesCategoryFilter({}, "")).toBe(true);
    expect(matchesCategoryFilter({ category: "Attire" }, "")).toBe(false);
  });

  it("tolerates a null task", () => {
    expect(matchesCategoryFilter(null, null)).toBe(true);
    expect(matchesCategoryFilter(null, "")).toBe(true);
    expect(matchesCategoryFilter(null, "Attire")).toBe(false);
  });
});
