import { createHash, timingSafeEqual } from "node:crypto";

// Constant-time string comparison for shared secrets (webhook secret, cron
// bearer). Hashing both sides first gives equal-length buffers, so
// timingSafeEqual never throws and length differences leak nothing.
export function secureCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
