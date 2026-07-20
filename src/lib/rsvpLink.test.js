import { describe, it, expect } from "vitest";
import { buildRsvpLink } from "./rsvpLink.js";

describe("buildRsvpLink", () => {
  it("builds a personalized link when a token is given", () => {
    expect(buildRsvpLink("https://example.com", "abc-123")).toBe(
      "https://example.com/rsvp?token=abc-123"
    );
  });

  it("builds the generic link when the token is missing", () => {
    expect(buildRsvpLink("https://example.com")).toBe("https://example.com/rsvp");
    expect(buildRsvpLink("https://example.com", "")).toBe("https://example.com/rsvp");
    expect(buildRsvpLink("https://example.com", null)).toBe("https://example.com/rsvp");
  });

  it("URL-encodes the token", () => {
    expect(buildRsvpLink("https://example.com", "a b&c")).toBe(
      "https://example.com/rsvp?token=a%20b%26c"
    );
  });
});
