import { describe, it, expect } from 'vitest';
import { checkinArgs, applyCheckin } from './checkin.js';

describe('checkinArgs — RPC payload shaping', () => {
  it('maps to the set_guest_checkin parameter names', () => {
    expect(checkinArgs('g1', true)).toEqual({ p_guest_id: 'g1', p_checked_in: true });
  });

  it('coerces the checked-in flag to a real boolean', () => {
    expect(checkinArgs('g1', 0)).toEqual({ p_guest_id: 'g1', p_checked_in: false });
    expect(checkinArgs('g1', 1)).toEqual({ p_guest_id: 'g1', p_checked_in: true });
  });
});

describe('applyCheckin — optimistic guest update', () => {
  const guest = { id: 'g1', name: 'Tan Wei Ming', checked_in: false, checked_in_at: null, notes: 'Best man' };

  it('sets checked_in and stamps checked_in_at when checking in', () => {
    const out = applyCheckin(guest, true, '2024-06-15T18:32:00.000Z');
    expect(out.checked_in).toBe(true);
    expect(out.checked_in_at).toBe('2024-06-15T18:32:00.000Z');
  });

  it('clears checked_in_at when unchecking', () => {
    const arrived = { ...guest, checked_in: true, checked_in_at: '2024-06-15T18:32:00.000Z' };
    const out = applyCheckin(arrived, false, '2024-06-15T19:00:00.000Z');
    expect(out.checked_in).toBe(false);
    expect(out.checked_in_at).toBeNull();
  });

  it('preserves every other guest field', () => {
    const out = applyCheckin(guest, true, '2024-06-15T18:32:00.000Z');
    expect(out.id).toBe('g1');
    expect(out.name).toBe('Tan Wei Ming');
    expect(out.notes).toBe('Best man');
  });

  it('does not mutate the input guest', () => {
    const snapshot = { ...guest };
    applyCheckin(guest, true, '2024-06-15T18:32:00.000Z');
    expect(guest).toEqual(snapshot);
  });
});
