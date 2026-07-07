import { describe, it, expect } from 'vitest';
import { inviteKey, buildInviteSet, seedInviteRow } from './eventTargeting.js';

describe('buildInviteSet', () => {
  it('collects only invited (guest,event) pairs', () => {
    const rows = [
      { guest_id: 'g1', event_id: 'e1', invited: true },
      { guest_id: 'g1', event_id: 'e2', invited: false },
      { guest_id: 'g2', event_id: 'e1', invited: true },
    ];
    const set = buildInviteSet(rows);
    expect(set.has(inviteKey('g1', 'e1'))).toBe(true);
    expect(set.has(inviteKey('g1', 'e2'))).toBe(false);
    expect(set.has(inviteKey('g2', 'e1'))).toBe(true);
    expect(set.size).toBe(2);
  });

  it('tolerates null/undefined', () => {
    expect(buildInviteSet(null).size).toBe(0);
    expect(buildInviteSet(undefined).size).toBe(0);
  });
});

describe('seedInviteRow — enrollment seeding (avoids mirror-trigger regression)', () => {
  it('seeds pending for a guest who has not answered', () => {
    const row = seedInviteRow({ rsvp_status: 'pending' }, 'e1', 'e1');
    expect(row).toMatchObject({ invited: true, status: 'pending', meal_choice: '', dietary_notes: '', responded_at: null });
  });

  it('preserves a legacy confirmed status when enrolling', () => {
    const guest = { rsvp_status: 'confirmed', rsvp_at: '2026-01-01T00:00:00.000Z' };
    expect(seedInviteRow(guest, 'e1', 'e2')).toMatchObject({ status: 'confirmed', responded_at: '2026-01-01T00:00:00.000Z' });
  });

  it('preserves a legacy declined status', () => {
    expect(seedInviteRow({ rsvp_status: 'declined' }, 'e1', 'e1').status).toBe('declined');
  });

  it('carries meal/dietary only onto the designated meal event, and only when confirmed', () => {
    const guest = { rsvp_status: 'confirmed', meal_choice: 'Vegetarian', dietary_notes: 'No nuts' };
    // this event IS the meal event → meal carried
    expect(seedInviteRow(guest, 'meal', 'meal')).toMatchObject({ meal_choice: 'Vegetarian', dietary_notes: 'No nuts' });
    // a non-meal event → blank
    expect(seedInviteRow(guest, 'tea', 'meal')).toMatchObject({ meal_choice: '', dietary_notes: '' });
    // declined guest → no meal even on the meal event
    expect(seedInviteRow({ rsvp_status: 'declined', meal_choice: 'Halal' }, 'meal', 'meal').meal_choice).toBe('');
  });

  it('always marks the row invited', () => {
    expect(seedInviteRow({ rsvp_status: 'pending' }, 'e1', null).invited).toBe(true);
  });
});
