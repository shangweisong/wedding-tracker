import { computeVendorMilestones, vendorCommitted, vendorPaid, fmtMoney } from "../lib/budgetUtils.js";

const STATUS_COLORS = {
  enquiring: { bg: "rgba(201,168,76,0.1)",  color: "var(--gold-dark)", label: "Enquiring" },
  booked:    { bg: "rgba(100,149,237,0.12)", color: "#3a6bb5",          label: "Booked"    },
};

const styles = `
  .vendor-card {
    background: white; border-radius: 10px; padding: 16px 18px;
    box-shadow: var(--shadow); border: 1.5px solid rgba(201,168,76,0.12);
    display: flex; flex-direction: column; gap: 8px;
    transition: border-color 0.15s;
  }
  .vendor-card:hover { border-color: rgba(201,168,76,0.3); }
  .vendor-card-header { display: flex; align-items: flex-start; gap: 10px; }
  .vendor-card-header-left { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .vendor-company { font-size: 15px; font-weight: 600; color: var(--charcoal); }
  .vendor-contract {
    font-size: 18px; font-weight: 700; color: var(--charcoal);
    font-family: 'Cormorant Garamond', serif; letter-spacing: 0.01em;
  }
  .vendor-status-badge {
    font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;
    padding: 3px 9px; border-radius: 20px; flex-shrink: 0; margin-top: 2px;
  }
  .vendor-card-actions { display: flex; gap: 6px; flex-shrink: 0; align-items: flex-start; }
  .vendor-action-btn {
    padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 500;
    border: 1.5px solid; cursor: pointer; transition: background 0.15s;
    background: white;
  }
  .vendor-action-btn.edit {
    border-color: rgba(201,168,76,0.4); color: #7a6020;
  }
  .vendor-action-btn.edit:hover { background: rgba(201,168,76,0.1); }
  .vendor-action-btn.remove {
    border-color: rgba(200,60,60,0.3); color: var(--red);
  }
  .vendor-action-btn.remove:hover { background: rgba(200,60,60,0.07); }
  .vendor-meta { font-size: 12px; color: var(--brown); opacity: 0.7; display: flex; flex-wrap: wrap; gap: 10px; }
  .vendor-milestone-line { font-size: 12px; color: var(--brown); }
  .vendor-overdue { color: var(--red); font-weight: 500; }

  @media (max-width: 640px) {
    .vendor-card { padding: 12px 14px; }
    .vendor-card-header { flex-wrap: wrap; gap: 6px; }
    .vendor-card-header-left { flex: 0 0 100%; }
    .vendor-card-actions { margin-left: auto; }
  }
`;

export default function VendorCard({ vendor, onEdit, onDelete }) {
  const ms  = computeVendorMilestones(vendor.milestones ?? []);
  const committed = vendorCommitted(vendor);
  const paid = vendorPaid(vendor);
  const st  = STATUS_COLORS[vendor.status] ?? STATUS_COLORS.enquiring;

  return (
    <>
      <style>{styles}</style>
      <div className="vendor-card">
        <div className="vendor-card-header">
          <div className="vendor-card-header-left">
            <div className="vendor-company">{vendor.company_name}</div>
            {committed > 0 && (
              <div className="vendor-contract">{fmtMoney(committed)}</div>
            )}
          </div>
          <span className="vendor-status-badge" style={{ background: st.bg, color: st.color }}>
            {st.label}
          </span>
          {vendor.is_fully_paid && (
            <span className="vendor-status-badge" style={{ background: "rgba(46,125,79,0.15)", color: "#2e7d4f" }}>
              Fully paid
            </span>
          )}
          <div className="vendor-card-actions">
            <button className="vendor-action-btn edit" onClick={onEdit}>
              Edit
            </button>
            <button className="vendor-action-btn remove" onClick={onDelete}>
              Delete
            </button>
          </div>
        </div>

        {(vendor.contact_name || vendor.phone || vendor.email) && (
          <div className="vendor-meta">
            {vendor.contact_name && <span>{vendor.contact_name}</span>}
            {vendor.phone && <span>📞 {vendor.phone}</span>}
            {vendor.email && <span>✉ {vendor.email}</span>}
          </div>
        )}

        {committed > 0 && (
          <div className="vendor-milestone-line">
            {(vendor.milestones ?? []).length > 0
              ? `${fmtMoney(paid)} paid · ${fmtMoney(Math.max(0, committed - paid))} remaining`
              : paid > 0
                ? `${fmtMoney(paid)} paid`
                : "No payments recorded yet"}
            {ms.overdueCount > 0 && !vendor.is_fully_paid && (
              <span className="vendor-overdue">
                {" "}· {ms.overdueCount} overdue
              </span>
            )}
          </div>
        )}

        {vendor.notes && (
          <div style={{ fontSize: 12, color: "var(--brown)", opacity: 0.6, fontStyle: "italic" }}>
            {vendor.notes}
          </div>
        )}
      </div>
    </>
  );
}
