// Pure Gantt layout math for the runsheet timeline view (#121) — no DOM, fully
// testable. Consumes upgraded items (see runsheetTime.js) and produces
// percentage-positioned bars, greedy overlap lanes, and hour-axis ticks.
//
// Times are same-day absolute; a duration overflowing midnight simply extends
// the axis past 24:00 (labels wrap via mod-1440). Multi-day runsheets (an
// *entered* 01:00 supper after a 23:00 party) are out of scope — a future
// dayOffset field is the clean fix.
import { formatTimeLabel } from "./runsheetTime.js";

const pad2 = (n) => String(n).padStart(2, "0");
const MIN_SPAN = 120; // a lone short item shouldn't render a comically wide bar

export function computeGanttLayout(items, { defaultDurationMin = 15 } = {}) {
  const list = Array.isArray(items) ? items : [];
  const scheduledRaw = [];
  const unscheduled = [];

  list.forEach((item, index) => {
    const m = /^(\d{2}):(\d{2})$/.exec(item?.startTime ?? "");
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) {
      unscheduled.push(item);
      return;
    }
    const startMin = Number(m[1]) * 60 + Number(m[2]);
    const noDuration = item.durationMin == null;
    const endMin = startMin + (noDuration ? defaultDurationMin : item.durationMin);
    scheduledRaw.push({ item, index, startMin, endMin, noDuration });
  });

  if (scheduledRaw.length === 0) {
    return {
      scheduled: [], unscheduled, laneCount: 0,
      windowStartMin: 0, windowEndMin: 0, hourTicks: [],
    };
  }

  scheduledRaw.sort((a, b) => a.startMin - b.startMin || a.index - b.index);

  const windowStartMin = Math.floor(scheduledRaw[0].startMin / 60) * 60;
  let windowEndMin = Math.ceil(Math.max(...scheduledRaw.map((s) => s.endMin)) / 60) * 60;
  if (windowEndMin - windowStartMin < MIN_SPAN) windowEndMin = windowStartMin + MIN_SPAN;
  const span = windowEndMin - windowStartMin;

  // Greedy interval partitioning: first lane free at this start time wins;
  // back-to-back items (end == next start) share a lane.
  const laneEnds = [];
  const scheduled = scheduledRaw.map(({ item, startMin, endMin, noDuration }) => {
    let lane = laneEnds.findIndex((end) => end <= startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(endMin);
    } else {
      laneEnds[lane] = endMin;
    }
    return {
      item, startMin, endMin, lane, noDuration,
      leftPct: ((startMin - windowStartMin) / span) * 100,
      widthPct: ((endMin - startMin) / span) * 100,
    };
  });

  const hourTicks = [];
  for (let min = windowStartMin; min <= windowEndMin; min += 60) {
    const dayMin = min % 1440;
    hourTicks.push({
      min,
      leftPct: ((min - windowStartMin) / span) * 100,
      label: formatTimeLabel(`${pad2(Math.floor(dayMin / 60))}:${pad2(dayMin % 60)}`),
    });
  }

  return { scheduled, unscheduled, laneCount: laneEnds.length, windowStartMin, windowEndMin, hourTicks };
}
