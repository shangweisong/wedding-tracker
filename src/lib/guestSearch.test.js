import { describe, it, expect } from 'vitest';
import { parseGuestSearch, guestMatchesSearch, guestNameMatches } from './guestSearch.js';

// Minimal guest fixture — only the fields the search touches.
const g = (name, table_number, draw_number = null) => ({ name, table_number, draw_number });

describe('parseGuestSearch', () => {
  it('classifies a "#123" query as a draw-number lookup', () => {
    expect(parseGuestSearch('#123')).toEqual({ kind: 'draw', term: '123' });
  });

  it('classifies a bare "#" as a draw lookup with empty term', () => {
    expect(parseGuestSearch('#')).toEqual({ kind: 'draw', term: '' });
  });

  it('trims whitespace around a draw term', () => {
    expect(parseGuestSearch('#  12  ')).toEqual({ kind: 'draw', term: '12' });
  });

  it('classifies plain text as a text query and lower-cases it', () => {
    expect(parseGuestSearch('Abc')).toEqual({ kind: 'text', term: 'abc' });
  });

  it('classifies an empty string as an empty text query', () => {
    expect(parseGuestSearch('')).toEqual({ kind: 'text', term: '' });
  });

  it('tolerates null/undefined input', () => {
    expect(parseGuestSearch(null)).toEqual({ kind: 'text', term: '' });
    expect(parseGuestSearch(undefined)).toEqual({ kind: 'text', term: '' });
  });
});

describe('guestMatchesSearch — text (name / table)', () => {
  const guest = g('Tan Wei Ming', '3', 12);

  it('matches everyone on a blank query', () => {
    expect(guestMatchesSearch(guest, '')).toBe(true);
    expect(guestMatchesSearch(g('X', '9', null), '')).toBe(true);
  });

  it('matches a name substring case-insensitively', () => {
    expect(guestMatchesSearch(guest, 'wei')).toBe(true);
    expect(guestMatchesSearch(guest, 'WEI')).toBe(true);
  });

  it('matches a table-number substring', () => {
    expect(guestMatchesSearch(g('Bob', '13'), '3')).toBe(true);
  });

  it('does not match unrelated text', () => {
    expect(guestMatchesSearch(guest, 'zzz')).toBe(false);
  });

  it('does not treat a plain number as a draw-number lookup', () => {
    // "12" without "#" only matches name/table, not draw_number 12
    expect(guestMatchesSearch(g('Alice', '1', 12), '12')).toBe(false);
  });

  it('handles a null table_number without matching the string "null"', () => {
    expect(guestMatchesSearch(g('Alice', null, 5), 'null')).toBe(false);
  });
});

describe('guestMatchesSearch — draw number ("#")', () => {
  it('matches an exact draw number', () => {
    expect(guestMatchesSearch(g('Alice', '1', 12), '#12')).toBe(true);
  });

  it('does not match a non-exact (longer) draw number', () => {
    expect(guestMatchesSearch(g('Alice', '1', 120), '#12')).toBe(false);
  });

  it('does not match a guest with no assigned draw number', () => {
    expect(guestMatchesSearch(g('Alice', '1', null), '#12')).toBe(false);
  });

  it('trims whitespace before the exact match', () => {
    expect(guestMatchesSearch(g('Alice', '1', 12), '#  12  ')).toBe(true);
  });

  it('bare "#" matches every guest with an assigned draw number', () => {
    expect(guestMatchesSearch(g('Alice', '1', 7), '#')).toBe(true);
  });

  it('bare "#" excludes guests without a draw number', () => {
    expect(guestMatchesSearch(g('Bob', '1', null), '#')).toBe(false);
  });
});

describe('guestNameMatches — name-only RSVP filter (#147)', () => {
  const guest = g('Tan Wei Ming', '3', 12);

  it('matches everyone on a blank or whitespace-only query', () => {
    expect(guestNameMatches(guest, '')).toBe(true);
    expect(guestNameMatches(guest, '   ')).toBe(true);
  });

  it('tolerates null/undefined input', () => {
    expect(guestNameMatches(guest, null)).toBe(true);
    expect(guestNameMatches(guest, undefined)).toBe(true);
  });

  it('matches a name substring case-insensitively', () => {
    expect(guestNameMatches(guest, 'wei')).toBe(true);
    expect(guestNameMatches(guest, 'WEI')).toBe(true);
    expect(guestNameMatches(guest, 'Tan Wei Ming')).toBe(true);
  });

  it('trims surrounding whitespace before matching', () => {
    expect(guestNameMatches(guest, '  wei  ')).toBe(true);
  });

  it('does not match unrelated text', () => {
    expect(guestNameMatches(guest, 'zzz')).toBe(false);
  });

  it('does not match table numbers, unlike guestMatchesSearch', () => {
    expect(guestNameMatches(g('Bob', '13'), '13')).toBe(false);
  });

  it('treats "#" queries as literal text, not draw-number lookups', () => {
    expect(guestNameMatches(g('Alice', '1', 12), '#12')).toBe(false);
    expect(guestNameMatches(g('Alice #1 Fan', null), '#1')).toBe(true);
  });
});
