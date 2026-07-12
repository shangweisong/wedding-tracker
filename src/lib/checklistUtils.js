// Pure planning-checklist computation functions — no side effects, fully testable.
// Task shape: { id, text, category, dueOffsetDays, dueDate?, assignee, done, reminders? }
//   dueOffsetDays: number | null — days relative to the wedding date (negative = before).
//   dueDate: 'yyyy-mm-dd' | null — pinned exact due date; wins over dueOffsetDays and
//     deliberately does NOT shift when the wedding date changes (#110). Absent on
//     pre-existing checklists ⇒ offset-based.
//   assignee: 'both' | 'bride' | 'groom'.
//   reminders: [{ id, offsetDays }] — offsetDays ≤ 0, relative to the task's DUE date
//     (not the wedding date). Absent on pre-existing checklists ⇒ no reminders.
//   notes: string — free-text remarks (#124), capped at 500 chars via cleanNotes.
//     Absent on pre-existing checklists ⇒ no remarks. Exported in the CSV; not
//     included in reminder emails.
import { localDateISO } from "./budgetUtils.js";
import { cleanDueDate } from "./validation.js";

/** Assignee options: keys stored on tasks, labels shown in the UI and CSV export. */
export const ASSIGNEES = [
  { key: "both", label: "Both" },
  { key: "bride", label: "Bride" },
  { key: "groom", label: "Groom" },
];

/** Preset offsets shown in the "due" picker, most-in-advance first. */
export const OFFSET_PRESETS = [
  { label: "12 months before", days: -365 },
  { label: "9 months before", days: -270 },
  { label: "6 months before", days: -180 },
  { label: "4 months before", days: -120 },
  { label: "3 months before", days: -90 },
  { label: "2 months before", days: -60 },
  { label: "1 month before", days: -30 },
  { label: "2 weeks before", days: -14 },
  { label: "1 week before", days: -7 },
  { label: "Day before", days: -1 },
  { label: "No specific deadline", days: null },
];

/** Seed tasks for a couple starting a fresh checklist. Curated, not exhaustive. */
export const DEFAULT_CHECKLIST_TEMPLATE = [
  { text: "Set overall budget", category: "Venue & Vendors", dueOffsetDays: -365, assignee: "both" },
  { text: "Book venue", category: "Venue & Vendors", dueOffsetDays: -365, assignee: "both" },
  { text: "Book photographer", category: "Venue & Vendors", dueOffsetDays: -270, assignee: "both" },
  { text: "Book caterer", category: "Venue & Vendors", dueOffsetDays: -270, assignee: "both" },
  { text: "Order wedding gown", category: "Attire", dueOffsetDays: -270, assignee: "bride" },
  { text: "Order suit", category: "Attire", dueOffsetDays: -270, assignee: "groom" },
  { text: "Book florist", category: "Venue & Vendors", dueOffsetDays: -180, assignee: "both" },
  { text: "Book DJ / band", category: "Venue & Vendors", dueOffsetDays: -180, assignee: "both" },
  { text: "Book hair & makeup trial", category: "Attire", dueOffsetDays: -180, assignee: "bride" },
  { text: "Finalize guest list", category: "Guests & Invitations", dueOffsetDays: -180, assignee: "both" },
  { text: "Apply for marriage license", category: "Legal & Documents", dueOffsetDays: -90, assignee: "both" },
  { text: "Send invitations", category: "Guests & Invitations", dueOffsetDays: -90, assignee: "both" },
  { text: "Schedule final attire fittings", category: "Attire", dueOffsetDays: -60, assignee: "both" },
  { text: "Confirm final headcount with caterer", category: "Guests & Invitations", dueOffsetDays: -14, assignee: "both" },
  { text: "Finalize seating chart", category: "Guests & Invitations", dueOffsetDays: -14, assignee: "both" },
  { text: "Pay final vendor balances", category: "Day-Of Prep", dueOffsetDays: -7, assignee: "both" },
  { text: "Confirm vendor arrival times", category: "Day-Of Prep", dueOffsetDays: -7, assignee: "both" },
  { text: "Rehearsal", category: "Day-Of Prep", dueOffsetDays: -7, assignee: "both" },
  { text: "Pack emergency kit", category: "Day-Of Prep", dueOffsetDays: -1, assignee: "both" },
];

/** Instantiate the default template as real checklist items (fresh ids, undone). */
export function buildDefaultChecklist() {
  return DEFAULT_CHECKLIST_TEMPLATE.map((task) => ({
    id: crypto.randomUUID(),
    ...task,
    done: false,
  }));
}

/**
 * Resolve a task's due date from the wedding date + its offset.
 * Returns null when either input is missing — the offset is deliberately
 * relative so changing the wedding date recomputes every task for free.
 */
export function computeDueDate(weddingDateISO, dueOffsetDays) {
  if (!weddingDateISO || dueOffsetDays === null || dueOffsetDays === undefined) return null;
  const [y, m, d] = weddingDateISO.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + dueOffsetDays);
  return localDateISO(date);
}

/**
 * The single source of truth for a task's due date: a pinned exact `dueDate`
 * wins; otherwise the offset resolves against the wedding date. A corrupt
 * stored `dueDate` falls through to the offset — the reminder cron must never
 * throw on bad data.
 */
export function resolveDueDate(weddingDateISO, task) {
  return cleanDueDate(task?.dueDate) ?? computeDueDate(weddingDateISO, task?.dueOffsetDays);
}

/**
 * Patch to apply when an exact-date edit is committed (#120). A valid date pins
 * it (reminders keep their anchor); clearing or an invalid value means "no
 * deadline", so reminders are cleared in the same patch — one save round-trip
 * keeps them consistent.
 */
export function dueDateCommitPatch(rawValue) {
  const v = cleanDueDate(rawValue);
  return v ? { dueDate: v } : { dueDate: null, reminders: [] };
}

/** A task is overdue only if it has a resolvable due date, isn't done, and that date has passed. */
export function isTaskOverdue(dueDateISO, done, todayISO) {
  if (done || !dueDateISO) return false;
  const today = todayISO ?? localDateISO();
  return dueDateISO < today;
}

/** Preset offsets for the per-task reminder picker, relative to the DUE date. */
export const REMINDER_PRESETS = [
  { label: "1 month before due", days: -30 },
  { label: "2 weeks before due", days: -14 },
  { label: "1 week before due", days: -7 },
  { label: "3 days before due", days: -3 },
  { label: "Day before due", days: -1 },
  { label: "On due date", days: 0 },
];

/**
 * A task's reminders, normalized to an array. The single access point for both
 * the UI and the reminder cron. Reminder ids are minted once when a reminder is
 * added and must NEVER be regenerated — checklist_reminder_log dedups sent
 * emails by (task.id, reminder.id).
 */
export function taskReminders(task) {
  return Array.isArray(task?.reminders) ? task.reminders : [];
}

/**
 * Resolve a reminder's fire date: the task's RESOLVED due date + reminder
 * offset. Anchoring on the resolved date (not wedding date + offsets) makes
 * offset-based and pinned exact-date tasks behave identically — including
 * exact-date tasks on a wedding with no date set yet.
 */
export function computeReminderDate(dueDateISO, reminderOffsetDays) {
  if (reminderOffsetDays === null || reminderOffsetDays === undefined) return null;
  return computeDueDate(dueDateISO, reminderOffsetDays);
}

/**
 * A reminder fires when its date is today OR already past (`<=`, not `===`):
 * a missed cron day fires late rather than never; checklist_reminder_log
 * prevents repeats.
 */
export function isReminderDue(reminderDateISO, todayISO, done) {
  return Boolean(!done && reminderDateISO && reminderDateISO <= todayISO);
}

/**
 * The reminder cron's whole decision, kept pure for testing: every reminder on
 * a not-done, due-dated task whose fire date is ≤ today and whose
 * `${taskId}:${reminderId}` key is not in `sentKeys`.
 * Returns [{ task, reminder, reminderDate, dueDate }].
 */
export function selectDueReminders(checklist, weddingDateISO, sentKeys, todayISO) {
  if (!Array.isArray(checklist)) return [];
  const due = [];
  for (const task of checklist) {
    const dueDate = resolveDueDate(weddingDateISO, task);
    if (!dueDate || task.done) continue;
    for (const reminder of taskReminders(task)) {
      const reminderDate = computeReminderDate(dueDate, reminder.offsetDays);
      if (!isReminderDue(reminderDate, todayISO, task.done)) continue;
      if (sentKeys.has(`${task.id}:${reminder.id}`)) continue;
      due.push({ task, reminder, reminderDate, dueDate });
    }
  }
  return due;
}

/**
 * Distinct categories actually present on the checklist (trimmed, sorted) —
 * unlike the datalist autocomplete, this deliberately excludes template
 * categories nobody is using (#114).
 */
export function usedCategories(items) {
  if (!Array.isArray(items)) return [];
  const categories = new Set();
  for (const item of items) {
    const category = typeof item?.category === "string" ? item.category.trim() : "";
    if (category) categories.add(category);
  }
  return [...categories].sort((a, b) => a.localeCompare(b));
}

/**
 * Category-filter predicate: null = All, "" = uncategorized (blank/missing
 * category), anything else = trimmed equality.
 */
export function matchesCategoryFilter(task, filter) {
  if (filter === null || filter === undefined) return true;
  const category = typeof task?.category === "string" ? task.category.trim() : "";
  return category === filter;
}

/** { done, total, pct } completion summary for a checklist array. */
export function checklistProgress(items) {
  const total = items.length;
  const done = items.filter((item) => item.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}
