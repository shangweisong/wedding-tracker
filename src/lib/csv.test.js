import { describe, it, expect } from "vitest";
import { parseCSV, csvCell, toCSV, guestImportTemplateCSV, IMPORT_TEMPLATE_HEADERS } from "./csv.js";

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
