import { describe, it, expect } from 'vitest';
import { matchGuestByName, matchGuestByNameFixed, trigramSimilarity } from './nameMatch.js';

// Minimal guest fixture — id equals name for easy identification in failures
const g = (name) => ({ id: name, name });

// ── Trigram similarity spot-checks ────────────────────────────────────────
// These explain WHY the LIKE fallback is not the only culprit.

describe('trigramSimilarity', () => {
  it('"testing" vs "testing 2" — similarity is 0.8 (well above 0.4 threshold)', () => {
    // "testing" and "testing 2" share 8 of 10 union trigrams.
    // This means the similarity check alone would flag them as ambiguous
    // even without the LIKE clause.
    expect(trigramSimilarity('testing', 'testing 2')).toBeCloseTo(0.8, 1);
  });

  it('"wei" vs "wei ming" — similarity is ~0.44 (above 0.4 threshold)', () => {
    // "  wei " has 4 trigrams; all 4 appear in "  wei ming " (9 trigrams).
    // intersection=4, union=9 → 4/9 ≈ 0.44
    expect(trigramSimilarity('wei', 'wei ming')).toBeGreaterThanOrEqual(0.4);
  });

  it('"jonathan" vs "jonathon" — similarity above 0.4 threshold (typo case)', () => {
    // JS approximation gives ~0.5; PostgreSQL pg_trgm gives similar results.
    // The key point: it clears the 0.4 gate so the fuzzy fallback can match.
    expect(trigramSimilarity('jonathan', 'jonathon')).toBeGreaterThan(0.4);
  });

  it('"alice" vs "bob" — near-zero similarity', () => {
    expect(trigramSimilarity('alice', 'bob')).toBeLessThan(0.2);
  });
});

// ── Current behaviour: what WORKS ─────────────────────────────────────────

describe('matchGuestByName (current) — cases that work correctly', () => {
  it('exact match with no naming conflicts', () => {
    const guests = [g('Wei Ming'), g('Siew Yong')];
    expect(matchGuestByName('Wei Ming', guests).name).toBe('Wei Ming');
  });

  it('case-insensitive exact match', () => {
    const guests = [g('Wei Ming'), g('Siew Yong')];
    expect(matchGuestByName('wei ming', guests).name).toBe('Wei Ming');
  });

  it('fuzzy match resolves a one-character typo when no conflicts exist', () => {
    // "Jonathon" → matches "Jonathan" via high trigram similarity
    const guests = [g('Jonathan'), g('Sarah')];
    expect(matchGuestByName('Jonathon', guests).name).toBe('Jonathan');
  });

  it('partial first name works when only one guest contains it', () => {
    // "wei" matches "Wei Ming" via LIKE when no other "wei*" guest exists
    const guests = [g('Wei Ming'), g('Siew Yong')];
    expect(matchGuestByName('wei', guests).name).toBe('Wei Ming');
  });

  it('raises not_found for an unknown name', () => {
    const guests = [g('Alice'), g('Bob')];
    expect(() => matchGuestByName('Charlie', guests)).toThrow('not_found');
  });

  it('raises ambiguous when two different guests both partially match', () => {
    // Genuinely ambiguous: "wei" alone could be Wei Ming OR Wei Ling
    const guests = [g('Wei Ming'), g('Wei Ling')];
    expect(() => matchGuestByName('wei', guests)).toThrow('ambiguous');
  });
});

// ── Current behaviour: KNOWN BUGS ─────────────────────────────────────────
//
// Each test below captures a case where a guest CANNOT RSVP even though
// their name is in the guest list — because the matcher has no exact-match
// short-circuit and falsely returns 'ambiguous'.
//
// The assertions document the CURRENT (broken) behaviour.
// When the fix is applied these should be moved to the "fixed" suite.

describe('matchGuestByName (current) — BUG: prefix names are permanently blocked', () => {
  it('BUG: "testing" cannot RSVP when "testing 2" also exists', () => {
    // "testing 2" matches "testing" search via similarity ≈ 0.8 AND LIKE '%testing%'
    const guests = [g('testing'), g('testing 2')];
    expect(() => matchGuestByName('testing', guests)).toThrow('ambiguous');
  });

  it('BUG: "testing 2" cannot RSVP when "testing" also exists', () => {
    // "testing" matches "testing 2" search via similarity ≈ 0.8 — bug is symmetric
    const guests = [g('testing'), g('testing 2')];
    expect(() => matchGuestByName('testing 2', guests)).toThrow('ambiguous');
  });

  it('BUG: "wei" cannot RSVP when "wei ming" also exists', () => {
    // "wei ming" matches "wei" search via similarity ≈ 0.44 AND LIKE '%wei%'
    const guests = [g('wei'), g('wei ming')];
    expect(() => matchGuestByName('wei', guests)).toThrow('ambiguous');
  });

  it('BUG: "alice" cannot RSVP when "alice smith" also exists', () => {
    const guests = [g('alice'), g('alice smith')];
    expect(() => matchGuestByName('alice', guests)).toThrow('ambiguous');
  });

  it('BUG: "ann" cannot RSVP when "anna" and "anne" also exist', () => {
    // Both "anna" and "anne" match "ann" via high similarity AND LIKE '%ann%'
    const guests = [g('ann'), g('anna'), g('anne')];
    expect(() => matchGuestByName('ann', guests)).toThrow('ambiguous');
  });
});

// ── Current behaviour: bugs — NOT just prefix collisions ──────────────────
//
// The LIKE '%search%' clause matches the search term ANYWHERE in the name —
// middle included. And high trigram similarity can fire even when no substring
// is shared. The following show the full range of affected patterns.

describe('matchGuestByName (current) — BUG: middle-substring collisions', () => {
  it('BUG: "lee" blocked by "aileen" (search term appears mid-name)', () => {
    // "aileen" contains "lee" at position 2: a-i-l-e-e-n. sim=0.1 < 0.4,
    // but LIKE alone is enough to pull it into the match set.
    const guests = [g('lee'), g('aileen')];
    expect(() => matchGuestByName('lee', guests)).toThrow('ambiguous');
  });

  it('BUG: "lee" blocked by "leena" (prefix AND similarity)', () => {
    // similarity ≈ 0.43 AND LIKE both fire. Double-hit.
    const guests = [g('lee'), g('leena')];
    expect(() => matchGuestByName('lee', guests)).toThrow('ambiguous');
  });

  it('BUG: "ben" blocked by "benjamin" (LIKE-only — similarity is 0.3, below threshold)', () => {
    // Interesting case: similarity(0.3) does NOT hit the 0.4 gate,
    // but LIKE '%ben%' still matches "benjamin", causing ambiguous.
    const guests = [g('ben'), g('benjamin')];
    expect(() => matchGuestByName('ben', guests)).toThrow('ambiguous');
  });

  it('no bug: "lee" is NOT matched by "leslie" — no substring, no similarity', () => {
    // "leslie" does not contain "lee" and similarity is only 0.22.
    // Control case: shows LIKE is not a blanket substring bomb.
    const guests = [g('Leslie'), g('Sarah')];
    expect(() => matchGuestByName('lee', guests)).toThrow('not_found');
  });
});

describe('matchGuestByName (current) — BUG: high-similarity numbered / compound names', () => {
  it('BUG: "simon" blocked by "simonson" (similarity 0.67 AND LIKE)', () => {
    const guests = [g('simon'), g('simonson')];
    expect(() => matchGuestByName('simon', guests)).toThrow('ambiguous');
  });

  it('BUG: "alice 1" blocked by "alice 2" (similarity 0.6, no LIKE match)', () => {
    // No substring overlap, but trigram similarity fires at 0.6.
    // Shows the similarity clause also causes false positives.
    const guests = [g('alice 1'), g('alice 2')];
    expect(() => matchGuestByName('alice 1', guests)).toThrow('ambiguous');
  });

  it('BUG: "bo" blocked by "bob" (similarity exactly 0.4 — at the boundary)', () => {
    // Trigram sim = 0.4 (exactly hits the >= gate) AND LIKE fires.
    // Real short name scenario — e.g. Chinese names "Bo", "Li", "Su".
    const guests = [g('bo'), g('bob')];
    expect(() => matchGuestByName('bo', guests)).toThrow('ambiguous');
  });
});

describe('matchGuestByName (current) — BUG: name appears as substring of unrelated guest', () => {
  it('BUG: "james" blocked when "james smith" AND "wei james" both exist', () => {
    // Both match: "james smith" via sim(0.5)+LIKE, "wei james" via sim(0.46)+LIKE.
    // A guest literally named "James" cannot RSVP.
    const guests = [g('james'), g('james smith'), g('wei james')];
    expect(() => matchGuestByName('james', guests)).toThrow('ambiguous');
  });

  it('BUG: "james smith" blocked when plain "james" also exists (sim 0.5)', () => {
    // Searching the LONGER name also breaks — "james" scores 0.5 sim against
    // the search "james smith" and is pulled into the match set.
    const guests = [g('james'), g('james smith')];
    expect(() => matchGuestByName('james smith', guests)).toThrow('ambiguous');
  });

  it('BUG: "li wei" blocked when plain "li" also exists (sim ≈ 0.43)', () => {
    // Symmetric to the "wei"/"wei ming" case but with reversed search direction.
    const guests = [g('li'), g('li wei')];
    expect(() => matchGuestByName('li wei', guests)).toThrow('ambiguous');
  });
});

// ── Cases that are CORRECTLY ambiguous in both implementations ─────────────
//
// These are NOT bugs — the matcher is right to ask for a more specific name.

describe('matchGuestByName — correctly ambiguous (both implementations agree)', () => {
  it('"james" with no exact "james" guest and two partial matches → correctly ambiguous', () => {
    // No guest literally named "James" — the user must type the full name.
    const guests = [g('james smith'), g('wei james')];
    expect(() => matchGuestByName('james', guests)).toThrow('ambiguous');
    expect(() => matchGuestByNameFixed('james', guests)).toThrow('ambiguous');
  });

  it('"sarah" with two "Sarah …" guests → correctly ambiguous', () => {
    const guests = [g('sarah jane'), g('sarah connor')];
    expect(() => matchGuestByName('sarah', guests)).toThrow('ambiguous');
    expect(() => matchGuestByNameFixed('sarah', guests)).toThrow('ambiguous');
  });

  it('"wei" with two "Wei …" guests and no exact "wei" → correctly ambiguous', () => {
    const guests = [g('wei ming'), g('wei ling')];
    expect(() => matchGuestByName('wei', guests)).toThrow('ambiguous');
    expect(() => matchGuestByNameFixed('wei', guests)).toThrow('ambiguous');
  });
});

// ── Fixed behaviour ────────────────────────────────────────────────────────

describe('matchGuestByNameFixed — prefix-name cases all resolve correctly', () => {
  it('"testing" finds itself even when "testing 2" exists', () => {
    const guests = [g('testing'), g('testing 2')];
    expect(matchGuestByNameFixed('testing', guests).name).toBe('testing');
  });

  it('"testing 2" finds itself even when "testing" exists', () => {
    const guests = [g('testing'), g('testing 2')];
    expect(matchGuestByNameFixed('testing 2', guests).name).toBe('testing 2');
  });

  it('"wei" finds itself even when "wei ming" exists', () => {
    const guests = [g('wei'), g('wei ming')];
    expect(matchGuestByNameFixed('wei', guests).name).toBe('wei');
  });

  it('"alice" finds itself even when "alice smith" exists', () => {
    const guests = [g('alice'), g('alice smith')];
    expect(matchGuestByNameFixed('alice', guests).name).toBe('alice');
  });

  it('"ann" finds itself even when "anna" and "anne" exist', () => {
    const guests = [g('ann'), g('anna'), g('anne')];
    expect(matchGuestByNameFixed('ann', guests).name).toBe('ann');
  });

  it('case-insensitive exact match still works', () => {
    const guests = [g('Wei Ming'), g('testing 2')];
    expect(matchGuestByNameFixed('WEI MING', guests).name).toBe('Wei Ming');
  });

  it('fuzzy typo match still works when no exact match exists', () => {
    // "Jonathon" has no exact match → falls through to fuzzy → finds "Jonathan"
    const guests = [g('Jonathan'), g('Sarah')];
    expect(matchGuestByNameFixed('Jonathon', guests).name).toBe('Jonathan');
  });

  it('partial first name still resolves when unambiguous and no exact match', () => {
    // No guest named "wei" → fuzzy fallback → only "Wei Ming" matches
    const guests = [g('Wei Ming'), g('Siew Yong')];
    expect(matchGuestByNameFixed('wei', guests).name).toBe('Wei Ming');
  });

  it('still raises ambiguous for two genuinely duplicate names', () => {
    // Two guests both named "John" — exact match finds 2 → ambiguous
    const guests = [g('John'), g('John')];
    expect(() => matchGuestByNameFixed('John', guests)).toThrow('ambiguous');
  });

  it('still raises not_found for an unknown name', () => {
    const guests = [g('Alice'), g('Bob')];
    expect(() => matchGuestByNameFixed('Charlie', guests)).toThrow('not_found');
  });

  it('still raises ambiguous when two guests partially match with no exact match', () => {
    // No "wei" guest — falls to fuzzy — both "Wei Ming" and "Wei Ling" match
    const guests = [g('Wei Ming'), g('Wei Ling')];
    expect(() => matchGuestByNameFixed('wei', guests)).toThrow('ambiguous');
  });
});

// ── Fixed version: cases that STILL BREAK ─────────────────────────────────
//
// The exact-match short-circuit only helps when the user types their name
// perfectly (case-insensitive). Any deviation drops back into the unchanged
// fuzzy path, which has all the same LIKE/similarity bugs.
//
// This section documents what the partial fix CANNOT solve.

describe('matchGuestByNameFixed — STILL BROKEN: typos fall through to broken fuzzy', () => {
  it('typo "alic" for "alice" — no exact match, fuzzy still finds both alice and alice smith', () => {
    // Exact match: none. Fuzzy: "alice" (sim=0.57) and "alice smith" (LIKE) both match.
    // The user just mistyped one letter but gets ambiguous.
    const guests = [g('alice'), g('alice smith')];
    expect(() => matchGuestByNameFixed('alic', guests)).toThrow('ambiguous');
  });

  it('near-typo "james smit" — fuzzy matches both "james" (sim=0.55) and "james smith"', () => {
    const guests = [g('james'), g('james smith')];
    expect(() => matchGuestByNameFixed('james smit', guests)).toThrow('ambiguous');
  });
});

describe('matchGuestByNameFixed — STILL BROKEN: partial name falls through to broken fuzzy', () => {
  it('"wei ming" typed but registered as "Wei Ming Tan" — "Wei" guest also matches via similarity', () => {
    // Guest knows themselves as "Wei Ming" but was registered with surname.
    // No exact "Wei Ming" in DB, so falls to fuzzy.
    // "Wei Ming Tan" matches via LIKE + sim=0.69.
    // "Wei" matches via sim=0.44 (all 4 of Wei's trigrams are in "wei ming").
    const guests = [g('Wei Ming Tan'), g('Wei')];
    expect(() => matchGuestByNameFixed('wei ming', guests)).toThrow('ambiguous');
  });

  it('"tan" (last name only) — both guests share surname, no exact "tan" guest', () => {
    // No exact match → fuzzy → both match via LIKE '%tan%'.
    const guests = [g('Wei Ming Tan'), g('Siew Yong Tan')];
    expect(() => matchGuestByNameFixed('tan', guests)).toThrow('ambiguous');
  });
});

// ── The root cause ─────────────────────────────────────────────────────────
//
// The exact-match short-circuit is a band-aid: it fixes the common path but
// leaves the broken fuzzy fallback intact. The threshold (0.4) is a magic
// number, and the LIKE '%…%' clause still fires on any substring.
//
// Robust fix: change the no-token UX flow to search-and-select.
//   1. Guest types name → call find_guest_by_name (already returns rsvp_token)
//   2. Show the list — guest clicks their own name
//   3. Proceed via submit_rsvp(token, …) — the token-based path with zero ambiguity
//
// This eliminates submit_rsvp_by_name from the submission path entirely.
// find_guest_by_name already orders exact matches first and caps at 5 results.

describe('matchGuestByNameFixed — middle-substring and compound-name bugs resolved', () => {
  it('"lee" finds itself even when "aileen" exists', () => {
    const guests = [g('lee'), g('aileen')];
    expect(matchGuestByNameFixed('lee', guests).name).toBe('lee');
  });

  it('"lee" finds itself even when "leena" exists', () => {
    const guests = [g('lee'), g('leena')];
    expect(matchGuestByNameFixed('lee', guests).name).toBe('lee');
  });

  it('"ben" finds itself even when "benjamin" exists', () => {
    const guests = [g('ben'), g('benjamin')];
    expect(matchGuestByNameFixed('ben', guests).name).toBe('ben');
  });

  it('"simon" finds itself even when "simonson" exists', () => {
    const guests = [g('simon'), g('simonson')];
    expect(matchGuestByNameFixed('simon', guests).name).toBe('simon');
  });

  it('"alice 1" finds itself even when "alice 2" exists', () => {
    const guests = [g('alice 1'), g('alice 2')];
    expect(matchGuestByNameFixed('alice 1', guests).name).toBe('alice 1');
  });

  it('"bo" finds itself even when "bob" exists (boundary similarity 0.4)', () => {
    const guests = [g('bo'), g('bob')];
    expect(matchGuestByNameFixed('bo', guests).name).toBe('bo');
  });

  it('"james" finds itself even when "james smith" and "wei james" also exist', () => {
    const guests = [g('james'), g('james smith'), g('wei james')];
    expect(matchGuestByNameFixed('james', guests).name).toBe('james');
  });

  it('"james smith" finds itself even when "james" also exists', () => {
    const guests = [g('james'), g('james smith')];
    expect(matchGuestByNameFixed('james smith', guests).name).toBe('james smith');
  });

  it('"li wei" finds itself even when "li" also exists', () => {
    const guests = [g('li'), g('li wei')];
    expect(matchGuestByNameFixed('li wei', guests).name).toBe('li wei');
  });

  it('fuzzy still finds "benjamin" when no "ben" guest exists', () => {
    // No exact "ben" → falls through to fuzzy → LIKE matches "benjamin" → 1 result
    const guests = [g('benjamin'), g('sarah')];
    expect(matchGuestByNameFixed('ben', guests).name).toBe('benjamin');
  });

  it('whitespace in input is trimmed — matches correctly', () => {
    const guests = [g('Alice'), g('Bob')];
    expect(matchGuestByNameFixed('  alice  ', guests).name).toBe('Alice');
  });

  it('all-caps input matches case-insensitively', () => {
    const guests = [g('Wei Ming'), g('alice smith')];
    expect(matchGuestByNameFixed('WEI MING', guests).name).toBe('Wei Ming');
  });
});
