// Pure runsheet time helpers — no side effects, fully testable (#121).
//
// Upgraded item shape (stored in the weddings.runsheet JSONB array):
//   { id, event, involved, comments,
//     startTime: 'HH:MM' | '',      — 24h start time; '' = unscheduled
//     durationMin: number | null,   — integer minutes; null = unknown
//     timeText: string,             — original legacy free-text time, kept verbatim
//     durationText: string }        — original legacy free-text duration
//
// Legacy items ({ time: '7am', duration: '30 mins', ... }) are upgraded on READ
// via upgradeRunsheet(); the raw text is always preserved so a wrong parse can
// never lose what the couple actually typed. The upgrade is idempotent and
// never writes on load — the new shape persists on the couple's next edit.

const pad2 = (n) => String(n).padStart(2, "0");

const toHHMM = (h, min, meridiem) => {
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    if (meridiem === "pm" && h !== 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;
  } else if (h > 23) {
    return null;
  }
  if (min > 59) return null;
  return `${pad2(h)}:${pad2(min)}`;
};

/**
 * Best-effort parse of a free-text time into 'HH:MM' (24h), or null.
 * Accepts 24h ("19:30"), 12h ("3:30 PM", "7am", "7.30pm"), compact ("0730",
 * "730pm") and ranges ("7:00-7:30", "7am – 8am" — the start wins). A bare
 * hour with no am/pm reads as the 24h clock; the caller keeps the raw text,
 * so a wrong guess is always recoverable.
 */
export function parseTimeToHHMM(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/([ap])\.m\.?/g, "$1m"); // "p.m." → "pm"
  s = s.split(/\s+to\s+|[-–—]/)[0].trim(); // range → start
  if (!s) return null;

  let m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (m) return toHHMM(Number(m[1]), m[2] ? Number(m[2]) : 0, m[3] || null);

  m = s.match(/^(\d{3,4})\s*(am|pm)?$/); // compact "0730" / "730pm"
  if (m) {
    const d = m[1];
    return toHHMM(Number(d.slice(0, -2)), Number(d.slice(-2)), m[2] || null);
  }
  return null;
}

/**
 * Best-effort parse of a free-text duration into integer minutes, or null.
 * Accepts plain numbers ("30"), unit strings ("30 mins", "1.5h", "1h 30m",
 * "1 hour 30 minutes") and h:mm ("1:30"). Non-positive → null.
 */
export function parseDurationToMinutes(raw) {
  if (raw == null) return null;
  const positive = (n) => {
    const t = Math.round(n);
    return t > 0 ? t : null;
  };
  if (typeof raw === "number") return Number.isFinite(raw) ? positive(raw) : null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;

  let m = s.match(/^(\d{1,2}):(\d{2})$/); // h:mm
  if (m) return positive(Number(m[1]) * 60 + Number(m[2]));

  m = s.match(/^(\d+(?:\.\d+)?)$/); // bare number = minutes
  if (m) return positive(Number(m[1]));

  const HOURS = "(?:hours|hour|hrs|hr|h)";
  const MINS = "(?:minutes|minute|mins|min|m)";
  m = s.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*${HOURS}\\s*(?:(\\d+)\\s*${MINS})?$`));
  if (m) return positive(Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0));

  m = s.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*${MINS}$`));
  if (m) return positive(Number(m[1]));

  return null;
}

/** 'HH:MM' → '1:30 PM' display label; '' for empty/invalid input. */
export function formatTimeLabel(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm ?? ""));
  if (!m) return "";
  let h = Number(m[1]);
  if (h > 23 || Number(m[2]) > 59) return "";
  const meridiem = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m[2]} ${meridiem}`;
}

/** Upgrade one legacy item to the structured shape; already-upgraded items pass through. */
export function upgradeRunsheetItem(item) {
  if (!item || typeof item !== "object") return item;
  if ("startTime" in item) return item; // already upgraded
  const { time, duration, ...rest } = item;
  return {
    ...rest,
    startTime: parseTimeToHHMM(time) ?? "",
    durationMin: parseDurationToMinutes(duration),
    timeText: time ?? "",
    durationText: duration ?? "",
  };
}

/** Upgrade a whole runsheet array (idempotent); non-arrays → []. */
export function upgradeRunsheet(items) {
  return Array.isArray(items) ? items.map(upgradeRunsheetItem) : [];
}
