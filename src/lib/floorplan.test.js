import { describe, it, expect } from "vitest";
import {
  MAX_FLOORPLANS,
  MAX_FLOORPLAN_LABEL,
  cleanFloorplanLabel,
  normalizeFloorplans,
  canAddFloorplan,
  addFloorplan,
  removeFloorplan,
  setFloorplanLabel,
  floorplanPath,
  newFloorplanId,
} from "./floorplan.js";

const entry = (id, extra = {}) => ({
  id,
  path: `floorplans/${id}.jpg`,
  url: `https://example.supabase.co/storage/v1/object/public/wedding-photos/floorplans/${id}.jpg`,
  label: `Label ${id}`,
  created_at: "2026-07-23T04:00:00.000Z",
  ...extra,
});

describe("cleanFloorplanLabel", () => {
  it("trims whitespace and coerces null/undefined to empty string", () => {
    expect(cleanFloorplanLabel("  Ballroom  ")).toBe("Ballroom");
    expect(cleanFloorplanLabel(null)).toBe("");
    expect(cleanFloorplanLabel(undefined)).toBe("");
  });

  it("slices to MAX_FLOORPLAN_LABEL characters", () => {
    expect(cleanFloorplanLabel("x".repeat(200))).toHaveLength(MAX_FLOORPLAN_LABEL);
  });
});

describe("normalizeFloorplans", () => {
  it("returns [] for non-array inputs", () => {
    expect(normalizeFloorplans(null)).toEqual([]);
    expect(normalizeFloorplans(undefined)).toEqual([]);
    expect(normalizeFloorplans({})).toEqual([]);
    expect(normalizeFloorplans("junk")).toEqual([]);
  });

  it("drops entries that are not objects or lack a non-empty string url", () => {
    const ok = entry("fp_a");
    const list = [ok, null, "str", 42, entry("fp_b", { url: "" }), entry("fp_c", { url: 7 })];
    expect(normalizeFloorplans(list)).toEqual([ok]);
  });

  it("drops entries whose path does not start with floorplans/", () => {
    const ok = entry("fp_a");
    const bad = entry("fp_b", { path: "hero.jpg" });
    const missing = entry("fp_c", { path: undefined });
    expect(normalizeFloorplans([ok, bad, missing])).toEqual([ok]);
  });

  it("drops entries without a non-empty string id and dedupes by id, first wins", () => {
    const first = entry("fp_a", { label: "first" });
    const dupe = entry("fp_a", { label: "second" });
    const noId = entry("", {});
    expect(normalizeFloorplans([first, dupe, noId])).toEqual([first]);
  });

  it("caps the result at MAX_FLOORPLANS preserving order", () => {
    const list = Array.from({ length: MAX_FLOORPLANS + 3 }, (_, i) => entry(`fp_${i}`));
    const out = normalizeFloorplans(list);
    expect(out).toHaveLength(MAX_FLOORPLANS);
    expect(out.map((e) => e.id)).toEqual(list.slice(0, MAX_FLOORPLANS).map((e) => e.id));
  });

  it("cleans labels and defaults a missing label to empty string", () => {
    const padded = entry("fp_a", { label: "  Stage  " });
    const missing = entry("fp_b", {});
    delete missing.label;
    const out = normalizeFloorplans([padded, missing]);
    expect(out[0].label).toBe("Stage");
    expect(out[1].label).toBe("");
  });

  it("does not mutate its input", () => {
    const raw = [entry("fp_a", { label: "  pad  " })];
    const snapshot = JSON.parse(JSON.stringify(raw));
    normalizeFloorplans(raw);
    expect(raw).toEqual(snapshot);
  });
});

describe("canAddFloorplan / addFloorplan", () => {
  it("appends and returns a new array when under the cap", () => {
    const list = [entry("fp_a")];
    const added = entry("fp_b");
    const out = addFloorplan(list, added);
    expect(out).not.toBe(list);
    expect(out).toEqual([...list, added]);
    expect(canAddFloorplan(list)).toBe(true);
  });

  it("returns the list unchanged at the cap", () => {
    const full = Array.from({ length: MAX_FLOORPLANS }, (_, i) => entry(`fp_${i}`));
    expect(canAddFloorplan(full)).toBe(false);
    expect(addFloorplan(full, entry("fp_extra"))).toBe(full);
  });
});

describe("removeFloorplan", () => {
  it("removes the entry with the given id without mutating", () => {
    const a = entry("fp_a"), b = entry("fp_b");
    const list = [a, b];
    expect(removeFloorplan(list, "fp_a")).toEqual([b]);
    expect(list).toEqual([a, b]);
  });

  it("is a no-op for an unknown id", () => {
    const list = [entry("fp_a")];
    expect(removeFloorplan(list, "fp_zzz")).toEqual(list);
  });
});

describe("setFloorplanLabel", () => {
  it("updates only the target entry and cleans the label", () => {
    const a = entry("fp_a"), b = entry("fp_b");
    const out = setFloorplanLabel([a, b], "fp_b", "  New label  ");
    expect(out[0]).toEqual(a);
    expect(out[1]).toEqual({ ...b, label: "New label" });
  });
});

describe("floorplanPath / newFloorplanId", () => {
  it("builds a floorplans/<id>.jpg path", () => {
    expect(floorplanPath("fp_abc123")).toBe("floorplans/fp_abc123.jpg");
  });

  it("generates ids with the fp_ prefix that pass their own path check", () => {
    const id = newFloorplanId();
    expect(id).toMatch(/^fp_[a-z0-9]+$/);
    expect(newFloorplanId()).not.toBe(id);
  });
});
