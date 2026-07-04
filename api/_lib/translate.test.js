import { describe, it, expect, vi } from "vitest";
import { translateItems, deeplTargetLang, supportsDeepl } from "./translate.js";

// A fake fetch that routes DeepL POSTs and MyMemory GETs to canned responses.
// DeepL echoes each input as `DE:<text>`; MyMemory echoes as `MM:<q>`.
function fakeFetch({ deeplStatus = 200, mymemoryStatus = 200 } = {}) {
  return vi.fn(async (url, init) => {
    const u = String(url);
    if (u.includes("deepl")) {
      const texts = new URLSearchParams(init.body).getAll("text");
      return {
        ok: deeplStatus >= 200 && deeplStatus < 300,
        status: deeplStatus,
        json: async () => ({ translations: texts.map((t) => ({ text: `DE:${t}` })) }),
      };
    }
    // MyMemory GET
    const q = new URL(u).searchParams.get("q");
    return {
      ok: mymemoryStatus >= 200 && mymemoryStatus < 300,
      status: mymemoryStatus,
      json: async () => ({ responseData: { translatedText: `MM:${q}` } }),
    };
  });
}

const items = [
  { key: "love_story", text: "We met in college." },
  { key: "venue_name", text: "Grand Ballroom" },
];

describe("deeplTargetLang", () => {
  it("maps app locale codes to DeepL codes", () => {
    expect(deeplTargetLang("zh-TW")).toBe("ZH-HANT");
    expect(deeplTargetLang("zh-CN")).toBe("ZH-HANS");
    expect(deeplTargetLang("ja")).toBe("JA");
    expect(deeplTargetLang("ko")).toBe("KO");
  });
  it("returns null for languages DeepL does not support (e.g. Malay)", () => {
    expect(deeplTargetLang("ms")).toBeNull();
  });
});

describe("supportsDeepl", () => {
  it("requires both an API key and a supported target", () => {
    expect(supportsDeepl("zh-TW", "key")).toBe(true);
    expect(supportsDeepl("zh-TW", "")).toBe(false);
    expect(supportsDeepl("ms", "key")).toBe(false);
  });
});

describe("translateItems", () => {
  it("uses DeepL for supported targets when a key is present", async () => {
    const fetchImpl = fakeFetch();
    const results = await translateItems(items, { target: "zh-TW", deeplKey: "key", fetchImpl });
    expect(results).toEqual([
      { key: "love_story", text: "DE:We met in college." },
      { key: "venue_name", text: "DE:Grand Ballroom" },
    ]);
    // One batched DeepL call, no MyMemory calls.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("deepl");
  });

  it("falls back to MyMemory for targets DeepL cannot handle (Malay)", async () => {
    const fetchImpl = fakeFetch();
    const results = await translateItems(items, { target: "ms", deeplKey: "key", fetchImpl });
    expect(results[0].text).toBe("MM:We met in college.");
    for (const call of fetchImpl.mock.calls) {
      expect(String(call[0])).toContain("mymemory");
    }
  });

  it("uses MyMemory when no DeepL key is configured", async () => {
    const fetchImpl = fakeFetch();
    const results = await translateItems(items, { target: "zh-TW", deeplKey: "", fetchImpl });
    expect(results[0].text).toBe("MM:We met in college.");
    expect(String(fetchImpl.mock.calls[0][0])).toContain("mymemory");
  });

  it("fills blanks via MyMemory when a DeepL batch fails", async () => {
    const fetchImpl = fakeFetch({ deeplStatus: 456 });
    const results = await translateItems(items, { target: "ja", deeplKey: "key", fetchImpl });
    expect(results[0].text).toBe("MM:We met in college.");
    expect(results[1].text).toBe("MM:Grand Ballroom");
  });

  it("passes through blank/invalid items without translating them", async () => {
    const fetchImpl = fakeFetch();
    const mixed = [
      { key: "love_story", text: "Hello" },
      { key: "empty", text: "   " },
      { key: null, text: "no key" },
    ];
    const results = await translateItems(mixed, { target: "zh-TW", deeplKey: "key", fetchImpl });
    expect(results).toEqual([
      { key: "love_story", text: "DE:Hello" },
      { key: "empty", text: "" },
      { key: null, text: "" },
    ]);
    // Only the one valid item is sent to DeepL.
    expect(new URLSearchParams(fetchImpl.mock.calls[0][1].body).getAll("text")).toEqual(["Hello"]);
  });

  it("chunks large batches into DeepL requests of at most 50 texts", async () => {
    const fetchImpl = fakeFetch();
    const many = Array.from({ length: 51 }, (_, i) => ({ key: `k${i}`, text: `t${i}` }));
    await translateItems(many, { target: "zh-TW", deeplKey: "key", fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(new URLSearchParams(fetchImpl.mock.calls[0][1].body).getAll("text")).toHaveLength(50);
    expect(new URLSearchParams(fetchImpl.mock.calls[1][1].body).getAll("text")).toHaveLength(1);
  });

  it("sends the DeepL auth key and target_lang", async () => {
    const fetchImpl = fakeFetch();
    await translateItems(items, { target: "ko", deeplKey: "secret-key", fetchImpl });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.Authorization).toBe("DeepL-Auth-Key secret-key");
    expect(new URLSearchParams(init.body).get("target_lang")).toBe("KO");
  });
});
