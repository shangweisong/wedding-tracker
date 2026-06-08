import { cleanName, cleanNotes, cleanTable, cleanParty } from "./validation.js";

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
  "Notes",
  "VIP",
];

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
        g.notes || "",
        g.is_vip,
      ]
        .map(csvCell)
        .join(",")
    ),
  ];
  return rows.join("\n");
}
