// ─── FLOORPLAN SNAPSHOTS (#162) ───────────────────────────────────────────────
// Pure helpers for the couple's venue floorplan/layout snapshots. Metadata is a
// JSONB array on the weddings singleton row (migration 0013); images live in the
// public wedding-photos bucket under floorplans/. Client-side hygiene only — the
// weddings_floorplans_size check constraint + upsert_floorplans RPC gate are the
// authoritative enforcement.
export const MAX_FLOORPLANS = 6;
export const MAX_FLOORPLAN_LABEL = 80;

const PATH_PREFIX = "floorplans/";

export const cleanFloorplanLabel = (v) => String(v ?? "").trim().slice(0, MAX_FLOORPLAN_LABEL);

// Defensive parse of the DB value: whatever is stored, the app only ever sees a
// well-shaped, capped, deduped array. Never mutates its input.
export const normalizeFloorplans = (raw) => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const e of raw) {
    if (out.length >= MAX_FLOORPLANS) break;
    if (!e || typeof e !== "object" || Array.isArray(e)) continue;
    if (typeof e.id !== "string" || !e.id || seen.has(e.id)) continue;
    if (typeof e.url !== "string" || !e.url) continue;
    if (typeof e.path !== "string" || !e.path.startsWith(PATH_PREFIX)) continue;
    seen.add(e.id);
    out.push({
      id: e.id,
      path: e.path,
      url: e.url,
      label: cleanFloorplanLabel(e.label),
      created_at: typeof e.created_at === "string" ? e.created_at : "",
    });
  }
  return out;
};

export const canAddFloorplan = (list) => list.length < MAX_FLOORPLANS;

export const addFloorplan = (list, entry) => (canAddFloorplan(list) ? [...list, entry] : list);

export const removeFloorplan = (list, id) => list.filter((e) => e.id !== id);

export const setFloorplanLabel = (list, id, label) =>
  list.map((e) => (e.id === id ? { ...e, label: cleanFloorplanLabel(label) } : e));

// prepareImage() always re-encodes to JPEG, so the extension is fixed.
export const floorplanPath = (id) => `${PATH_PREFIX}${id}.jpg`;

export const newFloorplanId = () =>
  `fp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
