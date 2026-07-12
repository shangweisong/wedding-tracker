// Guest-controlled values (name, meal choice, dietary notes — set via the public
// RSVP form) are interpolated into outbound email HTML. Email clients render that
// HTML, so escape everything dynamic to keep injected markup/links inert.

const ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

// Subjects are plain text, not HTML, but must never contain CR/LF — a newline in
// a value could otherwise smuggle extra headers on header-based transports.
export function sanitizeSubject(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[\r\n]+/g, " ").trim();
}
