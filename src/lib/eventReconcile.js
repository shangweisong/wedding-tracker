// Pure reconciliation of a party's per-event RSVP submission into the full set
// of `guest_event_rsvps` rows that should exist. Mirrors the server-side logic
// in submit_rsvp_events (0004_smart_rsvp.sql): eligibility is primary-authoritative and each
// body (primary + plus-one children) is materialized against the invited events.
//
// Used for optimistic UI and to unit-test the reconciliation rules. The SQL
// function remains the authoritative writer.

const VALID = new Set(['pending', 'confirmed', 'declined']);

// Same normalization used across name matching (see nameMatch.js).
const norm = (s) => String(s ?? '').toLowerCase().trim();

/**
 * Callers must pass the COMPLETE current answer set for every invited event on
 * every call (the RSVP form always renders and re-submits all invited events).
 * Any body×event not present in `submitted` is materialized as `pending` — this
 * mirrors a full re-submission, not a partial patch; do not use it to apply a
 * single-event delta or you will revert the other events in the optimistic view.
 *
 * @param {object}   input
 * @param {Array<{id:string,requires_meal?:boolean}>} input.invitedEvents  The primary's invited events.
 * @param {Array<{name:string,is_primary?:boolean}>}  input.bodies         Primary + reconciled child bodies.
 * @param {Array<{body_name?:string,is_primary?:boolean,event_id:string,status?:string,meal_choice?:string,dietary_notes?:string}>} input.submitted
 * @returns {{rows:Array, rejected:Array}}
 *   rows: one entry per body per invited event, ready to upsert.
 *   rejected: submitted entries that reference an un-invited event or unknown body.
 */
export function reconcileEventResponses({ invitedEvents, bodies, submitted } = {}) {
  const events = Array.isArray(invitedEvents) ? invitedEvents : [];
  const allBodies = Array.isArray(bodies) ? bodies : [];
  const subs = Array.isArray(submitted) ? submitted : [];

  const eventById = new Map(events.map((e) => [e.id, e]));
  const primary = allBodies.find((b) => b.is_primary);
  // Non-blank body_name is matched against CHILDREN only (the primary is reached
  // exclusively via a blank body_name) — matches the SQL submit_rsvp_events.
  const childByName = new Map(allBodies.filter((b) => !b.is_primary).map((b) => [norm(b.name), b]));

  const rejected = [];
  // Index valid submitted responses by "body|event" for O(1) lookup.
  const submittedByKey = new Map();
  for (const s of subs) {
    // Primary is identified by a blank body_name OR an explicit is_primary flag
    // (the token API emits the primary with its own name + is_primary=true).
    const isPrimaryResp = norm(s.body_name) === '' || s.is_primary === true;
    const targetBody = isPrimaryResp ? primary : childByName.get(norm(s.body_name));
    if (!targetBody) { rejected.push(s); continue; }          // unknown / de-listed body
    if (!eventById.has(s.event_id)) { rejected.push(s); continue; } // self-elevation guard
    submittedByKey.set(`${norm(targetBody.name)}|${s.event_id}`, s);
  }

  const rows = [];
  for (const body of allBodies) {
    for (const event of events) {
      const s = submittedByKey.get(`${norm(body.name)}|${event.id}`);
      const rawStatus = s?.status;
      const responded = !!s && VALID.has(rawStatus) && rawStatus !== 'pending';
      const status = VALID.has(rawStatus) ? rawStatus : 'pending';
      // Meal is meaningful only for a confirmed response on a meal-bearing event.
      // Length caps mirror the SQL column limits (meal_choice 60, dietary 500).
      const meal_choice = event.requires_meal && status === 'confirmed'
        ? String(s?.meal_choice ?? '').trim().slice(0, 60)
        : '';
      rows.push({
        body_name: body.name,
        is_primary: !!body.is_primary,
        event_id: event.id,
        invited: true,
        status,
        meal_choice,
        dietary_notes: String(s?.dietary_notes ?? '').trim().slice(0, 500),
        responded,
      });
    }
  }

  return { rows, rejected };
}
