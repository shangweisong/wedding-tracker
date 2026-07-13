import { computeGanttLayout } from "../lib/runsheetGantt.js";
import { formatTimeLabel } from "../lib/runsheetTime.js";

// Shared read-only Gantt/timeline view of runsheet items (#121). Used by the
// admin RunsheetTab (English-only) and the public RunsheetPage (localized):
// the component itself is i18n-free — the public page passes translated
// strings via the `labels`/`formatDuration` props, the admin passes nothing.

const AXIS_H = 26;   // hour-label row height
const ROW_H = 38;    // lane row height
const BAR_H = 30;
const HOUR_W = 64;   // min px per hour before horizontal scroll kicks in

const styles = `
  .rsg-card {
    background: white; border-radius: var(--radius); box-shadow: var(--shadow);
    border: 1.5px solid rgba(201,168,76,0.15); padding: 16px;
  }
  .rsg-scroll { overflow-x: auto; padding: 0 32px; }
  .rsg-chart { position: relative; }
  .rsg-tick-line {
    position: absolute; top: ${AXIS_H}px; bottom: 0; width: 1px;
    background: rgba(201,168,76,0.15);
  }
  .rsg-tick-label {
    position: absolute; top: 2px; transform: translateX(-50%);
    font-size: 10px; color: var(--brown); opacity: 0.6;
    white-space: nowrap; letter-spacing: 0.04em;
  }
  .rsg-bar {
    position: absolute; height: ${BAR_H}px; box-sizing: border-box;
    background: var(--gold); border-radius: 6px; min-width: 18px;
    display: flex; align-items: center; padding: 0 8px; overflow: hidden;
  }
  .rsg-bar.rsg-bar-nodur {
    background: rgba(201,168,76,0.25); border: 1.5px dashed var(--gold);
  }
  .rsg-bar-label {
    font-size: 12px; color: var(--charcoal); font-weight: 500;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .rsg-empty {
    text-align: center; padding: 36px 16px; color: var(--brown);
    opacity: 0.5; font-size: 13px;
  }
  .rsg-unscheduled {
    display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
    margin-top: 14px; padding-top: 12px;
    border-top: 1px dashed rgba(201,168,76,0.3);
  }
  .rsg-unscheduled-label {
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--brown); opacity: 0.6;
  }
  .rsg-chip {
    font-size: 12px; padding: 3px 10px; border-radius: 20px;
    background: rgba(201,168,76,0.12); color: var(--brown);
  }
`;

const DEFAULT_LABELS = {
  empty: "Nothing scheduled yet — set start times in the list view.",
  unscheduled: "Unscheduled",
};

const defaultFormatDuration = (n) => `${n} min`;

export default function RunsheetGantt({ items, labels, formatDuration }) {
  const l = { ...DEFAULT_LABELS, ...labels };
  const fmtDur = formatDuration ?? defaultFormatDuration;
  const { scheduled, unscheduled, laneCount, windowStartMin, windowEndMin, hourTicks } =
    computeGanttLayout(items);
  const hours = (windowEndMin - windowStartMin) / 60;

  return (
    <div className="rsg-card">
      <style>{styles}</style>
      {scheduled.length === 0 ? (
        <div className="rsg-empty">{l.empty}</div>
      ) : (
        <div className="rsg-scroll">
          <div
            className="rsg-chart"
            style={{ minWidth: hours * HOUR_W, height: AXIS_H + laneCount * ROW_H }}
          >
            {hourTicks.map((t) => (
              <div key={t.min}>
                <span className="rsg-tick-label" style={{ left: `${t.leftPct}%` }}>{t.label}</span>
                <div className="rsg-tick-line" style={{ left: `${t.leftPct}%` }} />
              </div>
            ))}
            {scheduled.map((s) => (
              <div
                key={s.item.id}
                className={`rsg-bar ${s.noDuration ? "rsg-bar-nodur" : ""}`}
                style={{
                  left: `${s.leftPct}%`,
                  width: `${s.widthPct}%`,
                  top: AXIS_H + s.lane * ROW_H + (ROW_H - BAR_H) / 2,
                }}
                title={[
                  s.item.event,
                  formatTimeLabel(s.item.startTime),
                  s.noDuration ? null : fmtDur(s.item.durationMin),
                  s.item.involved,
                ].filter(Boolean).join(" · ")}
              >
                <span className="rsg-bar-label">{s.item.event || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {unscheduled.length > 0 && (
        <div className="rsg-unscheduled">
          <span className="rsg-unscheduled-label">{l.unscheduled}</span>
          {unscheduled.map((item) => (
            <span key={item.id} className="rsg-chip">
              {item.event || "—"}
              {item.timeText?.trim() ? ` · ${item.timeText}` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
