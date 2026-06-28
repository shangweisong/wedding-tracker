/**
 * Pure-JS mirror of submit_rsvp_by_name matching logic.
 * Used for unit-testing name-match behaviour without a live DB.
 * Not imported by any production code.
 *
 * Trigram similarity matches PostgreSQL pg_trgm:
 *   pad string with two leading spaces + one trailing space,
 *   extract all consecutive 3-character substrings, compute
 *   |intersection| / |union| over the two trigram sets.
 */

function getTrigrams(s) {
  const padded = '  ' + s + ' ';
  const grams = new Set();
  for (let i = 0; i <= padded.length - 3; i++) {
    grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

export function trigramSimilarity(a, b) {
  const ga = getTrigrams(a);
  const gb = getTrigrams(b);
  let intersection = 0;
  for (const g of ga) {
    if (gb.has(g)) intersection++;
  }
  const union = ga.size + gb.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Current (buggy) matching — mirrors the SQL WHERE clause exactly:
 *
 *   similarity(lower(trim(name)), lower(trim(p_name))) >= 0.4
 *   OR lower(name) LIKE '%' || lower(trim(p_name)) || '%'
 *
 * Bug: no exact-match short-circuit. If guest "wei" exists alongside
 * "wei ming", searching "wei" matches BOTH rows and throws 'ambiguous'.
 *
 * @param {string} searchName
 * @param {{ id: string, name: string }[]} guests
 * @throws {Error} message is 'not_found' | 'ambiguous'
 */
export function matchGuestByName(searchName, guests) {
  const search = searchName.toLowerCase().trim();
  const matches = guests.filter(({ name }) => {
    const n = name.toLowerCase().trim();
    return trigramSimilarity(n, search) >= 0.4 || n.includes(search);
  });
  if (matches.length === 0) throw new Error('not_found');
  if (matches.length > 1)   throw new Error('ambiguous');
  return matches[0];
}

/**
 * Fixed version — exact-match short-circuit before fuzzy fallback.
 *
 * Proposed SQL change to submit_rsvp_by_name:
 *   1. SELECT id WHERE lower(trim(name)) = lower(trim(p_name))  -- exact first
 *   2. Only if that returns nothing, fall through to the similarity/LIKE query
 *
 * @param {string} searchName
 * @param {{ id: string, name: string }[]} guests
 * @throws {Error} message is 'not_found' | 'ambiguous'
 */
export function matchGuestByNameFixed(searchName, guests) {
  const search = searchName.toLowerCase().trim();

  // Step 1: exact match (case-insensitive)
  const exact = guests.filter(({ name }) => name.toLowerCase().trim() === search);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1)   throw new Error('ambiguous');

  // Step 2: fuzzy fallback — only reached when no exact match exists
  const matches = guests.filter(({ name }) => {
    const n = name.toLowerCase().trim();
    return trigramSimilarity(n, search) >= 0.4 || n.includes(search);
  });
  if (matches.length === 0) throw new Error('not_found');
  if (matches.length > 1)   throw new Error('ambiguous');
  return matches[0];
}
