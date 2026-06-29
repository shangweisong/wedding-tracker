import { describe, it, expect } from 'vitest';
import { computeWrapped } from './wishesWrapped.js';

const g = (name, msg) => ({ id: name, name, rsvp_message: msg });

describe('computeWrapped', () => {
  it('returns empty state for no guests', () => {
    const r = computeWrapped([]);
    expect(r.totalWishes).toBe(0);
    expect(r.totalWords).toBe(0);
    expect(r.topWords).toHaveLength(0);
  });

  it('ignores guests with empty or null messages', () => {
    expect(computeWrapped([g('A', ''), g('B', null), g('C', '   ')])).toMatchObject({ totalWishes: 0 });
  });

  it('counts only non-empty messages', () => {
    const r = computeWrapped([g('A', 'hello'), g('B', ''), g('C', 'world')]);
    expect(r.totalWishes).toBe(2);
  });

  it('counts total raw words (not stop-word filtered)', () => {
    const r = computeWrapped([g('A', 'hello world'), g('B', 'the quick brown fox')]);
    expect(r.totalWords).toBe(6);
  });

  it('filters stop words from word cloud', () => {
    const r = computeWrapped([g('A', 'the and is love'), g('B', 'love you both')]);
    expect(r.topWords[0].word).toBe('love');
    expect(r.topWords[0].count).toBe(2);
  });

  it('computes average length rounded', () => {
    const r = computeWrapped([g('A', 'one two three four'), g('B', 'one two')]);
    expect(r.avgLength).toBe(3); // (4 + 2) / 2 = 3
  });

  it('awards most enthusiastic to highest ! count', () => {
    const r = computeWrapped([g('Calm', 'hello!'), g('Wild', 'yes!! amazing!!! wow!')]);
    expect(r.awards.mostEnthusiastic.guest.name).toBe('Wild');
    expect(r.awards.mostEnthusiastic.value).toBe(6); // yes!! (2) + amazing!!! (3) + wow! (1)
  });

  it('does not award mostEnthusiastic when nobody used !', () => {
    const r = computeWrapped([g('A', 'congrats'), g('B', 'lovely')]);
    expect(r.awards.mostEnthusiastic).toBeUndefined();
  });

  it('awards most words to longest message', () => {
    const r = computeWrapped([g('Short', 'hi there'), g('Long', 'a b c d e f g h i j k l')]);
    expect(r.awards.mostWords.guest.name).toBe('Long');
  });

  it('skips fewestWords when it is the same person as mostWords', () => {
    const r = computeWrapped([g('Only', 'one message here')]);
    expect(r.awards.fewestWords).toBeUndefined();
  });

  it('awards fewestWords to different person than mostWords', () => {
    const r = computeWrapped([g('Verbose', 'a very long message with many words in it indeed'), g('Terse', 'hi')]);
    expect(r.awards.fewestWords.guest.name).toBe('Terse');
    expect(r.awards.mostWords.guest.name).toBe('Verbose');
  });

  it('does not award mostPoetic when no message has 5+ words', () => {
    const r = computeWrapped([g('A', 'hey'), g('B', 'congrats')]);
    expect(r.awards.mostPoetic).toBeUndefined();
  });

  it('awards mostPoetic to highest unique-word ratio among 5+ word messages', () => {
    const r = computeWrapped([
      g('Repetitive', 'love love love love love'),
      g('Varied', 'wishing you joy peace happiness laughter'),
    ]);
    expect(r.awards.mostPoetic.guest.name).toBe('Varied');
  });
});
