import { describe, it, expect } from "vitest";
import { nextFreeDraw, applyDrawRelease, releaseDrawArgs } from "./draw";

describe("nextFreeDraw", () => {
  it("returns 1 when no guest holds a number", () => {
    expect(nextFreeDraw([])).toBe(1);
    expect(nextFreeDraw([{ draw_number: null }, {}])).toBe(1);
  });

  it("returns the next number when numbers are dense", () => {
    const guests = [{ draw_number: 1 }, { draw_number: 2 }, { draw_number: 3 }];
    expect(nextFreeDraw(guests)).toBe(4);
  });

  it("fills the lowest gap left by a released number", () => {
    const guests = [{ draw_number: 1 }, { draw_number: 2 }, { draw_number: 4 }];
    expect(nextFreeDraw(guests)).toBe(3);
  });

  it("returns 1 when 1 itself was released", () => {
    const guests = [{ draw_number: 2 }, { draw_number: 3 }];
    expect(nextFreeDraw(guests)).toBe(1);
  });

  it("ignores null and undefined draw numbers mixed in", () => {
    const guests = [{ draw_number: 1 }, { draw_number: null }, {}, { draw_number: 3 }];
    expect(nextFreeDraw(guests)).toBe(2);
  });
});

describe("applyDrawRelease", () => {
  it("clears the draw number", () => {
    const guest = { id: "g1", name: "Ann", draw_number: 7 };
    expect(applyDrawRelease(guest).draw_number).toBeNull();
  });

  it("does not mutate the input guest", () => {
    const guest = { id: "g1", draw_number: 7 };
    applyDrawRelease(guest);
    expect(guest.draw_number).toBe(7);
  });

  it("preserves the guest's other fields", () => {
    const guest = { id: "g1", name: "Ann", angbao_given: false, draw_number: 7 };
    expect(applyDrawRelease(guest)).toEqual({
      id: "g1",
      name: "Ann",
      angbao_given: false,
      draw_number: null,
    });
  });
});

describe("releaseDrawArgs", () => {
  it("builds the release_draw_number RPC payload", () => {
    expect(releaseDrawArgs("abc-123")).toEqual({ p_guest_id: "abc-123" });
  });
});
