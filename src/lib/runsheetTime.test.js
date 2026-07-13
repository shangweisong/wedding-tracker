import { describe, it, expect } from "vitest";
import {
  parseTimeToHHMM,
  parseDurationToMinutes,
  upgradeRunsheetItem,
  upgradeRunsheet,
  formatTimeLabel,
} from "./runsheetTime.js";

// ── parseTimeToHHMM ──────────────────────────────────────────────────────────

describe("parseTimeToHHMM", () => {
  it("parses 24h colon times", () => {
    expect(parseTimeToHHMM("07:00")).toBe("07:00");
    expect(parseTimeToHHMM("7:00")).toBe("07:00");
    expect(parseTimeToHHMM("19:30")).toBe("19:30");
    expect(parseTimeToHHMM("0:05")).toBe("00:05");
  });

  it("parses 12h am/pm times with and without minutes", () => {
    expect(parseTimeToHHMM("7am")).toBe("07:00");
    expect(parseTimeToHHMM("7 AM")).toBe("07:00");
    expect(parseTimeToHHMM("3:30 PM")).toBe("15:30");
    expect(parseTimeToHHMM("7.30pm")).toBe("19:30");
    expect(parseTimeToHHMM("11 p.m.")).toBe("23:00");
  });

  it("handles the 12 o'clock edge cases", () => {
    expect(parseTimeToHHMM("12am")).toBe("00:00");
    expect(parseTimeToHHMM("12:00 AM")).toBe("00:00");
    expect(parseTimeToHHMM("12pm")).toBe("12:00");
    expect(parseTimeToHHMM("12:30pm")).toBe("12:30");
  });

  it("parses compact military-style times", () => {
    expect(parseTimeToHHMM("0730")).toBe("07:30");
    expect(parseTimeToHHMM("1930")).toBe("19:30");
    expect(parseTimeToHHMM("730pm")).toBe("19:30");
  });

  it("takes the start of a range", () => {
    expect(parseTimeToHHMM("7:00-7:30")).toBe("07:00");
    expect(parseTimeToHHMM("7am – 8am")).toBe("07:00");
    expect(parseTimeToHHMM("3:30 PM to 4 PM")).toBe("15:30");
  });

  it("parses a bare hour without am/pm as 24h clock", () => {
    expect(parseTimeToHHMM("7")).toBe("07:00");
    expect(parseTimeToHHMM("19")).toBe("19:00");
  });

  it("returns null for empty, garbage, and out-of-range values", () => {
    expect(parseTimeToHHMM("")).toBeNull();
    expect(parseTimeToHHMM(null)).toBeNull();
    expect(parseTimeToHHMM(undefined)).toBeNull();
    expect(parseTimeToHHMM("TBC")).toBeNull();
    expect(parseTimeToHHMM("after lunch")).toBeNull();
    expect(parseTimeToHHMM("25:00")).toBeNull();
    expect(parseTimeToHHMM("7:75")).toBeNull();
    expect(parseTimeToHHMM("13pm")).toBeNull();
  });
});

// ── parseDurationToMinutes ───────────────────────────────────────────────────

describe("parseDurationToMinutes", () => {
  it("parses plain numbers as minutes", () => {
    expect(parseDurationToMinutes(30)).toBe(30);
    expect(parseDurationToMinutes("30")).toBe(30);
    expect(parseDurationToMinutes("45")).toBe(45);
  });

  it("parses minute-unit strings", () => {
    expect(parseDurationToMinutes("30 mins")).toBe(30);
    expect(parseDurationToMinutes("30min")).toBe(30);
    expect(parseDurationToMinutes("30m")).toBe(30);
    expect(parseDurationToMinutes("45 minutes")).toBe(45);
  });

  it("parses hour-unit strings, including decimals", () => {
    expect(parseDurationToMinutes("1h")).toBe(60);
    expect(parseDurationToMinutes("1 hr")).toBe(60);
    expect(parseDurationToMinutes("2 hours")).toBe(120);
    expect(parseDurationToMinutes("1.5h")).toBe(90);
  });

  it("parses combined hour+minute strings", () => {
    expect(parseDurationToMinutes("1h 30m")).toBe(90);
    expect(parseDurationToMinutes("1 hour 30 minutes")).toBe(90);
    expect(parseDurationToMinutes("2hr15min")).toBe(135);
  });

  it("parses h:mm form", () => {
    expect(parseDurationToMinutes("1:30")).toBe(90);
    expect(parseDurationToMinutes("0:45")).toBe(45);
  });

  it("returns null for empty, non-positive, and unparseable values", () => {
    expect(parseDurationToMinutes("")).toBeNull();
    expect(parseDurationToMinutes(null)).toBeNull();
    expect(parseDurationToMinutes(undefined)).toBeNull();
    expect(parseDurationToMinutes("TBD")).toBeNull();
    expect(parseDurationToMinutes("0")).toBeNull();
    expect(parseDurationToMinutes(-5)).toBeNull();
    expect(parseDurationToMinutes("whole day maybe")).toBeNull();
  });
});

// ── upgradeRunsheetItem / upgradeRunsheet ────────────────────────────────────

describe("upgradeRunsheetItem", () => {
  const legacy = {
    id: "a1", time: "3:30 PM", event: "Tea ceremony",
    duration: "45 mins", involved: "Bride, Groom", comments: "Parents seated first",
  };

  it("parses legacy time/duration into structured fields and preserves the raw text", () => {
    expect(upgradeRunsheetItem(legacy)).toEqual({
      id: "a1", event: "Tea ceremony", involved: "Bride, Groom",
      comments: "Parents seated first",
      startTime: "15:30", durationMin: 45,
      timeText: "3:30 PM", durationText: "45 mins",
    });
  });

  it("keeps unparseable legacy values as raw text with empty structured fields", () => {
    const upgraded = upgradeRunsheetItem({ ...legacy, time: "after lunch", duration: "a while" });
    expect(upgraded.startTime).toBe("");
    expect(upgraded.durationMin).toBeNull();
    expect(upgraded.timeText).toBe("after lunch");
    expect(upgraded.durationText).toBe("a while");
  });

  it("returns already-upgraded items unchanged (idempotent)", () => {
    const once = upgradeRunsheetItem(legacy);
    const twice = upgradeRunsheetItem(once);
    expect(twice).toEqual(once);
  });

  it("tolerates missing and null fields without throwing", () => {
    expect(upgradeRunsheetItem({ id: "x" })).toEqual({
      id: "x", startTime: "", durationMin: null, timeText: "", durationText: "",
    });
    expect(upgradeRunsheetItem({ id: "y", time: null, duration: null }).startTime).toBe("");
  });
});

describe("upgradeRunsheet", () => {
  it("upgrades every item in an array", () => {
    const out = upgradeRunsheet([
      { id: "1", time: "7am", event: "Gatecrash", duration: "1h", involved: "", comments: "" },
      { id: "2", time: "", event: "Buffer", duration: "", involved: "", comments: "" },
    ]);
    expect(out[0].startTime).toBe("07:00");
    expect(out[0].durationMin).toBe(60);
    expect(out[1].startTime).toBe("");
    expect(out[1].durationMin).toBeNull();
  });

  it("returns an empty array for non-array input", () => {
    expect(upgradeRunsheet(null)).toEqual([]);
    expect(upgradeRunsheet(undefined)).toEqual([]);
  });
});

// ── formatTimeLabel ──────────────────────────────────────────────────────────

describe("formatTimeLabel", () => {
  it("formats HH:MM into a 12h label", () => {
    expect(formatTimeLabel("00:00")).toBe("12:00 AM");
    expect(formatTimeLabel("07:05")).toBe("7:05 AM");
    expect(formatTimeLabel("12:00")).toBe("12:00 PM");
    expect(formatTimeLabel("13:30")).toBe("1:30 PM");
    expect(formatTimeLabel("23:59")).toBe("11:59 PM");
  });

  it("returns an empty string for empty or invalid input", () => {
    expect(formatTimeLabel("")).toBe("");
    expect(formatTimeLabel(null)).toBe("");
    expect(formatTimeLabel("nope")).toBe("");
  });
});
