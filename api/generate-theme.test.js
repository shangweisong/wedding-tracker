import { describe, it, expect, afterEach } from "vitest";
import { isAllowedHelperEmail, resolveThemeModel } from "./generate-theme.js";

const SNAPSHOT = { ...process.env };
afterEach(() => {
  process.env = { ...SNAPSHOT };
});

describe("isAllowedHelperEmail", () => {
  it("allows the couple email case-insensitively", () => {
    delete process.env.COUPLE_EMAIL;
    delete process.env.HELPER_EMAIL;
    process.env.VITE_COUPLE_EMAIL = "Couple@Wedding.local";
    process.env.VITE_HELPER_EMAIL = "Helper@Wedding.local";
    expect(isAllowedHelperEmail("couple@wedding.local")).toBe(true);
    expect(isAllowedHelperEmail("helper@wedding.local")).toBe(true);
    expect(isAllowedHelperEmail("someone@else.com")).toBe(false);
  });

  it("prefers COUPLE_EMAIL / HELPER_EMAIL server overrides over VITE_ vars", () => {
    process.env.COUPLE_EMAIL = "a@b.com";
    process.env.HELPER_EMAIL = "c@d.com";
    process.env.VITE_COUPLE_EMAIL = "x@y.com";
    process.env.VITE_HELPER_EMAIL = "p@q.com";
    expect(isAllowedHelperEmail("a@b.com")).toBe(true);
    expect(isAllowedHelperEmail("c@d.com")).toBe(true);
    expect(isAllowedHelperEmail("x@y.com")).toBe(false);
    expect(isAllowedHelperEmail("p@q.com")).toBe(false);
  });

  it("allows any authenticated user when no emails are configured (back-compat)", () => {
    delete process.env.COUPLE_EMAIL;
    delete process.env.HELPER_EMAIL;
    delete process.env.VITE_COUPLE_EMAIL;
    delete process.env.VITE_HELPER_EMAIL;
    expect(isAllowedHelperEmail("anyone@x.com")).toBe(true);
  });

  it("rejects a missing/blank email when an allowlist is configured", () => {
    delete process.env.COUPLE_EMAIL;
    delete process.env.HELPER_EMAIL;
    process.env.VITE_COUPLE_EMAIL = "c@w.com";
    process.env.VITE_HELPER_EMAIL = "h@w.com";
    expect(isAllowedHelperEmail("")).toBe(false);
    expect(isAllowedHelperEmail(null)).toBe(false);
  });
});

describe("resolveThemeModel (#66)", () => {
  it("prefers NVIDIA_MODEL for the nvidia provider", () => {
    process.env.NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";
    process.env.THEME_AI_MODEL = "shared-model";
    expect(resolveThemeModel("nvidia")).toBe("meta/llama-3.3-70b-instruct");
  });

  it("falls back to THEME_AI_MODEL for nvidia when NVIDIA_MODEL is unset", () => {
    delete process.env.NVIDIA_MODEL;
    process.env.THEME_AI_MODEL = "shared-model";
    expect(resolveThemeModel("nvidia")).toBe("shared-model");
  });

  it("ignores NVIDIA_MODEL for non-nvidia providers", () => {
    process.env.NVIDIA_MODEL = "nv-only";
    process.env.THEME_AI_MODEL = "shared-model";
    expect(resolveThemeModel("openai")).toBe("shared-model");
    expect(resolveThemeModel("anthropic")).toBe("shared-model");
  });

  it("returns undefined (provider default) when nothing is configured", () => {
    delete process.env.NVIDIA_MODEL;
    delete process.env.THEME_AI_MODEL;
    expect(resolveThemeModel("nvidia")).toBeUndefined();
    expect(resolveThemeModel("anthropic")).toBeUndefined();
  });
});
