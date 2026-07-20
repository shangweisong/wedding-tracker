import { QRCodeSVG } from "qrcode.react";
import { buildRsvpLink } from "../lib/rsvpLink.js";

const styles = `
  .qr-sheet-overlay { position: fixed; inset: 0; background: white; z-index: 1100; overflow: auto; padding: 24px; }
  .qr-sheet-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .qr-sheet-title { font-family: 'Cormorant Garamond', serif; font-size: 24px; color: var(--charcoal); }
  .qr-sheet-hint { font-size: 12px; color: var(--brown); opacity: 0.65; flex: 1 1 100%; margin-top: -10px; margin-bottom: 10px; }
  .qr-sheet-actions { display: flex; gap: 8px; }
  .qr-sheet-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
  .qr-sheet-card { border: 1px solid rgba(92,74,42,0.25); border-radius: 10px; padding: 16px 12px; text-align: center; break-inside: avoid; page-break-inside: avoid; }
  .qr-sheet-name { font-size: 13px; font-weight: 600; color: var(--charcoal); margin-top: 10px; word-break: break-word; }
  .qr-sheet-sub { font-size: 10px; color: var(--brown); opacity: 0.6; margin-top: 3px; }
  @media print {
    body * { visibility: hidden; }
    .qr-sheet-overlay, .qr-sheet-overlay * { visibility: visible; }
    .qr-sheet-overlay { position: absolute; inset: auto; top: 0; left: 0; width: 100%; padding: 0; overflow: visible; }
    .qr-sheet-toolbar, .qr-sheet-hint { display: none; }
  }
`;

// Printable grid of personalized RSVP QR codes (#155) — one card per primary
// guest that has an rsvp_token, plus a lead card for the generic /rsvp link.
// Print isolation follows the SeatingTab window.print() precedent.
export default function QrPrintSheet({ guests, origin, onClose }) {
  const invitees = guests
    .filter((g) => !g.primary_guest_id && g.rsvp_token)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="qr-sheet-overlay">
      <style>{styles}</style>
      <div className="qr-sheet-toolbar">
        <div className="qr-sheet-title">RSVP QR Codes</div>
        <div className="qr-sheet-actions">
          <button className="rsvp-btn rsvp-btn-cancel" onClick={onClose}>Close</button>
          <button className="rsvp-btn rsvp-btn-save" onClick={() => window.print()}>🖨️ Print</button>
        </div>
      </div>
      <div className="qr-sheet-hint">
        Each QR opens that guest&rsquo;s personalized RSVP link — cut out and paste onto their
        physical invite. Treat them like invites: anyone scanning can RSVP as that guest.
      </div>
      <div className="qr-sheet-grid">
        <div className="qr-sheet-card">
          <QRCodeSVG value={buildRsvpLink(origin)} size={140} level="M" marginSize={2} />
          <div className="qr-sheet-name">Generic RSVP</div>
          <div className="qr-sheet-sub">for invites without a name</div>
        </div>
        {invitees.map((g) => (
          <div key={g.id} className="qr-sheet-card">
            <QRCodeSVG value={buildRsvpLink(origin, g.rsvp_token)} size={140} level="M" marginSize={2} />
            <div className="qr-sheet-name">{g.name}</div>
            <div className="qr-sheet-sub">personalized RSVP</div>
          </div>
        ))}
      </div>
    </div>
  );
}
