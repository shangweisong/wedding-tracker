// Reconciles a locally-edited event list against the persisted `wedding_events`
// rows into the create/update/delete sets the admin applies via the Supabase SDK.
// Keeping this pure makes the batch-save logic testable without a DB and lets the
// editor use a fun_qa-style local-draft UX for relational rows.

// Comparable fields (sort_order is derived from array position, not the input).
const FIELDS = [
  'name', 'event_date', 'start_time', 'location',
  'requires_meal', 'requires_headcount', 'is_active', 'sort_order',
];

/** A new, unsaved event row with sensible defaults. */
export function blankEvent() {
  return {
    name: '',
    event_date: '',
    start_time: '',
    location: '',
    requires_meal: false,
    requires_headcount: true,
    is_active: true,
  };
}

// A persisted row has a real uuid id; new draft rows have none (or a `new_` temp id).
function hasRealId(ev) {
  return typeof ev?.id === 'string' && ev.id !== '' && !ev.id.startsWith('new_');
}

// Canonicalize content_translations to a deterministic, trimmed form so an
// unchanged translation set (or one with only blank fields) doesn't churn.
// Shape: { "<locale>": { name?, location? } } with empty strings/locales dropped.
function cleanCT(ct) {
  if (!ct || typeof ct !== 'object') return {};
  const out = {};
  for (const loc of Object.keys(ct).sort()) {
    const v = ct[loc];
    if (!v || typeof v !== 'object') continue;
    const entry = {};
    for (const f of Object.keys(v).sort()) {
      const s = String(v[f] ?? '').trim();
      if (s) entry[f] = s;
    }
    if (Object.keys(entry).length) out[loc] = entry;
  }
  return out;
}

// Normalize a row's comparable fields. `time` comes back from Postgres as
// 'HH:MM:SS' but the form uses 'HH:MM' — compare on 'HH:MM' so they don't churn.
function shape(ev, sortOrder) {
  return {
    name: String(ev.name ?? '').trim(),
    event_date: ev.event_date || null,
    start_time: ev.start_time ? String(ev.start_time).slice(0, 5) : null,
    location: String(ev.location ?? '').trim(),
    requires_meal: !!ev.requires_meal,
    requires_headcount: ev.requires_headcount !== false,
    is_active: ev.is_active !== false,
    sort_order: sortOrder,
    content_translations: cleanCT(ev.content_translations),
  };
}

/**
 * @param {Array} original  Persisted event rows (with real ids).
 * @param {Array} draft      The edited list (array order = sort order).
 * @returns {{toCreate:Array, toUpdate:Array<{id:string,patch:object}>, toDelete:string[]}}
 */
export function diffEvents(original, draft) {
  const orig = Array.isArray(original) ? original : [];
  const items = Array.isArray(draft) ? draft : [];
  const origById = new Map(orig.map((e) => [e.id, e]));
  const seen = new Set();

  const toCreate = [];
  const toUpdate = [];

  items.forEach((ev, index) => {
    const next = shape(ev, index);
    if (!hasRealId(ev) || !origById.has(ev.id)) {
      if (next.name) toCreate.push(next); // ignore blank-named new rows
      return;
    }
    seen.add(ev.id);
    const before = shape(origById.get(ev.id), origById.get(ev.id).sort_order ?? 0);
    const patch = {};
    for (const f of FIELDS) {
      if (next[f] !== before[f]) patch[f] = next[f];
    }
    if (JSON.stringify(next.content_translations) !== JSON.stringify(before.content_translations)) {
      patch.content_translations = next.content_translations;
    }
    if (Object.keys(patch).length > 0) toUpdate.push({ id: ev.id, patch });
  });

  const toDelete = orig.map((e) => e.id).filter((id) => !seen.has(id));

  return { toCreate, toUpdate, toDelete };
}
