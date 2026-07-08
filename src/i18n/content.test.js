import { describe, it, expect } from "vitest";
import { localizeWedding, TRANSLATABLE_FIELDS } from "./content.js";

const base = {
  bride_name: "Amy",
  groom_name: "Ben",
  love_story: "We met in 2019.",
  dress_code: "Smart casual",
  venue_name: "Grand Hall",
  venue_address: "1 Main St",
  getting_there: "Take the train.",
  smoking_notice: "No smoking indoors.",
  parking_notice: "Basement parking.",
  fun_qa: [
    { id: "1", q: "How did you meet?", answer: "At work." },
    { id: "2", q: "Who cooks?", answer: "Amy." },
  ],
  content_translations: {
    "zh-TW": {
      love_story: "我們在2019年相識。",
      venue_name: "大禮堂",
      getting_there: "", // blank → should fall back to English
      fun_qa: [{ id: "1", q: "你們怎麼認識的？", answer: "在公司。" }],
    },
  },
};

describe("localizeWedding", () => {
  it("returns the wedding unchanged for English", () => {
    expect(localizeWedding(base, "en")).toBe(base);
  });

  it("returns the wedding unchanged when no translation exists for the locale", () => {
    expect(localizeWedding(base, "ja")).toBe(base);
  });

  it("overrides translated fields and keeps English for blank/missing ones", () => {
    const zh = localizeWedding(base, "zh-TW");
    expect(zh.love_story).toBe("我們在2019年相識。");
    expect(zh.venue_name).toBe("大禮堂");
    expect(zh.getting_there).toBe("Take the train."); // blank translation → English
    expect(zh.dress_code).toBe("Smart casual"); // not translated → English
    expect(zh.bride_name).toBe("Amy"); // names never translated
  });

  it("merges fun_qa by id with per-field fallback", () => {
    const zh = localizeWedding(base, "zh-TW");
    expect(zh.fun_qa[0]).toMatchObject({ id: "1", q: "你們怎麼認識的？", answer: "在公司。" });
    // id "2" has no translation → unchanged English
    expect(zh.fun_qa[1]).toMatchObject({ id: "2", q: "Who cooks?", answer: "Amy." });
  });

  it("does not mutate the original wedding object", () => {
    const snapshot = JSON.stringify(base);
    localizeWedding(base, "zh-TW");
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it("exposes the translatable field list", () => {
    expect(TRANSLATABLE_FIELDS).toContain("love_story");
    expect(TRANSLATABLE_FIELDS).toContain("bride_name");
    expect(TRANSLATABLE_FIELDS).toContain("groom_name");
  });
});
