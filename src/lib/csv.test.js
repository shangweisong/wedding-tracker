import { describe, it, expect } from "vitest";
import {
  parseCSV,
  csvCell,
  toCSV,
  guestImportTemplateCSV,
  IMPORT_TEMPLATE_HEADERS,
  toChecklistCSV,
  CHECKLIST_EXPORT_HEADERS,
} from "./csv.js";

describe("parseCSV", () => {
  it("parses a basic guest list", () => {
    const out = parseCSV("name,table,notes,vip\nTan Wei Ming,1,Best man,true");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      name: "Tan Wei Ming",
      table_number: "1",
      notes: "Best man",
      is_vip: true,
    });
  });

  it("handles commas inside quoted fields", () => {
    const out = parseCSV('name,notes\n"Lim, Siew Yong","Vegetarian, no nuts"');
    expect(out[0].name).toBe("Lim, Siew Yong");
    expect(out[0].notes).toBe("Vegetarian, no nuts");
  });

  it("supports header aliases (guest_name / table_no / dietary)", () => {
    const out = parseCSV("guest_name,table_no,dietary\nPriya Nair,2,Halal");
    expect(out[0]).toMatchObject({
      name: "Priya Nair",
      table_number: "2",
      notes: "Halal",
    });
  });

  it("treats vip as truthy only for 'true' or '1'", () => {
    const out = parseCSV("name,vip\nA,true\nB,1\nC,false\nD,yes\nE,");
    expect(out.map((g) => g.is_vip)).toEqual([true, true, false, false, false]);
  });

  it("tolerates a trailing newline", () => {
    const out = parseCSV("name,table\nDavid Koh,4\n");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("David Koh");
  });

  it("returns [] for empty or header-only input", () => {
    expect(parseCSV("")).toEqual([]);
    expect(parseCSV("   ")).toEqual([]);
    expect(parseCSV("name,table")).toEqual([]);
  });

  it("drops rows with no name", () => {
    const out = parseCSV("name,table\n,3\nSiti,4");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Siti");
  });

  it("defaults a missing table to '1'", () => {
    const out = parseCSV("name\nChen Jing Wen");
    expect(out[0].table_number).toBe("1");
  });
});

describe("csvCell — formula-injection hardening", () => {
  it("prefixes cells that start with a formula trigger", () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell("+1+1")).toBe("\"'+1+1\"");
    expect(csvCell("-2")).toBe("\"'-2\"");
    expect(csvCell("@SUM(A1)")).toBe("\"'@SUM(A1)\"");
  });

  it("doubles embedded quotes", () => {
    expect(csvCell('O"Brien')).toBe('"O""Brien"');
  });

  it("leaves ordinary values quoted but untouched", () => {
    expect(csvCell("Tan Wei Ming")).toBe('"Tan Wei Ming"');
    expect(csvCell(200)).toBe('"200"');
    expect(csvCell(null)).toBe('""');
  });
});

describe("toCSV", () => {
  const guests = [
    {
      name: "Tan Wei Ming",
      table_number: "1",
      checked_in: true,
      checked_in_at: "2024-06-15T18:32:00",
      angbao_given: true,
      angbao_amount: 200,
      notes: "Best man",
      is_vip: true,
    },
  ];

  it("emits a header row plus one row per guest", () => {
    const lines = toCSV(guests).split("\n");
    expect(lines[0]).toContain("Name");
    expect(lines).toHaveLength(2);
  });

  it("neutralises a malicious guest name", () => {
    const csv = toCSV([{ ...guests[0], name: "=cmd|'/c calc'!A1" }]);
    expect(csv).toContain("\"'=cmd");
  });

  it("round-trips name/table/notes/vip back through parseCSV", () => {
    const csv = toCSV(guests);
    const parsed = parseCSV(csv);
    expect(parsed[0]).toMatchObject({
      name: "Tan Wei Ming",
      table_number: "1",
      notes: "Best man",
      is_vip: true,
    });
  });
});

describe("guestImportTemplateCSV — downloadable import template", () => {
  it("uses the documented core headers, unquoted so parseCSV recognises them", () => {
    expect(IMPORT_TEMPLATE_HEADERS).toEqual(["name", "table", "notes", "vip", "party"]);
    expect(guestImportTemplateCSV().split("\n")[0]).toBe("name,table,notes,vip,party");
  });

  it("round-trips through parseCSV into the two example guests", () => {
    const parsed = parseCSV(guestImportTemplateCSV());
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      name: "Tan Wei Ming", table_number: "1", notes: "Best man", is_vip: true, party: "groom",
    });
    expect(parsed[1]).toMatchObject({
      name: "Priya Nair", table_number: "2", notes: "Vegetarian", is_vip: false, party: "bride",
    });
  });
});

describe("toChecklistCSV — planning-checklist export", () => {
  const WEDDING = "2026-12-12";
  const task = (overrides) => ({
    id: "t1",
    text: "Book venue",
    category: "Venue & Vendors",
    dueOffsetDays: -365,
    assignee: "both",
    done: false,
    ...overrides,
  });

  it("emits the documented header row plus one row per task", () => {
    const lines = toChecklistCSV([task(), task({ id: "t2", text: "Order suit" })], WEDDING).split("\n");
    expect(CHECKLIST_EXPORT_HEADERS).toEqual([
      "Task", "Category", "Assignee", "Due date", "Due", "Reminders", "Notes", "Done",
    ]);
    expect(lines[0]).toBe(CHECKLIST_EXPORT_HEADERS.join(","));
    expect(lines).toHaveLength(3);
  });

  it("emits only the header row for an empty checklist", () => {
    expect(toChecklistCSV([], WEDDING)).toBe(CHECKLIST_EXPORT_HEADERS.join(","));
  });

  it("writes the task fields with the assignee label and Yes/No done state", () => {
    const row = toChecklistCSV([task({ assignee: "bride", done: true })], WEDDING).split("\n")[1];
    expect(row).toContain('"Book venue"');
    expect(row).toContain('"Venue & Vendors"');
    expect(row).toContain('"Bride"');
    expect(row).toContain('"Yes"');
  });

  it("resolves offset due dates against the wedding date, labelled with the preset", () => {
    const row = toChecklistCSV([task({ dueOffsetDays: -30 })], WEDDING).split("\n")[1];
    expect(row).toContain('"2026-11-12"');
    expect(row).toContain('"1 month before"');
  });

  it("resolves a pinned exact date (winning over the offset) labelled 'Exact date'", () => {
    const row = toChecklistCSV([task({ dueDate: "2026-03-17", dueOffsetDays: -30 })], WEDDING).split("\n")[1];
    expect(row).toContain('"2026-03-17"');
    expect(row).toContain('"Exact date"');
    expect(row).not.toContain("2026-11-12");
  });

  it("leaves the due-date cell empty for no-deadline tasks and unresolvable offsets", () => {
    const noDeadline = toChecklistCSV([task({ dueOffsetDays: null })], WEDDING).split("\n")[1];
    expect(noDeadline).toContain('"No specific deadline"');
    const noWeddingDate = toChecklistCSV([task()], null).split("\n")[1];
    expect(noWeddingDate).toContain('"12 months before"');
    expect(noWeddingDate).not.toContain("2025");
  });

  it("labels non-preset offsets in plain days", () => {
    const row = toChecklistCSV([task({ dueOffsetDays: -45 })], WEDDING).split("\n")[1];
    expect(row).toContain('"45 days before"');
  });

  it("joins reminder labels with '; '", () => {
    const row = toChecklistCSV(
      [task({ reminders: [{ id: "r1", offsetDays: -7 }, { id: "r2", offsetDays: 0 }] })],
      WEDDING
    ).split("\n")[1];
    expect(row).toContain('"1 week before due; On due date"');
  });

  it("labels non-preset reminder offsets in plain days and leaves the cell empty without reminders", () => {
    const custom = toChecklistCSV([task({ reminders: [{ id: "r1", offsetDays: -10 }] })], WEDDING).split("\n")[1];
    expect(custom).toContain('"10 days before due"');
    const none = toChecklistCSV([task()], WEDDING).split("\n")[1];
    expect(none.split(",")[5]).toBe('""');
  });

  it("writes the task notes and leaves the cell empty when absent (#124)", () => {
    const withNotes = toChecklistCSV([task({ notes: "Deposit paid, balance due May" })], WEDDING).split("\n")[1];
    expect(withNotes).toContain('"Deposit paid, balance due May"');
    const none = toChecklistCSV([task()], WEDDING).split("\n")[1];
    expect(none.split(",")[6]).toBe('""');
  });

  it("neutralises formula injection in task notes", () => {
    const csv = toChecklistCSV([task({ notes: "=HYPERLINK(evil)" })], WEDDING);
    expect(csv).toContain("\"'=HYPERLINK");
  });

  it("neutralises formula injection in task text and category", () => {
    const csv = toChecklistCSV(
      [task({ text: "=cmd|'/c calc'!A1", category: "+SUM(A1)" })],
      WEDDING
    );
    expect(csv).toContain("\"'=cmd");
    expect(csv).toContain("\"'+SUM");
  });
});
