import { describe, it, expect } from 'vitest';
import { computeWrapped, participationComment } from './wishesWrapped.js';

const g = (name, msg, party) => ({ id: name, name, rsvp_message: msg, party: party ?? null });

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

  // ── New stats ─────────────────────────────────────────────────────────────

  it('includes totalGuests regardless of message presence', () => {
    const r = computeWrapped([g('A', 'hello'), g('B', ''), g('C', null)]);
    expect(r.totalGuests).toBe(3);
  });

  it('computes participationRate correctly', () => {
    const r = computeWrapped([g('A', 'hello'), g('B', ''), g('C', 'world'), g('D', null)]);
    expect(r.totalWishes).toBe(2);
    expect(r.totalGuests).toBe(4);
    expect(r.participationRate).toBeCloseTo(0.5);
  });

  it('returns participationRate 0 for empty guest list', () => {
    expect(computeWrapped([]).participationRate).toBe(0);
  });

  it('counts bride and groom sides separately', () => {
    const r = computeWrapped([
      g('Alice', 'lovely day', 'bride'),
      g('Bob',   'congrats',   'groom'),
      g('Carol', 'wonderful',  'bride'),
      g('Dave',  '',           'groom'),
    ]);
    expect(r.sides.bride.total).toBe(2);
    expect(r.sides.bride.wishers).toBe(2);
    expect(r.sides.groom.total).toBe(2);
    expect(r.sides.groom.wishers).toBe(1);
  });

  it('counts personality clusters', () => {
    const essay  = Array(40).fill('word').join(' ');
    const brief  = 'hi';
    // shouty: 14 words (> 10 so not "brief"), 4 exclamations
    const shouty = 'Wishing you both a lifetime of joy and happiness!! Love you to pieces amazing!!';
    // emojiLovers: 13 words, 2 emojis, 0 !
    const emojis = 'Congratulations to you both what an amazing beautiful wonderful happy day 🎉 🎊';
    const r = computeWrapped([
      g('A', essay),
      g('B', brief),
      g('C', shouty),
      g('D', emojis),
    ]);
    expect(r.clusters.essayists).toBe(1);
    expect(r.clusters.brief).toBe(1);
    expect(r.clusters.shouty).toBe(1);
    expect(r.clusters.emojiLovers).toBe(1);
  });

  it('counts total emojis and finds top emoji', () => {
    const r = computeWrapped([
      g('A', '🎉🎉 love'),
      g('B', '🎉 congrats'),
      g('C', '🎊 hooray'),
    ]);
    expect(r.totalEmojis).toBe(4);
    expect(r.topEmoji?.emoji).toBe('🎉');
    expect(r.topEmoji?.count).toBe(3);
  });

  it('returns topEmoji null when no emojis present', () => {
    const r = computeWrapped([g('A', 'hello world')]);
    expect(r.topEmoji).toBeNull();
    expect(r.totalEmojis).toBe(0);
  });

  it('finds topOpeningWord when 2+ guests share the same first word', () => {
    const r = computeWrapped([
      g('A', 'Congratulations on your big day'),
      g('B', 'Congratulations both of you'),
      g('C', 'Wishing you all the best'),
    ]);
    expect(r.topOpeningWord?.word).toBe('congratulations');
    expect(r.topOpeningWord?.count).toBe(2);
  });

  it('returns topOpeningWord null when no word is repeated', () => {
    const r = computeWrapped([
      g('A', 'Congratulations to you'),
      g('B', 'Wishing you happiness'),
    ]);
    expect(r.topOpeningWord).toBeNull();
  });

  it('computes novelPages from totalWords', () => {
    const words = Array(500).fill('word').join(' ');
    const r = computeWrapped([g('A', words)]);
    expect(r.novelPages).toBe(2); // 500 / 250
  });

  it('silentGuests returns at most 3 guests with no message', () => {
    const r = computeWrapped([
      g('A', 'hello'), g('B', ''), g('C', null), g('D', '   '), g('E', 'world'),
    ]);
    expect(r.silentGuests.length).toBeLessThanOrEqual(3);
    for (const s of r.silentGuests) {
      expect((s.rsvp_message || '').trim()).toBe('');
    }
  });

  it('silentGuests returns all silent guests when fewer than 3', () => {
    const r = computeWrapped([g('A', 'hello'), g('B', ''), g('C', 'world')]);
    expect(r.silentGuests).toHaveLength(1);
    expect(r.silentGuests[0].name).toBe('B');
  });

  it('silentGuests is empty when everyone wrote something', () => {
    const r = computeWrapped([g('A', 'hello'), g('B', 'world')]);
    expect(r.silentGuests).toHaveLength(0);
  });
});

describe('participationComment', () => {
  it('returns 100% message when all guests wrote', () => {
    expect(participationComment(1, 10)).toContain('Every');
  });

  it('returns food comment for zero wishers', () => {
    expect(participationComment(0, 0)).toContain('food');
  });

  it('returns positive message for high participation', () => {
    expect(participationComment(0.9, 9)).toContain('loved');
  });
});
