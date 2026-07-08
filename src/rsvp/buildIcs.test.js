import { describe, it, expect } from "vitest";
import { buildIcsDataUrl } from "./buildIcs.js";

// Decode the data: URL back into the raw ICS text for assertions.
function decodeIcs(url) {
  return decodeURIComponent(url.split(",")[1]);
}

const WEDDING = {
  id: "abc-123",
  wedding_date: "2026-08-08",
  bride_name: "Mei",
  groom_name: "Wei",
  venue_name: "Grand Hall",
};

describe("buildIcsDataUrl (RFC 5545 compliance)", () => {
  it("returns null without a wedding_date", () => {
    expect(buildIcsDataUrl({})).toBe(null);
    expect(buildIcsDataUrl(null)).toBe(null);
  });

  it("includes a UID inside the VEVENT", () => {
    const ics = decodeIcs(buildIcsDataUrl(WEDDING));
    expect(ics).toMatch(/BEGIN:VEVENT[\s\S]*UID:[^\r\n]+[\s\S]*END:VEVENT/);
    // Stable: derived from the wedding id.
    expect(ics).toContain("abc-123");
  });

  it("includes a DTSTAMP in UTC basic format", () => {
    const ics = decodeIcs(buildIcsDataUrl(WEDDING));
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });

  it("sets all-day DTEND to the day AFTER DTSTART (exclusive per RFC 5545)", () => {
    const ics = decodeIcs(buildIcsDataUrl(WEDDING));
    expect(ics).toContain("DTSTART;VALUE=DATE:20260808");
    expect(ics).toContain("DTEND;VALUE=DATE:20260809");
  });

  it("rolls over month/year boundaries for DTEND", () => {
    const ics = decodeIcs(buildIcsDataUrl({ ...WEDDING, wedding_date: "2026-01-31" }));
    expect(ics).toContain("DTSTART;VALUE=DATE:20260131");
    expect(ics).toContain("DTEND;VALUE=DATE:20260201");
    const nye = decodeIcs(buildIcsDataUrl({ ...WEDDING, wedding_date: "2026-12-31" }));
    expect(nye).toContain("DTEND;VALUE=DATE:20270101");
  });

  it("uses the couple names for SUMMARY when present", () => {
    const ics = decodeIcs(buildIcsDataUrl(WEDDING));
    expect(ics).toContain("SUMMARY:Mei & Wei's Wedding");
  });

  it("uses the provided localized fallback when names are missing", () => {
    const ics = decodeIcs(
      buildIcsDataUrl({ id: "x", wedding_date: "2026-08-08" }, "婚禮")
    );
    expect(ics).toContain("SUMMARY:婚禮");
  });
});
