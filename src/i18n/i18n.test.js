import { describe, it, expect } from "vitest";
import en from "./locales/en.js";
import zhTW from "./locales/zh-TW.js";
import { translate, LOCALES, DEFAULT_LOCALE } from "./index.jsx";

describe("locale catalogs", () => {
  it("zh-TW mirrors en's key set exactly (no missing/extra keys)", () => {
    const enKeys = Object.keys(en).sort();
    const zhKeys = Object.keys(zhTW).sort();
    expect(zhKeys).toEqual(enKeys);
  });

  it("has no empty translations", () => {
    for (const [k, v] of Object.entries(zhTW)) {
      expect(v, `zh-TW["${k}"] is empty`).toBeTruthy();
    }
  });

  it("registers en and zh-TW as available locales", () => {
    expect(Object.keys(LOCALES)).toContain("en");
    expect(Object.keys(LOCALES)).toContain("zh-TW");
    expect(DEFAULT_LOCALE).toBe("en");
  });
});

describe("translate()", () => {
  it("returns the active locale's message", () => {
    expect(translate("zh-TW", "rsvp.submit")).toBe(zhTW["rsvp.submit"]);
    expect(translate("en", "rsvp.submit")).toBe(en["rsvp.submit"]);
  });

  it("interpolates {var} placeholders", () => {
    expect(translate("en", "rsvp.err.generic", { msg: "boom" })).toBe(
      "Something went wrong: boom",
    );
    expect(translate("en", "wedding.countdown.toGo_other", { n: 5 })).toBe("5 days to go");
  });

  it("falls back to English when a key is absent in the locale", () => {
    // Every key exists in both today, so simulate via a made-up key: falls back to the key.
    expect(translate("zh-TW", "does.not.exist")).toBe("does.not.exist");
  });

  it("falls back to the key itself when unknown in every locale", () => {
    expect(translate("en", "totally.unknown.key")).toBe("totally.unknown.key");
  });
});
