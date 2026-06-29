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

export function computeWrapped(guests) {
  const wishers = guests.filter(g => (g.rsvp_message || '').trim().length > 0);

  if (wishers.length === 0) {
    return { totalWishes: 0, totalWords: 0, avgLength: 0, longestWish: null, shortestWish: null, topWords: [], awards: {} };
  }

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

  const stats = wishers.map(g => {
    const msg = (g.rsvp_message || '').trim();
    const words = msg.split(/\s+/).filter(w => w.length > 0);
    const emojis = (msg.match(EMOJI_RE) || []).length;
    const exclamations = (msg.match(/!/g) || []).length;
    const unique = new Set(
      msg.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z]/g, '')).filter(w => w.length > 1)
    );
    return { g, msg, wordCount: words.length, emojis, exclamations, uniqueRatio: words.length ? unique.size / words.length : 0 };
  });

  const totalWords = stats.reduce((s, x) => s + x.wordCount, 0);
  const longest = stats.reduce((a, b) => b.wordCount > a.wordCount ? b : a);
  const shortest = stats.reduce((a, b) => b.wordCount < a.wordCount ? b : a);

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

  // Only show fewest words if it's a different guest than most words
  if (shortest.g.id !== longest.g.id) {
    awards.fewestWords = { guest: shortest.g, value: shortest.wordCount, label: `word${shortest.wordCount !== 1 ? 's' : ''}` };
  }

  const poeticCandidates = stats.filter(x => x.wordCount >= 5);
  if (poeticCandidates.length > 0) {
    const best = poeticCandidates.reduce((a, b) => b.uniqueRatio > a.uniqueRatio ? b : a);
    awards.mostPoetic = { guest: best.g, value: Math.round(best.uniqueRatio * 100), label: '% unique words' };
  }

  return {
    totalWishes: wishers.length,
    totalWords,
    avgLength: Math.round(totalWords / wishers.length),
    longestWish: { guest: longest.g, message: longest.msg, wordCount: longest.wordCount },
    shortestWish: { guest: shortest.g, message: shortest.msg, wordCount: shortest.wordCount },
    topWords,
    awards,
  };
}
