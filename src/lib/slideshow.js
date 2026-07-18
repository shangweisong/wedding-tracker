// Photowall slideshow helpers (pure), #149.
//
// The D-Day Photowall tab (`src/admin/PhotowallSlideshowTab.jsx`) runs an
// auto-advancing projector view of the LIVE guest photos, refreshed by polling
// the same anon-safe `get_photowall_photos` RPC the public page uses. These
// helpers keep the rotation stable across polls: existing photos keep their
// order (so the show never jumps), newly approved photos join at the end, and
// moderated-away photos drop out. `checkin.js`/`draw.js` pattern: pure logic
// here, network + React in the component.

// Advance the slide index by `delta` (±1), wrapping around `count` slides.
export function nextSlideIndex(current, count, delta) {
  if (!count) return 0;
  return (((current + delta) % count) + count) % count;
}

// Fold a fresh poll result into the current rotation: keep the existing order
// (with fields refreshed from the incoming rows), append genuinely new photos
// at the end, drop photos that are no longer live.
export function mergePhotos(existing, incoming) {
  const incomingById = new Map(incoming.map((p) => [p.id, p]));
  const kept = existing
    .filter((p) => incomingById.has(p.id))
    .map((p) => incomingById.get(p.id));
  const keptIds = new Set(kept.map((p) => p.id));
  return [...kept, ...incoming.filter((p) => !keptIds.has(p.id))];
}

// Where the show should point after a merge: stay on the current photo if it
// survived, otherwise restart from the first slide.
export function slideIndexAfterMerge(photos, currentId) {
  const i = photos.findIndex((p) => p.id === currentId);
  return i === -1 ? 0 : i;
}
