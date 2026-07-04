import { describe, it, expect } from "vitest";
import en from "./locales/en.js";
import { translate, LOCALES, DEFAULT_LOCALE } from "./index.jsx";

const enKeys = Object.keys(en).sort();
const nonEnLocales = Object.keys(LOCALES).filter((c) => c !== "en");

describe("locale catalogs", () => {
  it("registers en plus the supported additional locales (#53, #63)", () => {
    expect(Object.keys(LOCALES)).toEqual(
      expect.arrayContaining(["en", "zh-TW", "zh-CN", "ms", "ja", "ko"]),
    );
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it.each(nonEnLocales)("%s mirrors en's key set exactly (no missing/extra keys)", (code) => {
    const keys = Object.keys(LOCALES[code].messages).sort();
    expect(keys).toEqual(enKeys);
  });

  it.each(nonEnLocales)("%s has no empty translations", (code) => {
    for (const [k, v] of Object.entries(LOCALES[code].messages)) {
      expect(v, `${code}["${k}"] is empty`).toBeTruthy();
    }
  });

  it.each(nonEnLocales)("%s has a non-empty switcher label", (code) => {
    expect(LOCALES[code].label, `${code} label`).toBeTruthy();
  });
});

describe("translate()", () => {
  it("returns the active locale's message", () => {
    expect(translate("zh-TW", "rsvp.submit")).toBe(LOCALES["zh-TW"].messages["rsvp.submit"]);
    expect(translate("en", "rsvp.submit")).toBe(en["rsvp.submit"]);
  });

  it("interpolates {var} placeholders", () => {
    expect(translate("en", "rsvp.err.generic", { msg: "boom" })).toBe(
      "Something went wrong: boom",
    );
    expect(translate("en", "wedding.countdown.toGo_other", { n: 5 })).toBe("5 days to go");
  });

  it("falls back to English when a key is absent in the locale", () => {
    expect(translate("ja", "does.not.exist")).toBe("does.not.exist");
  });

  it("falls back to the key itself when unknown in every locale", () => {
    expect(translate("en", "totally.unknown.key")).toBe("totally.unknown.key");
  });
});
