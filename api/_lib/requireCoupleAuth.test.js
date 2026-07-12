import { describe, it, expect, vi, afterEach } from "vitest";
import { authorizedHelperEmail, makeRateLimiter } from "./requireCoupleAuth.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("authorizedHelperEmail", () => {
  it("returns null when there is no Authorization header", async () => {
    expect(await authorizedHelperEmail({ headers: {} })).toBe(null);
  });

  it("returns null for a non-Bearer Authorization header", async () => {
    expect(await authorizedHelperEmail({ headers: { authorization: "Basic abc" } })).toBe(null);
  });

  it("fails closed (null) when token verification throws", async () => {
    // No SUPABASE_SERVICE_ROLE_KEY in the test env → supabaseAdmin() throws.
    expect(await authorizedHelperEmail({ headers: { authorization: "Bearer sometoken" } })).toBe(null);
  });
});

describe("makeRateLimiter", () => {
  it("allows up to max hits per window, then limits", () => {
    const limited = makeRateLimiter({ windowMs: 60_000, max: 3 });
    expect(limited("a@b.com")).toBe(false);
    expect(limited("a@b.com")).toBe(false);
    expect(limited("a@b.com")).toBe(false);
    expect(limited("a@b.com")).toBe(true);
  });

  it("tracks keys independently", () => {
    const limited = makeRateLimiter({ windowMs: 60_000, max: 1 });
    expect(limited("a@b.com")).toBe(false);
    expect(limited("c@d.com")).toBe(false);
    expect(limited("a@b.com")).toBe(true);
  });

  it("forgets hits after the window passes", () => {
    vi.useFakeTimers();
    const limited = makeRateLimiter({ windowMs: 1000, max: 1 });
    expect(limited("a@b.com")).toBe(false);
    expect(limited("a@b.com")).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(limited("a@b.com")).toBe(false);
  });
});
