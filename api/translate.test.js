import { describe, it, expect } from "vitest";
import handler from "./translate.js";

function mockRes() {
  const res = { statusCode: null, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  res.end = () => res;
  return res;
}

describe("translate endpoint auth (#quota-abuse)", () => {
  it("rejects non-POST methods", async () => {
    const res = mockRes();
    await handler({ method: "GET", headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it("returns 401 when no Supabase token is presented, before any validation", async () => {
    const res = mockRes();
    await handler(
      { method: "POST", headers: {}, body: { items: [{ key: "k", text: "hi" }], target: "zh-TW" } },
      res,
    );
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 for an unverifiable token (fails closed)", async () => {
    const res = mockRes();
    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer not-a-real-token" },
        body: { items: [{ key: "k", text: "hi" }], target: "zh-TW" },
      },
      res,
    );
    expect(res.statusCode).toBe(401);
  });
});
