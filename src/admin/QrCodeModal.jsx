import { useRef } from "react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";

const styles = `
  .qr-modal { max-width: 360px; text-align: center; }
  .qr-modal .modal-title { margin-bottom: 16px; }
  .qr-modal-code { display: inline-block; padding: 12px; background: white; border: 1px solid rgba(201,168,76,0.3); border-radius: 12px; }
  .qr-modal-url { font-size: 11px; color: var(--brown); opacity: 0.7; margin-top: 12px; word-break: break-all; }
  .qr-modal .modal-actions { justify-content: center; }
`;

// QR generation is client-side (qrcode.react) on purpose: the CSP img-src
// allowlist blocks external QR image APIs. The hidden canvas renders a
// higher-resolution copy purely for the PNG download (data: URLs are allowed).
export default function QrCodeModal({ url, title, filename, onClose }) {
  const canvasWrapRef = useRef(null);

  const downloadPng = () => {
    const canvas = canvasWrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = filename;
    a.click();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <style>{styles}</style>
      <div className="modal qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="qr-modal-code">
          <QRCodeSVG value={url} size={224} level="M" marginSize={2} />
        </div>
        <div className="qr-modal-url">{url}</div>
        <div ref={canvasWrapRef} style={{ display: "none" }} aria-hidden="true">
          <QRCodeCanvas value={url} size={512} level="M" marginSize={2} />
        </div>
        <div className="modal-actions">
          <button className="rsvp-btn rsvp-btn-cancel" onClick={onClose}>Close</button>
          <button className="rsvp-btn rsvp-btn-save" onClick={downloadPng}>⬇ Download PNG</button>
        </div>
      </div>
    </div>
  );
}
