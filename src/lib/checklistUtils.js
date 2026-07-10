// Pure planning-checklist computation functions — no side effects, fully testable.
// Task shape: { id, text, category, dueOffsetDays, assignee, done }
//   dueOffsetDays: number | null — days relative to the wedding date (negative = before).
//   assignee: 'both' | 'bride' | 'groom'.
import { localDateISO } from "./budgetUtils.js";

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

/** A task is overdue only if it has a resolvable due date, isn't done, and that date has passed. */
export function isTaskOverdue(dueDateISO, done, todayISO) {
  if (done || !dueDateISO) return false;
  const today = todayISO ?? localDateISO();
  return dueDateISO < today;
}

/** { done, total, pct } completion summary for a checklist array. */
export function checklistProgress(items) {
  const total = items.length;
  const done = items.filter((item) => item.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}
