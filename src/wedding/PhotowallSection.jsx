// Guest photowall section on the public wedding page (#138). Displays live
// guest photos in the same CSS-column masonry as the section galleries (#71)
// and lets guests share a photo behind the couple's photowall PIN. Files go
// browser → external storage via /api/photowall grants; this component never
// sees storage credentials. All authoritative checks are server-side.
import { useState, useEffect, useCallback, useRef } from "react";
import { sb, isDemoMode } from "../lib/supabase.js";
import { useLocale } from "../i18n/index.jsx";
import { cleanPin, MAX_PIN } from "../lib/openRsvp.js";
import {
  ACCEPTED_INPUT_TYPES,
  MAX_UPLOADER_NAME,
  MAX_CAPTION,
  photowallErrorKey,
  visiblePhotos,
  DEMO_PHOTOWALL,
} from "../lib/photowall.js";
import { uploadPhotowallPhoto } from "../lib/photowallUpload.js";

const POLL_MS = 20_000; // relaxed vs the admin 5s poll — anon RPC, many viewers

const PIN_STORAGE_KEY = "wt_photowall_pin";

// Demo placeholders now live in ../lib/photowall.js (shared with the admin
// D-Day slideshow, #149).

const pwStyles = `
  .wp-pw-figure {
    break-inside: avoid; -webkit-column-break-inside: avoid;
    margin: 0 0 12px;
  }
  .wp-pw-figure img {
    width: 100%; height: auto; display: block; border-radius: 12px;
  }
  .wp-pw-caption {
    font-size: 12.5px; line-height: 1.45; opacity: 0.75;
    padding: 6px 4px 0; overflow-wrap: anywhere;
  }
  .wp-pw-by { font-style: italic; opacity: 0.85; }
  .wp-pw-form {
    max-width: 420px; margin: 20px auto 0; display: flex;
    flex-direction: column; gap: 10px; text-align: left;
  }
  .wp-pw-input {
    width: 100%; padding: 11px 14px; font-size: 15px; font-family: inherit;
    border: 1px solid rgba(0,0,0,0.18); border-radius: 10px;
    background: rgba(255,255,255,0.85); color: inherit; box-sizing: border-box;
  }
  .wp-pw-label { font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.7; }
  .wp-pw-note { font-size: 13px; opacity: 0.75; text-align: center; margin-top: 12px; }
  .wp-pw-error { font-size: 13px; color: var(--red, #c0392b); text-align: center; }
  .wp-pw-success { font-size: 13px; color: var(--green, #2d6a4f); text-align: center; }
`;

export default function PhotowallSection({ slug }) {
  const { t } = useLocale();

  const [photos, setPhotos] = useState(null); // null = not loaded yet
  // Photo ids whose <img> 404'd — e.g. the file was deleted from the storage
  // dashboard while its DB row stayed live. Hidden until the next page load.
  const [failedIds, setFailedIds] = useState(() => new Set());
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState(() => {
    try {
      return sessionStorage.getItem(PIN_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [uploaderName, setUploaderName] = useState("");
  const [caption, setCaption] = useState("");
  const [phase, setPhase] = useState("idle"); // idle|preparing|uploading|done|error
  const [errorKey, setErrorKey] = useState("");
  const fileRef = useRef(null);
  const loadSeq = useRef(0);

  const load = useCallback(() => {
    if (isDemoMode) {
      setPhotos(DEMO_PHOTOWALL);
      return;
    }
    // Sequence guard: with a 20s poll, a slow response can resolve after a
    // newer one — only the latest request may set state.
    const seq = ++loadSeq.current;
    sb.rpc("get_photowall_photos", { p_slug: slug })
      .then((rows) => {
        if (loadSeq.current === seq) setPhotos(Array.isArray(rows) ? rows : []);
      })
      .catch(() => setPhotos((prev) => prev ?? []));
  }, [slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return sb.subscribeToChanges("photowall_photos", load, POLL_MS);
  }, [load]);

  async function share(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || phase === "preparing" || phase === "uploading") return;

    setErrorKey("");
    try {
      await uploadPhotowallPhoto({
        pin,
        file,
        uploaderName,
        caption,
        onPhase: setPhase,
      });
      try {
        sessionStorage.setItem(PIN_STORAGE_KEY, cleanPin(pin));
      } catch {
        /* private mode */
      }
      setPin(cleanPin(pin));
      setPhase("done");
      setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      load(); // the photo is live server-side now — pull it in immediately
    } catch (err) {
      setPhase("error");
      setErrorKey(photowallErrorKey(err?.code || err?.message));
    }
  }

  const busy = phase === "preparing" || phase === "uploading";
  const visible = photos === null ? null : visiblePhotos(photos, failedIds);

  return (
    <section className="wp-section">
      <style>{pwStyles}</style>
      <div className="wp-section-eyebrow">{t("wedding.photowall.eyebrow")}</div>
      <div className="wp-section-title">{t("wedding.photowall.title")}</div>

      {visible === null ? null : visible.length > 0 ? (
        <div className="wp-gallery-grid" style={{ columnCount: 3, marginTop: 20 }}>
          {visible.map((p) => (
            <figure key={p.id} className="wp-pw-figure">
              <img
                src={p.public_url}
                alt={p.caption || ""}
                loading="lazy"
                onError={() =>
                  setFailedIds((prev) => (prev.has(p.id) ? prev : new Set(prev).add(p.id)))
                }
              />
              {(p.caption || p.uploader_name) && (
                <figcaption className="wp-pw-caption">
                  {p.caption}
                  {p.caption && p.uploader_name ? " — " : ""}
                  {p.uploader_name && (
                    <span className="wp-pw-by">
                      {t("wedding.photowall.sharedBy", { name: p.uploader_name })}
                    </span>
                  )}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      ) : (
        <p className="wp-pw-note">{t("wedding.photowall.empty")}</p>
      )}

      {isDemoMode ? (
        <p className="wp-pw-note">{t("wedding.photowall.demoNotice")}</p>
      ) : !open ? (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button type="button" className="wp-rsvp-btn" onClick={() => setOpen(true)}
            style={{ fontSize: 13, padding: "12px 28px", letterSpacing: "0.06em", cursor: "pointer" }}>
            {t("wedding.photowall.addPhoto")}
          </button>
        </div>
      ) : (
        <form className="wp-pw-form" onSubmit={share}>
          <div>
            <div className="wp-pw-label">{t("wedding.photowall.pinLabel")}</div>
            <input
              className="wp-pw-input"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={MAX_PIN}
              autoComplete="off"
              placeholder={t("wedding.photowall.pinPlaceholder")}
              required
            />
          </div>
          <div>
            <div className="wp-pw-label">{t("wedding.photowall.nameLabel")}</div>
            <input
              className="wp-pw-input"
              value={uploaderName}
              onChange={(e) => setUploaderName(e.target.value)}
              maxLength={MAX_UPLOADER_NAME}
              placeholder={t("wedding.photowall.optional")}
            />
          </div>
          <div>
            <div className="wp-pw-label">{t("wedding.photowall.captionLabel")}</div>
            <input
              className="wp-pw-input"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={MAX_CAPTION}
              placeholder={t("wedding.photowall.optional")}
            />
          </div>
          <input
            className="wp-pw-input"
            type="file"
            ref={fileRef}
            accept={ACCEPTED_INPUT_TYPES.join(",")}
            required
          />
          <button type="submit" className="wp-rsvp-btn" disabled={busy}
            style={{ fontSize: 13, padding: "12px 28px", letterSpacing: "0.06em", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>
            {phase === "preparing"
              ? t("wedding.photowall.preparing")
              : phase === "uploading"
                ? t("wedding.photowall.uploading")
                : t("wedding.photowall.submit")}
          </button>
          {phase === "error" && errorKey && <div className="wp-pw-error">{t(errorKey)}</div>}
          {phase === "done" && <div className="wp-pw-success">{t("wedding.photowall.success")}</div>}
        </form>
      )}
    </section>
  );
}
