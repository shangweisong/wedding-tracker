// Same-origin translation proxy (#53 Phase 2, #59). The public CSP blocks a
// direct browser fetch to an external translation host, so the Wedding Setup
// "Auto-translate" button POSTs here. We prefer DeepL Free (higher quality) and
// fall back to MyMemory for languages DeepL doesn't support (e.g. Malay) or when
// no DeepL key is set. Provider logic + tests live in ./_lib/translate.js.
// Env: DEEPL_API_KEY (DeepL Free), MYMEMORY_EMAIL (optional, raises MyMemory quota).
//
// Auth: the button lives in the signed-in admin console, and the endpoint spends
// the couple's DeepL/MyMemory quota — so require the couple/helper Supabase token
// (same gate as generate-theme) instead of serving as an open translation relay.
import { translateItems, MAX_ITEMS } from "./_lib/translate.js";
import { authorizedHelperEmail, makeRateLimiter } from "./_lib/requireCoupleAuth.js";

// Generous for legit use (one request per locale per click) but caps abuse.
const rateLimited = makeRateLimiter({ windowMs: 60_000, max: 10 });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const callerEmail = await authorizedHelperEmail(req);
  if (!callerEmail) return res.status(401).json({ error: "unauthorized" });
  if (rateLimited(callerEmail)) {
    return res.status(429).json({ error: "too many requests — please wait a minute and try again" });
  }

  const { items, source = "en", target } = req.body ?? {};
  if (!target || !Array.isArray(items)) {
    return res.status(400).json({ error: "expected { items: [{ key, text }], target }" });
  }
  if (items.length > MAX_ITEMS) {
    return res.status(400).json({ error: `too many items (max ${MAX_ITEMS})` });
  }

  const results = await translateItems(items, { source, target });
  return res.status(200).json({ results });
}
