import { describe, it, expect } from "vitest";
import { shouldPromptAngbao, applyAngbaoReceived, angbaoReceivedArgs } from "./angbao";

describe("shouldPromptAngbao", () => {
  it("prompts when checking in an angbao-pending guest with the feature on", () => {
    expect(shouldPromptAngbao({ angbao_given: false }, true, true)).toBe(true);
  });

  it("does not prompt when the guest is being checked out", () => {
    expect(shouldPromptAngbao({ angbao_given: false }, false, true)).toBe(false);
  });

  it("does not prompt when angbao is disabled", () => {
    expect(shouldPromptAngbao({ angbao_given: false }, true, false)).toBe(false);
  });

  it("does not prompt when the angbao was already received", () => {
    expect(shouldPromptAngbao({ angbao_given: true }, true, true)).toBe(false);
  });

  it("treats a missing angbao_given field (helper rows pre-migration) as pending", () => {
    expect(shouldPromptAngbao({}, true, true)).toBe(true);
  });
});

describe("applyAngbaoReceived", () => {
  const now = "2026-07-18T12:00:00.000Z";

  it("receiving sets the flag and auto-checks the guest in", () => {
    const guest = { id: "g1", angbao_given: false, checked_in: false, checked_in_at: null };
    expect(applyAngbaoReceived(guest, true, now)).toEqual({
      id: "g1",
      angbao_given: true,
      checked_in: true,
      checked_in_at: now,
    });
  });

  it("receiving keeps an existing check-in timestamp", () => {
    const guest = { id: "g1", angbao_given: false, checked_in: true, checked_in_at: "2026-07-18T11:00:00.000Z" };
    const out = applyAngbaoReceived(guest, true, now);
    expect(out.checked_in_at).toBe("2026-07-18T11:00:00.000Z");
    expect(out.checked_in).toBe(true);
  });

  it("clearing zeroes the amount and releases the draw number but keeps the guest checked in", () => {
    const guest = { id: "g1", angbao_given: true, angbao_amount: 88, draw_number: 3, checked_in: true, checked_in_at: now };
    expect(applyAngbaoReceived(guest, false, now)).toEqual({
      id: "g1",
      angbao_given: false,
      angbao_amount: 0,
      draw_number: null,
      checked_in: true,
      checked_in_at: now,
    });
  });

  it("never mutates the input guest", () => {
    const guest = { id: "g1", angbao_given: true, angbao_amount: 88, draw_number: 3 };
    applyAngbaoReceived(guest, false, now);
    expect(guest).toEqual({ id: "g1", angbao_given: true, angbao_amount: 88, draw_number: 3 });
  });
});

describe("angbaoReceivedArgs", () => {
  it("builds the set_guest_angbao_received RPC payload", () => {
    expect(angbaoReceivedArgs("abc", true)).toEqual({ p_guest_id: "abc", p_received: true });
  });

  it("coerces truthy/falsy to a strict boolean", () => {
    expect(angbaoReceivedArgs("abc", undefined)).toEqual({ p_guest_id: "abc", p_received: false });
  });
});
