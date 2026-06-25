import { describe, it, expect } from "vitest";
import {
  cleanName,
  cleanNotes,
  cleanTable,
  cleanParty,
  cleanAmount,
  cleanEmail,
  MAX_NAME,
  MAX_NOTES,
  MAX_ANGBAO,
  MAX_EMAIL,
} from "./validation.js";

describe("cleanAmount", () => {
  it("returns 0 for NaN, empty, and non-numeric input", () => {
    expect(cleanAmount("")).toBe(0);
    expect(cleanAmount("abc")).toBe(0);
    expect(cleanAmount(null)).toBe(0);
    expect(cleanAmount(undefined)).toBe(0);
  });

  it("returns 0 for zero and negative amounts", () => {
    expect(cleanAmount(0)).toBe(0);
    expect(cleanAmount(-50)).toBe(0);
  });

  it("parses valid positive amounts", () => {
    expect(cleanAmount("200")).toBe(200);
    expect(cleanAmount(88.5)).toBe(88.5);
  });

  it("clamps to MAX_ANGBAO", () => {
    expect(cleanAmount(MAX_ANGBAO + 1)).toBe(MAX_ANGBAO);
    expect(cleanAmount(1e15)).toBe(MAX_ANGBAO);
  });
});

describe("cleanParty", () => {
  it("accepts only '', 'bride', 'groom'", () => {
    expect(cleanParty("bride")).toBe("bride");
    expect(cleanParty("GROOM")).toBe("groom");
    expect(cleanParty(" Bride ")).toBe("bride");
    expect(cleanParty("cousin")).toBe("");
    expect(cleanParty(null)).toBe("");
  });
});

describe("cleanEmail", () => {
  it("accepts well-formed addresses, trimmed", () => {
    expect(cleanEmail("  guest@example.com  ")).toBe("guest@example.com");
  });

  it("rejects malformed input", () => {
    expect(cleanEmail("not-an-email")).toBe("");
    expect(cleanEmail("missing@domain")).toBe("");
    expect(cleanEmail("")).toBe("");
    expect(cleanEmail(null)).toBe("");
  });

  it("rejects input longer than MAX_EMAIL even if otherwise valid-shaped", () => {
    const long = "a".repeat(MAX_EMAIL) + "@example.com";
    expect(cleanEmail(long)).toBe("");
  });
});

describe("length slicing", () => {
  it("trims and caps name at MAX_NAME", () => {
    expect(cleanName("  Priya  ")).toBe("Priya");
    expect(cleanName("x".repeat(MAX_NAME + 50))).toHaveLength(MAX_NAME);
  });

  it("caps notes at MAX_NOTES", () => {
    expect(cleanNotes("y".repeat(MAX_NOTES + 10))).toHaveLength(MAX_NOTES);
  });

  it("defaults an empty table to '1'", () => {
    expect(cleanTable("")).toBe("1");
    expect(cleanTable("  ")).toBe("1");
    expect(cleanTable("VIP 1")).toBe("VIP 1");
  });
});
