// Pure helpers for the per-guest event-targeting grid (#78, Phase 4). Eligibility
// is stored per (primary guest, event) in guest_event_rsvps.invited.

/** Stable key for a (guest, event) pair. */
export const inviteKey = (guestId, eventId) => `${guestId}|${eventId}`;

/** Set of inviteKey() for every invited (guest, event) pair in the rows. */
export function buildInviteSet(rows) {
  const set = new Set();
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    if (r?.invited) set.add(inviteKey(r.guest_id, r.event_id));
  });
  return set;
}

/**
 * Field values for a NEW guest_event_rsvps row when first inviting a primary.
 * Seeds status/meal/dietary from the guest's existing LEGACY RSVP so enrolling a
 * guest who already answered under the old single-attendance flow isn't regressed
 * to pending by the mirror trigger. Mirrors submit_rsvp_events' child seeding.
 *
 * @param {object} guest  The primary guest row (legacy rsvp_status/meal_choice/…).
 * @param {string} eventId
 * @param {string|null} primaryMealEventId  The event that feeds legacy meal_choice.
 */
export function seedInviteRow(guest, eventId, primaryMealEventId) {
  const status = guest?.rsvp_status === 'confirmed' || guest?.rsvp_status === 'declined'
    ? guest.rsvp_status
    : 'pending';
  const carryMeal = status === 'confirmed' && eventId === primaryMealEventId;
  return {
    invited: true,
    status,
    meal_choice: carryMeal ? String(guest?.meal_choice ?? '').slice(0, 60) : '',
    dietary_notes: carryMeal ? String(guest?.dietary_notes ?? '').slice(0, 500) : '',
    responded_at: status === 'pending' ? null : (guest?.rsvp_at ?? null),
  };
}
