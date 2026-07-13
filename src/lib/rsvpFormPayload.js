// Pure builders for the smart-RSVP (per-event) form (#78, Phase 5). They convert
// between the form's per-body/per-event state and the submit_rsvp_events payload,
// and mirror the hydration read from get_guest_by_rsvp_token. Kept pure so the
// form component stays presentational and the mapping is unit-tested.
//
// Shapes:
//   bodies:     [{ key, name, is_primary }]  (key is a stable form id)
//   attendance: { [bodyKey]: { [eventId]: 'confirmed' | 'declined' } }
//   meals:      { [bodyKey]: { [eventId]: string } }
//   events:     [{ id, requires_meal }]

const norm = (s) => String(s ?? '').trim().toLowerCase();
const ANSWERED = new Set(['confirmed', 'declined']);

/**
 * Build the submit_rsvp_events `p_event_responses` array from form state.
 * Emits one entry per answered (body, event); primary rows carry the global
 * dietary note, meal only rides confirmed responses on meal-bearing events.
 */
export function buildEventResponses({ bodies = [], attendance = {}, meals = {}, events = [], dietary = '' } = {}) {
  const out = [];
  for (const body of bodies) {
    if (!body.is_primary && norm(body.name) === '') continue; // skip blank plus-ones
    for (const ev of events) {
      const status = attendance?.[body.key]?.[ev.id];
      if (!ANSWERED.has(status)) continue; // only send explicit answers
      const confirmed = status === 'confirmed';
      out.push({
        body_name: body.is_primary ? '' : String(body.name).trim(),
        is_primary: !!body.is_primary,
        event_id: ev.id,
        status,
        meal_choice: confirmed && ev.requires_meal ? String(meals?.[body.key]?.[ev.id] ?? '').slice(0, 60) : '',
        dietary_notes: body.is_primary ? String(dietary ?? '').slice(0, 500) : '',
      });
    }
  }
  return out;
}

/**
 * Decline-everything payload for the overall "Sorry, I can't make it" answer
 * (#131): one primary declined row per event, so the rsvp-status mirror sees
 * every invited event declined and lands the guest on 'declined'. Plus-one
 * rows are unnecessary — the same submit clears p_plus_one_names.
 */
export function declineAllResponses(events, dietary = '') {
  return (Array.isArray(events) ? events : []).map((ev) => ({
    body_name: '',
    is_primary: true,
    event_id: ev.id,
    status: 'declined',
    meal_choice: '',
    dietary_notes: String(dietary ?? '').slice(0, 500),
  }));
}

/**
 * Map server `event_responses` back into { attendance, meals } keyed by body.
 * Children are matched by normalized name; the primary by its is_primary flag.
 */
export function hydrateEventState(eventResponses, bodies = []) {
  const primaryKey = bodies.find((b) => b.is_primary)?.key;
  const childKeyByName = new Map(bodies.filter((b) => !b.is_primary).map((b) => [norm(b.name), b.key]));
  const attendance = {};
  const meals = {};
  for (const r of Array.isArray(eventResponses) ? eventResponses : []) {
    const key = r.is_primary ? primaryKey : childKeyByName.get(norm(r.body_name));
    if (!key) continue;
    (attendance[key] ||= {})[r.event_id] = r.status;
    (meals[key] ||= {})[r.event_id] = r.meal_choice || '';
  }
  return { attendance, meals };
}

/** True when the primary has a confirmed/declined answer for every event. */
export function primaryAnsweredAllEvents(attendance, primaryKey, events = []) {
  const forBody = attendance?.[primaryKey] || {};
  return (Array.isArray(events) ? events : []).every((ev) => ANSWERED.has(forBody[ev.id]));
}
