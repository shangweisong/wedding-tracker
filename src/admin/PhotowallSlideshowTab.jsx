import { useState, useEffect, useRef, useCallback } from "react";
import { sb, isDemoMode } from "../lib/supabase.js";
import { DEMO_PHOTOWALL } from "../lib/photowall.js";
import { nextSlideIndex, mergePhotos, slideIndexAfterMerge } from "../lib/slideshow.js";

// D-Day Photowall slideshow (#149) — projector filler content, available to
// BOTH roles (the helper account can run it without the couple logging in).
// View-only: photos come from the same anon-safe `get_photowall_photos` RPC the
// public wedding page uses (live photos only — moderation stays in the couple's
// planning Photowall tab). The rotation auto-advances and re-polls so newly
// approved photos join without restarting the show (`src/lib/slideshow.js`).

const ADVANCE_MS = 8000; // auto-advance cadence
const POLL_MS = 20000;   // same cadence as the public PhotowallSection

export default function PhotowallSlideshowTab({ wedding }) {
  // photos: null = loading; index always points into photos.
  const [show, setShow] = useState({ photos: null, index: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const failedRef = useRef(new Set()); // ids whose <img> 404'd — keep out of rotation

  const slug = wedding?.slug;
  const enabled = !!wedding?.enable_photowall;

  const applyRows = useCallback((rows) => {
    const live = (rows || []).filter((p) => !failedRef.current.has(p.id));
    setShow((s) => {
      const prev = s.photos || [];
      const merged = mergePhotos(prev, live);
      return { photos: merged, index: slideIndexAfterMerge(merged, prev[s.index]?.id) };
    });
  }, []);

  const load = useCallback(async () => {
    if (isDemoMode) { applyRows(DEMO_PHOTOWALL); return; }
    if (!slug) return;
    try {
      applyRows(await sb.rpc("get_photowall_photos", { p_slug: slug }));
    } catch {
      // Transient fetch failure: keep the current rotation running.
    }
  }, [slug, applyRows]);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [enabled, load]);

  const advance = useCallback((delta) => {
    setShow((s) => ({ ...s, index: nextSlideIndex(s.index, (s.photos || []).length, delta) }));
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const t = setInterval(() => advance(1), ADVANCE_MS);
    return () => clearInterval(t);
  }, [enabled, advance]);

  // Keyboard arrows work when the slideshow (or fullscreen) has focus.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") advance(1);
      if (e.key === "ArrowLeft") advance(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else containerRef.current?.requestFullscreen?.();
  };

  const dropFailed = (id) => {
    failedRef.current.add(id);
    setShow((s) => {
      const merged = (s.photos || []).filter((p) => p.id !== id);
      return { photos: merged, index: slideIndexAfterMerge(merged, (s.photos || [])[s.index]?.id) };
    });
  };

  if (!enabled) {
    return (
      <div className="empty">
        <div className="empty-icon">📸</div>
        <div className="empty-text">Photowall is not enabled</div>
        <div className="empty-sub">The couple can turn it on (and set an upload PIN) in Wedding Setup → Guest Photowall.</div>
      </div>
    );
  }
  if (show.photos === null) {
    return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Loading photos…</div></div>;
  }
  if (show.photos.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">📸</div>
        <div className="empty-text">No photos yet</div>
        <div className="empty-sub">Guests upload from the wedding page — approved photos join the slideshow automatically.</div>
      </div>
    );
  }

  const photo = show.photos[Math.min(show.index, show.photos.length - 1)];
  return (
    // Fullscreen targets the ROOT wrapper so the ◀ ▶ / exit controls stay on
    // screen — fullscreening only the photo pane would hide its siblings and
    // trap touch users (no Esc key).
    <div
      ref={containerRef}
      style={isFullscreen ? { background: "#111", display: "flex", flexDirection: "column", height: "100vh" } : undefined}
    >
      <div
        style={{
          position: "relative", background: "#111", borderRadius: isFullscreen ? 0 : "var(--radius)",
          overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
          ...(isFullscreen ? { flex: 1, minHeight: 0 } : { height: "min(72vh, 640px)" }),
        }}
      >
        <img
          key={photo.id}
          src={photo.public_url}
          alt={photo.caption || "Guest photo"}
          onError={() => dropFailed(photo.id)}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
        {(photo.caption || photo.uploader_name) && (
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 0,
            padding: "28px 24px 16px",
            background: "linear-gradient(transparent, rgba(0,0,0,0.72))",
            color: "white", textAlign: "center",
          }}>
            {photo.caption && (
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: isFullscreen ? "28px" : "20px", fontStyle: "italic" }}>
                “{photo.caption}”
              </div>
            )}
            <div style={{ fontSize: isFullscreen ? "15px" : "12px", opacity: 0.75, marginTop: "4px" }}>
              — {photo.uploader_name || "Anonymous"}
            </div>
          </div>
        )}
        <div style={{ position: "absolute", top: "12px", right: "14px", color: "rgba(255,255,255,0.65)", fontSize: "12px", letterSpacing: "0.08em" }}>
          {show.index + 1} / {show.photos.length}
        </div>
      </div>
      <div style={{
        display: "flex", justifyContent: "center", gap: "10px",
        ...(isFullscreen ? { padding: "12px 0 16px", background: "#111" } : { marginTop: "14px" }),
      }}>
        <button className="btn btn-outline btn-sm" onClick={() => advance(-1)} aria-label="Previous photo">◀</button>
        <button className="btn btn-outline btn-sm" onClick={() => advance(1)} aria-label="Next photo">▶</button>
        <button className="btn btn-gold btn-sm" onClick={toggleFullscreen}>
          {isFullscreen ? "Exit fullscreen" : "⛶ Fullscreen"}
        </button>
      </div>
    </div>
  );
}
