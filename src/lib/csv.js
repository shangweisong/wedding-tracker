import { cleanName, cleanNotes, cleanTable, cleanParty, cleanDueDate } from "./validation.js";
import {
  ASSIGNEES,
  OFFSET_PRESETS,
  REMINDER_PRESETS,
  resolveDueDate,
  taskReminders,
} from "./checklistUtils.js";

const RSVP_STATUSES = new Set(['pending', 'confirmed', 'declined']);

// ─── CSV PARSER ───────────────────────────────────────────────────────────────
export function parseCSV(text) {
  const lines = String(text ?? "").trim().split("\n");
  // Guard against empty input / a paste with no header row.
  if (lines.length < 2 || !lines[0].trim()) return [];
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines
    .slice(1)
    .map((line) => {
      // Handle commas inside quoted fields
      const vals = [];
      let cur = "",
        inQ = false;
      for (let c of line) {
        if (c === '"') inQ = !inQ;
        else if (c === "," && !inQ) {
          vals.push(cur.trim());
          cur = "";
        } else cur += c;
      }
      vals.push(cur.trim());
      const obj = {};
      headers.forEach((h, i) => (obj[h] = vals[i] || ""));
      return {
        name: cleanName(obj.name || obj.guest_name || obj.guest),
        table_number: cleanTable(obj.table || obj.table_number || obj.table_no),
        checked_in: false,
        checked_in_at: null,
        angbao_given: false,
        angbao_amount: 0,
        notes: cleanNotes(obj.notes || obj.note || obj.dietary),
        party: cleanParty(obj.party),
        is_vip: (obj.vip || "").toLowerCase() === "true" || (obj.vip || "") === "1",
        rsvp_status: RSVP_STATUSES.has((obj.rsvp_status || obj.status || '').toLowerCase())
          ? (obj.rsvp_status || obj.status).toLowerCase()
          : 'pending',
        rsvp_message: String(obj.rsvp_message || obj.message || obj.wish || '').trim().slice(0, 500),
        meal_choice:  String(obj.meal_choice  || obj.meal   || ''             ).trim().slice(0, 60),
      };
    })
    .filter((g) => g.name);
}

// ─── CSV EXPORT ───────────────────────────────────────────────────────────────
// Escape a single cell against CSV injection. A leading =, +, -, @, tab, or CR
// makes spreadsheet apps (Excel/Sheets/Numbers) evaluate the cell as a formula
// when the exported file is opened — a real risk because guest names/notes are
// attacker-controlled. Prefix those with a single quote and neutralise quotes.
export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

const EXPORT_HEADERS = [
  "Name",
  "Table",
  "Checked In",
  "Check-In Time",
  "Angbao Given",
  "Amount",
  "Draw Number",
  "Notes",
  "VIP",
];

// ─── IMPORT TEMPLATE ──────────────────────────────────────────────────────────
// A ready-to-fill sample for the guest-list import. Headers are the plain names
// parseCSV() recognises (kept unquoted — parseCSV only strips quotes from values,
// not header cells); example rows go through csvCell for the same injection
// hardening as exports. Keep this in sync with parseCSV's accepted columns.
export const IMPORT_TEMPLATE_HEADERS = ["name", "table", "notes", "vip", "party"];

const IMPORT_TEMPLATE_ROWS = [
  ["Tan Wei Ming", "1", "Best man", "true", "groom"],
  ["Priya Nair", "2", "Vegetarian", "false", "bride"],
];

export function guestImportTemplateCSV() {
  return [
    IMPORT_TEMPLATE_HEADERS.join(","),
    ...IMPORT_TEMPLATE_ROWS.map((row) => row.map(csvCell).join(",")),
  ].join("\n");
}

export function toCSV(guests) {
  const rows = [
    EXPORT_HEADERS.join(","),
    ...guests.map((g) =>
      [
        g.name,
        g.table_number,
        g.checked_in,
        g.checked_in_at || "",
        g.angbao_given,
        g.angbao_amount,
        g.draw_number ?? "",
        g.notes || "",
        g.is_vip,
      ]
        .map(csvCell)
        .join(",")
    ),
  ];
  return rows.join("\n");
}

// ─── CHECKLIST EXPORT ─────────────────────────────────────────────────────────
export const CHECKLIST_EXPORT_HEADERS = [
  "Task",
  "Category",
  "Assignee",
  "Due date",
  "Due",
  "Reminders",
  "Notes",
  "Done",
];

// Human label for how a task's due date is configured. Presets cover everything
// the UI can produce; the plain-days fallback keeps arbitrary stored offsets legible.
function dueLabel(task) {
  if (cleanDueDate(task?.dueDate) !== null) return "Exact date";
  const days = task?.dueOffsetDays ?? null;
  const preset = OFFSET_PRESETS.find((p) => p.days === days);
  if (preset) return preset.label;
  if (days === 0) return "On wedding date";
  return `${Math.abs(days)} days ${days < 0 ? "before" : "after"}`;
}

function reminderLabel({ offsetDays }) {
  const preset = REMINDER_PRESETS.find((p) => p.days === offsetDays);
  if (preset) return preset.label;
  return `${Math.abs(offsetDays)} days ${offsetDays < 0 ? "before" : "after"} due`;
}

/**
 * Export the planning checklist (#115). The due-date column holds the task's
 * RESOLVED date (pinned exact date wins over the wedding-date offset), so both
 * kinds of task read uniformly; the "Due" column says how it was configured.
 */
export function toChecklistCSV(items, weddingDateISO) {
  const rows = [
    CHECKLIST_EXPORT_HEADERS.join(","),
    ...items.map((task) =>
      [
        task.text,
        task.category || "",
        ASSIGNEES.find((a) => a.key === task.assignee)?.label ?? task.assignee ?? "",
        resolveDueDate(weddingDateISO, task) || "",
        dueLabel(task),
        taskReminders(task).map(reminderLabel).join("; "),
        task.notes || "",
        task.done ? "Yes" : "No",
      ]
        .map(csvCell)
        .join(",")
    ),
  ];
  return rows.join("\n");
}
