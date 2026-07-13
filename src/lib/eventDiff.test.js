import { describe, it, expect } from 'vitest';
import { diffEvents, blankEvent } from './eventDiff.js';

// A persisted event row as returned by sb.select (times come back 'HH:MM:SS').
const saved = (id, over = {}) => ({
  id,
  name: `Event ${id}`,
  event_date: null,
  start_time: null,
  location: '',
  requires_meal: false,
  requires_headcount: true,
  is_active: true,
  sort_order: 0,
  ...over,
});

describe('blankEvent', () => {
  it('defaults to an active, headcount-tracked, non-meal event', () => {
    expect(blankEvent()).toMatchObject({ requires_meal: false, requires_headcount: true, is_active: true });
  });
});

describe('diffEvents — create', () => {
  it('treats rows without a real id as creates, carrying their array position as sort_order', () => {
    const draft = [{ name: 'Tea Ceremony' }, { id: 'new_123', name: 'Banquet', requires_meal: true }];
    const { toCreate, toUpdate, toDelete } = diffEvents([], draft);
    expect(toUpdate).toEqual([]);
    expect(toDelete).toEqual([]);
    expect(toCreate).toEqual([
      expect.objectContaining({ name: 'Tea Ceremony', sort_order: 0, requires_meal: false }),
      expect.objectContaining({ name: 'Banquet', sort_order: 1, requires_meal: true }),
    ]);
  });

  it('skips blank-named new rows', () => {
    const { toCreate } = diffEvents([], [{ name: '   ' }, blankEvent()]);
    expect(toCreate).toEqual([]);
  });
});

describe('diffEvents — update', () => {
  it('emits a patch only for rows whose fields changed', () => {
    const original = [saved('a', { name: 'Tea', sort_order: 0 }), saved('b', { name: 'Banquet', sort_order: 1 })];
    const draft = [
      { ...saved('a', { sort_order: 0 }), name: 'Tea Ceremony' }, // changed name
      saved('b', { name: 'Banquet', sort_order: 1 }),             // unchanged
    ];
    const { toUpdate } = diffEvents(original, draft);
    expect(toUpdate).toHaveLength(1);
    expect(toUpdate[0].id).toBe('a');
    expect(toUpdate[0].patch).toMatchObject({ name: 'Tea Ceremony' });
  });

  it('detects reordering as a sort_order change', () => {
    const original = [saved('a', { sort_order: 0 }), saved('b', { sort_order: 1 })];
    const draft = [saved('b', { sort_order: 1 }), saved('a', { sort_order: 0 })]; // swapped
    const { toUpdate } = diffEvents(original, draft);
    const ids = toUpdate.map((u) => u.id).sort();
    expect(ids).toEqual(['a', 'b']);
    expect(toUpdate.find((u) => u.id === 'b').patch.sort_order).toBe(0);
    expect(toUpdate.find((u) => u.id === 'a').patch.sort_order).toBe(1);
  });

  it('does not treat a HH:MM vs HH:MM:SS time as a change', () => {
    const original = [saved('a', { start_time: '14:00:00', sort_order: 0 })];
    const draft = [saved('a', { start_time: '14:00', sort_order: 0 })];
    expect(diffEvents(original, draft).toUpdate).toEqual([]);
  });

  it('returns no changes for an identical list', () => {
    const original = [saved('a', { sort_order: 0 }), saved('b', { sort_order: 1 })];
    const { toCreate, toUpdate, toDelete } = diffEvents(original, original);
    expect(toCreate).toEqual([]);
    expect(toUpdate).toEqual([]);
    expect(toDelete).toEqual([]);
  });
});

describe('diffEvents — content_translations', () => {
  it('carries translations on create', () => {
    const { toCreate } = diffEvents([], [{ name: 'Tea', content_translations: { 'zh-TW': { name: '奉茶' } } }]);
    expect(toCreate[0].content_translations).toEqual({ 'zh-TW': { name: '奉茶' } });
  });

  it('emits a patch when a translation changes', () => {
    const original = [saved('a', { name: 'Tea', sort_order: 0 })];
    const draft = [{ ...saved('a', { name: 'Tea', sort_order: 0 }), content_translations: { 'zh-TW': { name: '奉茶' } } }];
    const { toUpdate } = diffEvents(original, draft);
    expect(toUpdate[0].patch.content_translations).toEqual({ 'zh-TW': { name: '奉茶' } });
  });

  it('does not churn on blank/whitespace-only translations', () => {
    const original = [saved('a', { name: 'Tea', sort_order: 0, content_translations: {} })];
    const draft = [{ ...saved('a', { name: 'Tea', sort_order: 0 }), content_translations: { 'zh-TW': { name: '   ', location: '' } } }];
    expect(diffEvents(original, draft).toUpdate).toEqual([]);
  });

  it('is order-insensitive across locale/field keys', () => {
    const original = [saved('a', { name: 'Tea', sort_order: 0, content_translations: { 'zh-TW': { name: '奉茶', location: '家' }, ja: { name: 'お茶' } } })];
    const draft = [{ ...saved('a', { name: 'Tea', sort_order: 0 }), content_translations: { ja: { name: 'お茶' }, 'zh-TW': { location: '家', name: '奉茶' } } }];
    expect(diffEvents(original, draft).toUpdate).toEqual([]);
  });
});

describe('diffEvents — audience_groups (#131)', () => {
  it('blankEvent defaults to no audience restriction', () => {
    expect(blankEvent().audience_groups).toEqual([]);
  });

  it('carries normalized audience_groups on create', () => {
    const { toCreate } = diffEvents([], [{ name: 'Tea', audience_groups: ['friends', 'family', 'friends', 'bogus'] }]);
    expect(toCreate[0].audience_groups).toEqual(['family', 'friends']);
  });

  it('emits a patch when groups are added or removed', () => {
    const original = [saved('a', { sort_order: 0, audience_groups: ['family'] })];
    const added = [{ ...saved('a', { sort_order: 0 }), audience_groups: ['family', 'friends'] }];
    expect(diffEvents(original, added).toUpdate[0].patch.audience_groups).toEqual(['family', 'friends']);
    const removed = [{ ...saved('a', { sort_order: 0 }), audience_groups: [] }];
    expect(diffEvents(original, removed).toUpdate[0].patch.audience_groups).toEqual([]);
  });

  it('does not churn on order/duplicate differences', () => {
    const original = [saved('a', { sort_order: 0, audience_groups: ['friends', 'family'] })];
    const draft = [saved('a', { sort_order: 0, audience_groups: ['family', 'friends', 'family'] })];
    expect(diffEvents(original, draft).toUpdate).toEqual([]);
  });

  it('does not churn when the persisted row predates the column (missing vs [])', () => {
    const original = [saved('a', { sort_order: 0 })]; // no audience_groups key at all
    const draft = [{ ...saved('a', { sort_order: 0 }), audience_groups: [] }];
    expect(diffEvents(original, draft).toUpdate).toEqual([]);
  });

  it('drops invalid values before comparing', () => {
    const original = [saved('a', { sort_order: 0, audience_groups: ['family'] })];
    const draft = [saved('a', { sort_order: 0, audience_groups: ['family', 'bogus'] })];
    expect(diffEvents(original, draft).toUpdate).toEqual([]);
  });
});

describe('diffEvents — delete', () => {
  it('deletes originals no longer present in the draft', () => {
    const original = [saved('a', { sort_order: 0 }), saved('b', { sort_order: 1 })];
    const draft = [saved('a', { sort_order: 0 })];
    expect(diffEvents(original, draft).toDelete).toEqual(['b']);
  });

  it('tolerates null/undefined inputs', () => {
    expect(diffEvents(null, undefined)).toEqual({ toCreate: [], toUpdate: [], toDelete: [] });
  });
});
