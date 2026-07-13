import { describe, it, expect } from 'vitest';
import { EVENT_AUDIENCES, normalizeAudienceGroups, visibleEventsFor } from './eventVisibility.js';

const ev = (id, audience_groups) => ({ id, name: `Event ${id}`, audience_groups });

describe('EVENT_AUDIENCES', () => {
  it('is the targetable relationship taxonomy (no party, no complicated)', () => {
    expect(EVENT_AUDIENCES).toEqual(['family', 'friends', 'colleagues', 'other']);
  });
});

describe('normalizeAudienceGroups', () => {
  it('returns [] for non-array input', () => {
    expect(normalizeAudienceGroups(null)).toEqual([]);
    expect(normalizeAudienceGroups(undefined)).toEqual([]);
    expect(normalizeAudienceGroups('family')).toEqual([]);
    expect(normalizeAudienceGroups({})).toEqual([]);
  });

  it('dedupes, sorts, and drops invalid values', () => {
    expect(normalizeAudienceGroups(['friends', 'family', 'friends', 'bogus'])).toEqual(['family', 'friends']);
    expect(normalizeAudienceGroups(['bride', 'complicated', ''])).toEqual([]);
  });

  it('trims and lowercases before validating', () => {
    expect(normalizeAudienceGroups([' Family ', 'FRIENDS'])).toEqual(['family', 'friends']);
  });
});

describe('visibleEventsFor', () => {
  const unrestricted = ev('banquet', []);
  const familyOnly = ev('tea', ['family']);
  const friendsColleagues = ev('afterparty', ['friends', 'colleagues']);
  const all = [unrestricted, familyOnly, friendsColleagues];

  it('returns [] for non-array events', () => {
    expect(visibleEventsFor(null, 'family')).toEqual([]);
    expect(visibleEventsFor(undefined, '')).toEqual([]);
  });

  it('always shows events with an empty, missing, or non-array audience', () => {
    const defensive = [ev('a', []), ev('b', undefined), ev('c', 'junk')];
    for (const group of ['', 'family', 'friends', 'complicated', 'junk']) {
      expect(visibleEventsFor(defensive, group)).toEqual(defensive);
    }
  });

  it('shows a restricted event only to matching relationship groups', () => {
    expect(visibleEventsFor(all, 'family')).toEqual([unrestricted, familyOnly]);
    expect(visibleEventsFor(all, 'friends')).toEqual([unrestricted, friendsColleagues]);
    expect(visibleEventsFor(all, 'colleagues')).toEqual([unrestricted, friendsColleagues]);
    expect(visibleEventsFor(all, 'other')).toEqual([unrestricted]);
  });

  it('hides restricted events while the relationship is unknown or untargetable', () => {
    expect(visibleEventsFor(all, '')).toEqual([unrestricted]);
    expect(visibleEventsFor(all, 'complicated')).toEqual([unrestricted]);
    expect(visibleEventsFor(all, 'junk')).toEqual([unrestricted]);
    expect(visibleEventsFor(all, null)).toEqual([unrestricted]);
  });

  it('falls back to all events when the filter would hide everything', () => {
    // A guest explicitly invited only to restricted events must never face an
    // empty form — declutter, not a gate (see CodeRabbit review on PR #59).
    const restrictedOnly = [familyOnly, friendsColleagues];
    expect(visibleEventsFor(restrictedOnly, 'other')).toEqual(restrictedOnly);
    expect(visibleEventsFor(restrictedOnly, '')).toEqual(restrictedOnly);
    expect(visibleEventsFor([familyOnly], 'friends')).toEqual([familyOnly]);
  });

  it('matches case/whitespace-insensitively on both sides', () => {
    const messy = ev('tea', [' Family ']);
    expect(visibleEventsFor([messy], 'family')).toEqual([messy]);
    expect(visibleEventsFor([ev('tea', ['family'])], ' FAMILY ')).toHaveLength(1);
  });
});
