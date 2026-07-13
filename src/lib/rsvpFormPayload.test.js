import { describe, it, expect } from 'vitest';
import { buildEventResponses, declineAllResponses, hydrateEventState, primaryAnsweredAllEvents } from './rsvpFormPayload.js';

const bodies = [
  { key: '__p', name: 'Alice', is_primary: true },
  { key: 'p0', name: 'Bob', is_primary: false },
];
const events = [
  { id: 'tea', requires_meal: false },
  { id: 'banquet', requires_meal: true },
];

describe('buildEventResponses', () => {
  it('emits a response per answered body×event, primary as blank body_name', () => {
    const attendance = { __p: { tea: 'confirmed', banquet: 'confirmed' }, p0: { banquet: 'declined' } };
    const meals = { __p: { banquet: 'Vegetarian' } };
    const out = buildEventResponses({ bodies, attendance, meals, events, dietary: 'No nuts' });
    expect(out).toContainEqual({ body_name: '', is_primary: true, event_id: 'tea', status: 'confirmed', meal_choice: '', dietary_notes: 'No nuts' });
    expect(out).toContainEqual({ body_name: '', is_primary: true, event_id: 'banquet', status: 'confirmed', meal_choice: 'Vegetarian', dietary_notes: 'No nuts' });
    expect(out).toContainEqual({ body_name: 'Bob', is_primary: false, event_id: 'banquet', status: 'declined', meal_choice: '', dietary_notes: '' });
    expect(out).toHaveLength(3); // Bob/tea was not answered
  });

  it('blanks meal for non-meal events and for declined responses', () => {
    const attendance = { __p: { banquet: 'declined', tea: 'confirmed' } };
    const meals = { __p: { banquet: 'Halal', tea: 'Halal' } };
    const out = buildEventResponses({ bodies, attendance, meals, events, dietary: '' });
    expect(out.find((r) => r.event_id === 'banquet').meal_choice).toBe(''); // declined
    expect(out.find((r) => r.event_id === 'tea').meal_choice).toBe('');     // not a meal event
  });

  it('skips blank-named plus-one bodies', () => {
    const bs = [{ key: '__p', name: 'Alice', is_primary: true }, { key: 'p0', name: '  ', is_primary: false }];
    const attendance = { __p: { tea: 'confirmed' }, p0: { tea: 'confirmed' } };
    const out = buildEventResponses({ bodies: bs, attendance, meals: {}, events, dietary: '' });
    expect(out.every((r) => r.is_primary)).toBe(true);
  });

  it('only dietary on the primary rows', () => {
    const attendance = { __p: { tea: 'confirmed' }, p0: { tea: 'confirmed' } };
    const out = buildEventResponses({ bodies, attendance, meals: {}, events, dietary: 'No shellfish' });
    expect(out.find((r) => r.is_primary).dietary_notes).toBe('No shellfish');
    expect(out.find((r) => !r.is_primary).dietary_notes).toBe('');
  });
});

describe('declineAllResponses', () => {
  it('emits one primary declined row per event, carrying the dietary note', () => {
    const out = declineAllResponses(events, 'No nuts');
    expect(out).toEqual([
      { body_name: '', is_primary: true, event_id: 'tea', status: 'declined', meal_choice: '', dietary_notes: 'No nuts' },
      { body_name: '', is_primary: true, event_id: 'banquet', status: 'declined', meal_choice: '', dietary_notes: 'No nuts' },
    ]);
  });

  it('defaults dietary to blank and tolerates empty/non-array events', () => {
    expect(declineAllResponses(events)[0].dietary_notes).toBe('');
    expect(declineAllResponses([])).toEqual([]);
    expect(declineAllResponses(null)).toEqual([]);
  });

  it('clamps dietary to 500 chars like buildEventResponses', () => {
    const out = declineAllResponses(events, 'x'.repeat(600));
    expect(out[0].dietary_notes).toHaveLength(500);
  });
});

describe('hydrateEventState', () => {
  it('maps server event_responses back into attendance + meal state keyed by body', () => {
    const responses = [
      { body_name: 'Alice', is_primary: true, event_id: 'banquet', status: 'confirmed', meal_choice: 'Vegetarian' },
      { body_name: 'Bob', is_primary: false, event_id: 'tea', status: 'declined', meal_choice: '' },
    ];
    const { attendance, meals } = hydrateEventState(responses, bodies);
    expect(attendance.__p.banquet).toBe('confirmed');
    expect(meals.__p.banquet).toBe('Vegetarian');
    expect(attendance.p0.tea).toBe('declined');
  });

  it('matches children case-insensitively and ignores unknown bodies', () => {
    const responses = [
      { body_name: '  bob ', is_primary: false, event_id: 'tea', status: 'confirmed', meal_choice: '' },
      { body_name: 'Ghost', is_primary: false, event_id: 'tea', status: 'confirmed', meal_choice: '' },
    ];
    const { attendance } = hydrateEventState(responses, bodies);
    expect(attendance.p0.tea).toBe('confirmed');
    expect(Object.keys(attendance)).toEqual(['p0']);
  });

  it('tolerates null input', () => {
    expect(hydrateEventState(null, bodies)).toEqual({ attendance: {}, meals: {} });
  });
});

describe('primaryAnsweredAllEvents', () => {
  const primaryKey = '__p';
  it('is true only when every event has a confirmed/declined answer', () => {
    expect(primaryAnsweredAllEvents({ __p: { tea: 'confirmed', banquet: 'declined' } }, primaryKey, events)).toBe(true);
    expect(primaryAnsweredAllEvents({ __p: { tea: 'confirmed' } }, primaryKey, events)).toBe(false);
    expect(primaryAnsweredAllEvents({ __p: { tea: 'confirmed', banquet: 'pending' } }, primaryKey, events)).toBe(false);
    expect(primaryAnsweredAllEvents({}, primaryKey, events)).toBe(false);
  });

  it('is true for an empty event list (nothing to answer)', () => {
    expect(primaryAnsweredAllEvents({}, primaryKey, [])).toBe(true);
  });
});
