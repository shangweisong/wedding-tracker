import { describe, it, expect, afterEach } from "vitest";
import { isAllowedHelperEmail, resolveThemeModel } from "./generate-theme.js";

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
