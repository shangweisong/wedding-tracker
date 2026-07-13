// Relationship-targeted event visibility for the public RSVP form (#131).
// An event with a non-empty `audience_groups` is shown only to guests whose
// relationship_group matches; an empty/missing audience means everyone. This
// is a presentational declutter, NOT a security boundary — relationship_group
// is guest-selected on the form, and the real gate stays guest_event_rsvps.invited.

const norm = (s) => String(s ?? '').trim().toLowerCase();

// Targetable groups: the guest-facing relationship taxonomy minus the opt-in
// fun value 'complicated' (the couple can't meaningfully target it) and minus
// party (bride/groom), which the public form never collects up-front.
export const EVENT_AUDIENCES = ['family', 'friends', 'colleagues', 'other'];

/** Canonical form: sorted, deduped, valid audiences only. Non-arrays → []. */
export function normalizeAudienceGroups(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(norm).filter((g) => EVENT_AUDIENCES.includes(g)))].sort();
}

/**
 * Filter events by the guest's relationship group. Unrestricted events are
 * always visible; restricted events stay hidden until the relationship matches
 * (unknown/'' /'complicated' see only unrestricted ones). If the filter would
 * hide EVERY event, all of them are shown instead — the guest was explicitly
 * invited to each (guest_event_rsvps.invited), and a declutter must never
 * leave them an empty form that silently strands their RSVP on 'pending'.
 */
export function visibleEventsFor(events, relationshipGroup) {
  if (!Array.isArray(events)) return [];
  const group = norm(relationshipGroup);
  const visible = events.filter((ev) => {
    const audience = normalizeAudienceGroups(ev?.audience_groups);
    return audience.length === 0 || audience.includes(group);
  });
  return visible.length > 0 ? visible : events;
}
