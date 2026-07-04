import { describe, it, expect, afterEach } from "vitest";
import { isAllowedHelperEmail } from "./generate-theme.js";

const SNAPSHOT = { ...process.env };
afterEach(() => {
  process.env = { ...SNAPSHOT };
});

describe("isAllowedHelperEmail", () => {
  it("matches the configured helper email case-insensitively", () => {
    delete process.env.HELPER_EMAIL;
    process.env.VITE_HELPER_EMAIL = "Helpers@Wedding.local";
    expect(isAllowedHelperEmail("helpers@wedding.local")).toBe(true);
    expect(isAllowedHelperEmail("someone@else.com")).toBe(false);
  });

  it("prefers HELPER_EMAIL over VITE_HELPER_EMAIL when both are set", () => {
    process.env.HELPER_EMAIL = "a@b.com";
    process.env.VITE_HELPER_EMAIL = "c@d.com";
    expect(isAllowedHelperEmail("a@b.com")).toBe(true);
    expect(isAllowedHelperEmail("c@d.com")).toBe(false);
  });

  it("allows any authenticated user when no helper email is configured (back-compat)", () => {
    delete process.env.HELPER_EMAIL;
    delete process.env.VITE_HELPER_EMAIL;
    expect(isAllowedHelperEmail("anyone@x.com")).toBe(true);
  });

  it("rejects a missing/blank email when an allowlist is configured", () => {
    delete process.env.HELPER_EMAIL;
    process.env.VITE_HELPER_EMAIL = "h@w.com";
    expect(isAllowedHelperEmail("")).toBe(false);
    expect(isAllowedHelperEmail(null)).toBe(false);
  });
});
