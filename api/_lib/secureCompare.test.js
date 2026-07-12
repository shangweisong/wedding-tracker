import { describe, it, expect } from "vitest";
import { secureCompare } from "./secureCompare.js";

describe("secureCompare", () => {
  it("returns true for equal strings", () => {
    expect(secureCompare("shared-secret-value", "shared-secret-value")).toBe(true);
  });

  it("returns false for different strings, including different lengths", () => {
    expect(secureCompare("shared-secret-value", "shared-secret-valuX")).toBe(false);
    expect(secureCompare("short", "a-much-longer-value")).toBe(false);
  });

  it("returns false when either side is missing or not a string", () => {
    expect(secureCompare(undefined, "x")).toBe(false);
    expect(secureCompare("x", null)).toBe(false);
    expect(secureCompare("", "")).toBe(false);
  });
});
