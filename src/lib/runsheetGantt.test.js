import { describe, it, expect } from "vitest";
import { computeGanttLayout } from "./runsheetGantt.js";

// Upgraded-shape helper (see runsheetTime.js).
const mk = (id, startTime, durationMin, extra = {}) => ({
  id, event: `Event ${id}`, startTime, durationMin,
  involved: "", comments: "", timeText: "", durationText: "", ...extra,
});

describe("computeGanttLayout", () => {
  it("returns an empty layout for no items", () => {
    expect(computeGanttLayout([])).toEqual({
      scheduled: [], unscheduled: [], laneCount: 0,
      windowStartMin: 0, windowEndMin: 0, hourTicks: [],
    });
  });

  it("separates unscheduled items (no startTime) in input order", () => {
    const a = mk("a", "", null);
    const b = mk("b", "10:00", 30);
    const c = mk("c", "", 45);
    const { scheduled, unscheduled } = computeGanttLayout([a, b, c]);
    expect(unscheduled).toEqual([a, c]);
    expect(scheduled.map((s) => s.item.id)).toEqual(["b"]);
  });

  it("computes the window floored/ceiled to the hour with a 2-hour minimum span", () => {
    const layout = computeGanttLayout([mk("a", "10:00", 30)]);
    expect(layout.windowStartMin).toBe(600);
    expect(layout.windowEndMin).toBe(720); // 630 ceils to 660; min span pads to 720
  });

  it("computes bar percentages within the window", () => {
    const { scheduled } = computeGanttLayout([mk("a", "10:00", 30)]);
    expect(scheduled[0].startMin).toBe(600);
    expect(scheduled[0].endMin).toBe(630);
    expect(scheduled[0].leftPct).toBe(0);
    expect(scheduled[0].widthPct).toBe(25); // 30 of 120 min
  });

  it("uses defaultDurationMin for null durations and flags them", () => {
    const { scheduled } = computeGanttLayout([mk("a", "10:00", null)]);
    expect(scheduled[0].endMin).toBe(615);
    expect(scheduled[0].noDuration).toBe(true);

    const custom = computeGanttLayout([mk("a", "10:00", null)], { defaultDurationMin: 30 });
    expect(custom.scheduled[0].endMin).toBe(630);
  });

  it("marks real durations as noDuration: false", () => {
    const { scheduled } = computeGanttLayout([mk("a", "10:00", 30)]);
    expect(scheduled[0].noDuration).toBe(false);
  });

  it("assigns overlapping items to separate lanes", () => {
    const { scheduled, laneCount } = computeGanttLayout([
      mk("a", "10:00", 60), mk("b", "10:30", 60), mk("c", "10:15", 120),
    ]);
    const lanes = Object.fromEntries(scheduled.map((s) => [s.item.id, s.lane]));
    expect(lanes.a).toBe(0);
    expect(new Set([lanes.a, lanes.b, lanes.c]).size).toBe(3);
    expect(laneCount).toBe(3);
  });

  it("shares a lane for back-to-back items (end == next start)", () => {
    const { scheduled, laneCount } = computeGanttLayout([
      mk("a", "10:00", 30), mk("b", "10:30", 30),
    ]);
    expect(scheduled.map((s) => s.lane)).toEqual([0, 0]);
    expect(laneCount).toBe(1);
  });

  it("gives duplicate start times separate lanes, stable by input order", () => {
    const { scheduled } = computeGanttLayout([
      mk("first", "10:00", 30), mk("second", "10:00", 30),
    ]);
    const byId = Object.fromEntries(scheduled.map((s) => [s.item.id, s.lane]));
    expect(byId.first).toBe(0);
    expect(byId.second).toBe(1);
  });

  it("sorts scheduled bars by start time", () => {
    const { scheduled } = computeGanttLayout([
      mk("late", "15:00", 30), mk("early", "09:00", 30),
    ]);
    expect(scheduled.map((s) => s.item.id)).toEqual(["early", "late"]);
  });

  it("extends the axis past midnight when a duration overflows the day", () => {
    const layout = computeGanttLayout([mk("a", "23:30", 60)]);
    expect(layout.windowStartMin).toBe(1380);
    expect(layout.windowEndMin).toBe(1500);
    expect(layout.hourTicks.map((t) => t.label)).toEqual(["11:00 PM", "12:00 AM", "1:00 AM"]);
  });

  it("emits an hour tick per hour across the window with positions and labels", () => {
    const { hourTicks } = computeGanttLayout([mk("a", "10:00", 30)]);
    expect(hourTicks).toEqual([
      { min: 600, leftPct: 0, label: "10:00 AM" },
      { min: 660, leftPct: 50, label: "11:00 AM" },
      { min: 720, leftPct: 100, label: "12:00 PM" },
    ]);
  });

  it("ignores items with malformed startTime values as unscheduled", () => {
    const bad = mk("bad", "not-a-time", 30);
    const { scheduled, unscheduled } = computeGanttLayout([bad]);
    expect(scheduled).toEqual([]);
    expect(unscheduled).toEqual([bad]);
  });
});
