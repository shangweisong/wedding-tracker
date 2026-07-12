import { describe, it, expect } from "vitest";
import { escapeHtml, sanitizeSubject } from "./escapeHtml.js";

describe("escapeHtml", () => {
  it("escapes the five HTML special characters", () => {
    expect(escapeHtml(`<script>alert("x&y")</script>'`)).toBe(
      "&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;/script&gt;&#39;",
    );
  });

  it("neutralizes an injected link", () => {
    const out = escapeHtml('<a href="https://evil.example">click</a>');
    expect(out).not.toContain("<a");
    expect(out).toContain("&lt;a href=");
  });

  it("returns plain text unchanged", () => {
    expect(escapeHtml("Tan Ah Kow · vegetarian, no peanuts")).toBe(
      "Tan Ah Kow · vegetarian, no peanuts",
    );
  });

  it("stringifies null/undefined/numbers safely", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(42)).toBe("42");
  });
});

describe("sanitizeSubject", () => {
  it("strips CR/LF so a value cannot smuggle extra headers", () => {
    expect(sanitizeSubject("Guest\r\nBcc: victim@example.com")).toBe(
      "Guest Bcc: victim@example.com",
    );
  });

  it("passes ordinary subjects through", () => {
    expect(sanitizeSubject("RSVP change: Tan Ah Kow")).toBe("RSVP change: Tan Ah Kow");
  });

  it("handles null/undefined", () => {
    expect(sanitizeSubject(null)).toBe("");
  });
});
