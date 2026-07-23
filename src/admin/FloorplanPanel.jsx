import { useEffect, useRef, useState } from "react";
import { supabase, isDemoMode } from "../lib/supabase.js";
import { prepareImage } from "../lib/photoPrep.js";
import {
  MAX_FLOORPLANS,
  MAX_FLOORPLAN_LABEL,
  canAddFloorplan,
  addFloorplan,
  removeFloorplan,
  setFloorplanLabel,
  floorplanPath,
  newFloorplanId,
} from "../lib/floorplan.js";

const styles = `
  .fp-panel { display: flex; flex-direction: column; gap: 10px; }
  .fp-strip { display: flex; gap: 12px; flex-wrap: wrap; }
  .fp-card { width: 180px; background: white; border-radius: 8px; box-shadow: var(--shadow); overflow: hidden; display: flex; flex-direction: column; }
  .fp-thumb-button { width: 100%; border: 0; padding: 0; background: transparent; cursor: zoom-in; display: block; }
  .fp-thumb { width: 100%; height: 110px; object-fit: cover; display: block; background: var(--warm-white); }
  .fp-card-body { padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
  .fp-label { font-size: 12px; color: var(--charcoal); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fp-label-input { width: 100%; padding: 4px 6px; border: 1px solid rgba(201,168,76,0.3); border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--charcoal); }
  .fp-label-input:focus { outline: none; border-color: var(--gold); }
  .fp-card-actions { display: flex; justify-content: flex-end; }
  .fp-delete-btn { border: none; background: transparent; cursor: pointer; font-size: 12px; color: var(--brown); opacity: 0.6; padding: 2px 6px; border-radius: 6px; }
  .fp-delete-btn:hover { opacity: 1; background: var(--warm-white); }
  .fp-delete-btn.confirm { color: white; background: #c0392b; opacity: 1; }
  .fp-add-hint { font-size: 12px; color: var(--brown); opacity: 0.65; }
  .fp-lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; cursor: zoom-out; padding: 24px; }
  .fp-lightbox img { max-width: 100%; max-height: 90%; object-fit: contain; border-radius: 4px; }
  .fp-lightbox-caption { color: white; font-size: 14px; opacity: 0.85; }
`;

// Floorplan/layout snapshots (#162). Couple mode (isReadOnly=false) manages
// uploads in Planning → Seating; both roles view read-only in D-Day → Tables.
// Writes go through onSave → the couple-gated upsert_floorplans RPC; images go
// straight to the public wedding-photos bucket (couple-only write policy).
export default function FloorplanPanel({ floorplans, isReadOnly, onSave, showToast }) {
  // One busy flag across upload/delete/label-save: every mutation computes its
  // next array from the floorplans prop, so two in-flight saves would clobber
  // each other's change (last RPC wins) — allow only one outstanding at a time.
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!viewer) return;
    const onKey = (e) => e.key === "Escape" && setViewer(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer]);

  const uploadFloorplan = async (e) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file");
      return;
    }
    if (isDemoMode || !supabase) {
      showToast("Image upload not available in demo mode");
      return;
    }
    if (!canAddFloorplan(floorplans)) {
      showToast(`Up to ${MAX_FLOORPLANS} floorplans supported`);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const { blob, contentType } = await prepareImage(file);
      const id = newFloorplanId();
      const path = floorplanPath(id);
      const { error: uploadError } = await supabase.storage
        .from("wedding-photos")
        .upload(path, blob, { upsert: false, contentType });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("wedding-photos").getPublicUrl(path);
      const entry = { id, path, url: data.publicUrl, label: "", created_at: new Date().toISOString() };
      const ok = await onSave(addFloorplan(floorplans, entry));
      if (!ok) {
        // Metadata save failed — don't leave the just-uploaded object orphaned.
        await supabase.storage.from("wedding-photos").remove([path]).catch(() => {});
        return;
      }
      showToast("Floorplan uploaded!");
    } catch (err) {
      console.error("[FloorplanPanel] upload error:", err);
      if (err?.code === "too_large") showToast("Image too large (max 40MB)");
      else if (err?.code === "unsupported_image") showToast("This image format isn't supported by your browser");
      else showToast(`Upload failed: ${err?.message || err?.error || JSON.stringify(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const deleteFloorplan = async (entry) => {
    setConfirmDeleteId(null);
    if (busy) return;
    setBusy(true);
    try {
      const ok = await onSave(removeFloorplan(floorplans, entry.id));
      if (!ok) return;
      showToast("Floorplan removed");
      if (!isDemoMode && supabase) {
        // Best-effort: a failed remove only leaves an unreferenced object behind.
        await supabase.storage.from("wedding-photos").remove([entry.path]).catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  };

  const saveLabel = async (entry, value) => {
    if (value === entry.label || busy) return;
    setBusy(true);
    try {
      await onSave(setFloorplanLabel(floorplans, entry.id, value));
    } finally {
      setBusy(false);
    }
  };

  if (isReadOnly && floorplans.length === 0) return null;

  return (
    <div className="fp-panel">
      <style>{styles}</style>
      <div className="fp-strip">
        {floorplans.map((f) => (
          <div className="fp-card" key={f.id}>
            <button
              type="button"
              className="fp-thumb-button"
              aria-label={`View ${f.label || "floorplan"} fullscreen`}
              onClick={() => setViewer(f)}
            >
              <img className="fp-thumb" src={f.url} alt="" loading="lazy" />
            </button>
            <div className="fp-card-body">
              {isReadOnly ? (
                f.label && <div className="fp-label">{f.label}</div>
              ) : (
                <>
                  {/* Uncontrolled on purpose: labels are single-editor (couple
                      only) and saved on blur; the value never changes from
                      elsewhere while this card is mounted. */}
                  <input
                    className="fp-label-input"
                    defaultValue={f.label}
                    placeholder="Label (e.g. Ballroom)"
                    maxLength={MAX_FLOORPLAN_LABEL}
                    disabled={busy}
                    onBlur={(e) => saveLabel(f, e.target.value)}
                  />
                  <div className="fp-card-actions">
                    <button
                      className={`fp-delete-btn ${confirmDeleteId === f.id ? "confirm" : ""}`}
                      disabled={busy}
                      onClick={() =>
                        confirmDeleteId === f.id ? deleteFloorplan(f) : setConfirmDeleteId(f.id)
                      }
                      onBlur={() => setConfirmDeleteId((id) => (id === f.id ? null : id))}
                    >
                      {confirmDeleteId === f.id ? "Delete?" : "✕ Remove"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {!isReadOnly &&
        (canAddFloorplan(floorplans) ? (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={uploadFloorplan}
            />
            <button
              className="btn btn-outline"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {busy ? "Saving…" : "+ Add Floorplan"}
            </button>
          </div>
        ) : (
          <div className="fp-add-hint">Up to {MAX_FLOORPLANS} floorplans — remove one to add another.</div>
        ))}

      {viewer && (
        <div className="fp-lightbox" onClick={() => setViewer(null)}>
          <img src={viewer.url} alt={viewer.label || "Floorplan"} />
          {viewer.label && <div className="fp-lightbox-caption">{viewer.label}</div>}
        </div>
      )}
    </div>
  );
}
