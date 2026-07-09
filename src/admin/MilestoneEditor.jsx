const styles = `
  .milestone-editor { display: flex; flex-direction: column; gap: 8px; }
  .milestone-row {
    display: grid;
    grid-template-columns: 1fr 100px 130px 36px 36px;
    gap: 6px;
    align-items: center;
  }
  .milestone-paid-check { display: flex; align-items: center; justify-content: center; }
  .milestone-paid-check input { width: 16px; height: 16px; accent-color: var(--green); cursor: pointer; }
  .milestone-add-btn {
    display: flex; align-items: center; gap: 6px;
    background: none; border: 1.5px dashed rgba(201,168,76,0.4);
    border-radius: 8px; padding: 8px 12px; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 12px;
    color: var(--brown); opacity: 0.7; width: 100%;
    transition: all 0.15s;
  }
  .milestone-add-btn:hover { opacity: 1; border-color: var(--gold); color: var(--gold-dark); }
  .milestone-del-btn {
    width: 28px; height: 28px; border-radius: 6px; border: none; cursor: pointer;
    background: transparent; color: var(--brown); opacity: 0.5;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; transition: all 0.12s;
  }
  .milestone-del-btn:hover { opacity: 1; background: var(--red-soft); color: var(--red); }
  .milestone-header {
    display: grid;
    grid-template-columns: 1fr 100px 130px 36px 36px;
    gap: 6px;
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--brown); opacity: 0.6; padding-bottom: 2px;
  }
  @media (max-width: 600px) {
    .milestone-row, .milestone-header { grid-template-columns: 1fr 80px; }
    .milestone-row > *:nth-child(3),
    .milestone-row > *:nth-child(4) { display: none; }
  }
`;

export default function MilestoneEditor({ milestones, onChange }) {
  const addMilestone = () => {
    onChange([...milestones, { _key: crypto.randomUUID(), label: "Payment", amount: "", due_date: "", paid: false }]);
  };

  const update = (idx, field, value) => {
    onChange(milestones.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  };

  const remove = (idx) => {
    onChange(milestones.filter((_, i) => i !== idx));
  };

  return (
    <>
      <style>{styles}</style>
      <div className="milestone-editor">
        {milestones.length > 0 && (
          <div className="milestone-header">
            <span>Label</span>
            <span>Amount ($)</span>
            <span>Due date</span>
            <span style={{ textAlign: "center" }}>Paid</span>
            <span />
          </div>
        )}
        {milestones.map((m, idx) => (
          <div key={m._key ?? idx} className="milestone-row">
            <input
              className="form-input"
              style={{ fontSize: 13, padding: "7px 10px" }}
              placeholder="e.g. Deposit"
              value={m.label}
              onChange={(e) => update(idx, "label", e.target.value)}
            />
            <input
              className="form-input"
              style={{ fontSize: 13, padding: "7px 10px" }}
              type="number"
              min="0"
              placeholder="0"
              value={m.amount}
              onChange={(e) => update(idx, "amount", e.target.value)}
            />
            <input
              className="form-input"
              style={{ fontSize: 13, padding: "7px 10px" }}
              type="date"
              value={m.due_date}
              onChange={(e) => update(idx, "due_date", e.target.value)}
            />
            <div className="milestone-paid-check">
              <input
                type="checkbox"
                title="Mark as paid"
                checked={m.paid}
                onChange={(e) => update(idx, "paid", e.target.checked)}
              />
            </div>
            <button
              type="button"
              className="milestone-del-btn"
              onClick={() => remove(idx)}
              title="Remove milestone"
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="milestone-add-btn" onClick={addMilestone}>
          + Add milestone
        </button>
      </div>
    </>
  );
}
