// Back-compat mirror: derive the legacy single-scalar RSVP fields
// (`guests.rsvp_status` / `meal_choice` / `rsvp_at`) from a body's per-event
// responses. This is the JS mirror of the Postgres trigger installed by
// migration 0004_smart_rsvp — the SQL trigger is the server-side source of truth; this
// module is used for optimistic UI and to unit-test the mapping rules.
//
// A "body" is a single guest row (a primary OR a plus-one child). Each body's
// legacy attendance is aggregated across the events it is invited to.

const VALID = new Set(['pending', 'confirmed', 'declined']);

// A response counts only when the body is actually invited to that event.
const counted = (resp) => resp && resp.invited !== false;

/**
 * @param {Array<{event_id:string,status:string,meal_choice?:string,dietary_notes?:string,invited?:boolean,responded_at?:string}>} eventResponses
 *   One body's responses across its invited events.
 * @param {string|null} primaryMealEventId  Event whose meal feeds legacy `meal_choice`.
 * @returns {{rsvp_status:string, meal_choice:string, dietary_notes:string, rsvp_at:string|null}|null}
 *   Returns `null` (a no-op) when the body has no invited events, mirroring the
 *   SQL trigger which leaves the legacy columns untouched in that case — callers
 *   must skip applying the mirror on null rather than overwriting with defaults.
 *   Note: when `primaryMealEventId` is null the SQL preserves existing legacy
 *   meal/dietary; this function returns '' for them, so callers should likewise
 *   not overwrite meal/dietary when no meal event is designated.
 */
export function deriveLegacyRsvp(eventResponses, primaryMealEventId) {
  const invited = (Array.isArray(eventResponses) ? eventResponses : []).filter(counted);

  // No invited events → no-op (the DB trigger leaves the legacy columns as-is).
  if (invited.length === 0) return null;

  // rsvp_status: confirmed if any invited event is confirmed; declined if every
  // invited event is declined; otherwise pending.
  let rsvp_status = 'pending';
  if (invited.some((r) => r.status === 'confirmed')) {
    rsvp_status = 'confirmed';
  } else if (invited.every((r) => r.status === 'declined')) {
    rsvp_status = 'declined';
  }

  // meal_choice / dietary_notes: from the designated primary meal event, if invited.
  let meal_choice = '';
  let dietary_notes = '';
  if (primaryMealEventId) {
    const mealResp = invited.find((r) => r.event_id === primaryMealEventId);
    if (mealResp) {
      meal_choice = String(mealResp.meal_choice ?? '').slice(0, 60);
      dietary_notes = String(mealResp.dietary_notes ?? '').slice(0, 500);
    }
  }

  // rsvp_at: the most recent responded_at across invited responses.
  let rsvp_at = null;
  for (const r of invited) {
    if (r.responded_at && (rsvp_at === null || r.responded_at > rsvp_at)) {
      rsvp_at = r.responded_at;
    }
  }

  return { rsvp_status: VALID.has(rsvp_status) ? rsvp_status : 'pending', meal_choice, dietary_notes, rsvp_at };
}
