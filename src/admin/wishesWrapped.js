// Pure stats engine for Wedding Wishes Wrapped — no side effects, fully testable.

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','shall','should','may',
  'might','must','can','could','i','you','he','she','it','we','they','me',
  'him','her','us','them','my','your','his','its','our','their','this','that',
  'these','those','to','of','in','on','at','for','with','by','from','up',
  'about','into','through','during','before','after','above','below','between',
  'so','if','as','all','not','no','yes','just','very','also','then','than',
  'when','where','who','what','how','some','any','each','every','both',
  'get','got','go','going','make','made','see','know','think','want','like',
  'll','ve','re','d','s','t','m',
]);

const EMOJI_RE = /\p{Extended_Pictographic}/gu;

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/^'+|'+$/g, ''))
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w));
}

function msgEmojis(msg) {
  return (msg.match(EMOJI_RE) || []);
}

function msgWords(msg) {
  return (msg || '').trim().split(/\s+/).filter(w => w.length > 0);
}

// ─── Participation commentary ─────────────────────────────────────────────────
export function participationComment(rate, count) {
  if (count === 0)  return "Everyone came for the food, apparently 🍽️";
  if (rate === 1)   return "Every. Single. Guest. You are SO loved 🥹";
  if (rate >= 0.85) return "Basically everyone had something to say — you are well loved 🥹";
  if (rate >= 0.65) return "Your guests really showed up for you 💝";
  if (rate >= 0.50) return "More than half your guests wrote something 🎉";
  if (rate >= 0.35) return "A solid group had things to say ✍️";
  if (rate >= 0.15) return "A few kind souls took a moment to write 💬";
  return "Seems like most guests were here for the food... and that's okay 🍽️";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Main computation ─────────────────────────────────────────────────────────
export function computeWrapped(guests) {
  const totalGuests = guests.length;
  const wishers = guests.filter(g => (g.rsvp_message || '').trim().length > 0);

  const empty = {
    totalGuests, totalWishes: 0, totalWords: 0, avgLength: 0, participationRate: 0,
    longestWish: null, shortestWish: null, topWords: [], awards: {},
    silentGuests: [],
    sides: {
      bride: { total: 0, wishers: 0, avgWords: 0, emojiCount: 0 },
      groom: { total: 0, wishers: 0, avgWords: 0, emojiCount: 0 },
    },
    clusters: { essayists: 0, brief: 0, emojiLovers: 0, shouty: 0 },
    totalEmojis: 0, topEmoji: null, topEmojiRanking: [], topOpeningWord: null, novelPages: 0,
  };

  if (wishers.length === 0) return empty;

  // ── Word cloud ──
  const freq = new Map();
  for (const g of wishers) {
    for (const w of tokenize(g.rsvp_message)) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  const topWords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word, count]) => ({ word, count }));

  // ── Per-guest stats ──
  const stats = wishers.map(g => {
    const msg = (g.rsvp_message || '').trim();
    const words = msgWords(msg);
    const emojis = msgEmojis(msg).length;
    const exclamations = (msg.match(/!/g) || []).length;
    const unique = new Set(
      msg.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z]/g, '')).filter(w => w.length > 1)
    );
    return { g, msg, wordCount: words.length, emojis, exclamations, uniqueRatio: words.length ? unique.size / words.length : 0 };
  });

  const totalWords = stats.reduce((s, x) => s + x.wordCount, 0);
  const longest  = stats.reduce((a, b) => b.wordCount > a.wordCount ? b : a);
  const shortest = stats.reduce((a, b) => b.wordCount < a.wordCount ? b : a);

  // ── Awards ──
  const awards = {};
  const bestExclaim = stats.reduce((a, b) => b.exclamations > a.exclamations ? b : a);
  if (bestExclaim.exclamations > 0) {
    awards.mostEnthusiastic = { guest: bestExclaim.g, value: bestExclaim.exclamations, label: `exclamation mark${bestExclaim.exclamations !== 1 ? 's' : ''}` };
  }
  const bestEmoji = stats.reduce((a, b) => b.emojis > a.emojis ? b : a);
  if (bestEmoji.emojis > 0) {
    awards.mostEmoji = { guest: bestEmoji.g, value: bestEmoji.emojis, label: `emoji${bestEmoji.emojis !== 1 ? 's' : ''}` };
  }
  awards.mostWords = { guest: longest.g, value: longest.wordCount, label: `word${longest.wordCount !== 1 ? 's' : ''}` };
  if (shortest.g.id !== longest.g.id) {
    awards.fewestWords = { guest: shortest.g, value: shortest.wordCount, label: `word${shortest.wordCount !== 1 ? 's' : ''}` };
  }
  const poeticCandidates = stats.filter(x => x.wordCount >= 5);
  if (poeticCandidates.length > 0) {
    const best = poeticCandidates.reduce((a, b) => b.uniqueRatio > a.uniqueRatio ? b : a);
    awards.mostPoetic = { guest: best.g, value: Math.round(best.uniqueRatio * 100), label: '% unique words' };
  }

  // ── Sides (bride vs groom) ──
  const makeSide = (party) => {
    const sideGuests   = guests.filter(g => g.party === party);
    const sideWishers  = sideGuests.filter(g => (g.rsvp_message || '').trim().length > 0);
    const words  = sideWishers.reduce((s, g) => s + msgWords((g.rsvp_message || '').trim()).length, 0);
    const emojis = sideWishers.reduce((s, g) => s + msgEmojis(g.rsvp_message || '').length, 0);
    return {
      total:      sideGuests.length,
      wishers:    sideWishers.length,
      avgWords:   sideWishers.length ? Math.round(words / sideWishers.length) : 0,
      emojiCount: emojis,
    };
  };
  const sides = { bride: makeSide('bride'), groom: makeSide('groom') };

  // ── Personality clusters ──
  const clusters = {
    essayists:   stats.filter(x => x.wordCount >= 40).length,
    brief:       stats.filter(x => x.wordCount < 10).length,
    emojiLovers: stats.filter(x => x.emojis >= 2).length,
    shouty:      stats.filter(x => x.exclamations >= 2).length,
  };

  // ── Emoji stats ──
  const allEmojis = [];
  for (const g of wishers) {
    allEmojis.push(...msgEmojis(g.rsvp_message || ''));
  }
  const emojiFreq = new Map();
  for (const e of allEmojis) emojiFreq.set(e, (emojiFreq.get(e) || 0) + 1);
  const topEmojiRanking = [...emojiFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([emoji, count]) => ({ emoji, count }));
  const topEmoji = topEmojiRanking[0] ?? null;

  // ── Most common opening word ──
  const openings = wishers.map(g => {
    const first = (g.rsvp_message || '').trim().split(/\s+/)[0] || '';
    return first.toLowerCase().replace(/[^a-z]/g, '');
  }).filter(w => w.length >= 3 && !STOP_WORDS.has(w));

  const openingFreq = new Map();
  for (const w of openings) openingFreq.set(w, (openingFreq.get(w) || 0) + 1);
  const topOpeningEntry = [...openingFreq.entries()].sort((a, b) => b[1] - a[1])[0];
  const topOpeningWord = topOpeningEntry && topOpeningEntry[1] >= 2
    ? { word: topOpeningEntry[0], count: topOpeningEntry[1] }
    : null;

  // ── Hall of Silence — random sample of up to 3 guests who said nothing ──
  // Math.random() is intentional: different people called out each time Generate is clicked.
  const silent = guests.filter(g => !(g.rsvp_message || '').trim());
  const silentGuests = shuffled(silent).slice(0, 3);

  return {
    totalGuests,
    totalWishes:     wishers.length,
    totalWords,
    avgLength:       Math.round(totalWords / wishers.length),
    participationRate: totalGuests > 0 ? wishers.length / totalGuests : 0,
    longestWish:     { guest: longest.g,  message: longest.msg,  wordCount: longest.wordCount  },
    shortestWish:    { guest: shortest.g, message: shortest.msg, wordCount: shortest.wordCount },
    topWords,
    awards,
    silentGuests,
    sides,
    clusters,
    totalEmojis:     allEmojis.length,
    topEmoji,
    topEmojiRanking,
    topOpeningWord,
    novelPages:      Math.round(totalWords / 250),
  };
}
