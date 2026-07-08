// Build an RFC 5545-compliant all-day .ics invite for the wedding day.
// `fallbackSummary` is passed in (localized) by the caller since this is a pure
// helper with no `t` in scope.
export function buildIcsDataUrl(wedding, fallbackSummary = "Wedding") {
  if (!wedding?.wedding_date) return null;
  const [y, m, d] = wedding.wedding_date.split("-").map(Number);
  const pad = (n) => String(n).padStart(2, "0");
  const dateStr = `${y}${pad(m)}${pad(d)}`;
  // All-day DTEND is exclusive per RFC 5545, so DTEND must be the day AFTER
  // DTSTART — otherwise DTSTART === DTEND yields a zero-length event. Date.UTC
  // handles month/year rollover (e.g. Jan 31 -> Feb 1).
  const end = new Date(Date.UTC(y, m - 1, d + 1));
  const endStr = `${end.getUTCFullYear()}${pad(end.getUTCMonth() + 1)}${pad(end.getUTCDate())}`;
  // DTSTAMP (generation time, UTC) and UID are both required VEVENT properties;
  // some clients reject or drop events without them. UID is stable per wedding.
  const now = new Date();
  const dtStamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const uid = `${wedding.id || wedding.slug || dateStr}-wedding@weddingtracker`;
  const summary = wedding.bride_name && wedding.groom_name
    ? `${wedding.bride_name} & ${wedding.groom_name}'s Wedding`
    : fallbackSummary;
  const location = [wedding.venue_name, wedding.venue_address].filter(Boolean).join(", ");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WeddingTracker//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${endStr}`,
    `SUMMARY:${summary}`,
    location ? `LOCATION:${location}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
}
