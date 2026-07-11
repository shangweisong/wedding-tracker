import { describe, it, expect } from 'vitest';
import { guestFetchPlan } from './guestSource.js';

describe('guestFetchPlan — role-based guest data source (#99)', () => {
  it('routes the helper through the get_checkin_guests projection RPC', () => {
    expect(guestFetchPlan('helper')).toEqual({ kind: 'rpc', fn: 'get_checkin_guests' });
  });

  it('gives the couple the full direct table select', () => {
    expect(guestFetchPlan('couple')).toEqual({ kind: 'select', table: 'guests' });
  });

  it('falls back to the direct select when the role is not yet known (RLS is the real gate)', () => {
    expect(guestFetchPlan(null)).toEqual({ kind: 'select', table: 'guests' });
    expect(guestFetchPlan(undefined)).toEqual({ kind: 'select', table: 'guests' });
  });

  it('treats unknown role strings as non-helpers', () => {
    expect(guestFetchPlan('intruder')).toEqual({ kind: 'select', table: 'guests' });
  });
});
