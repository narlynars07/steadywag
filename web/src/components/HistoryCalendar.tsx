import { DAY, fmtDate, toTime } from "@/lib/format";
import { ScrollEnd } from "./ScrollEnd";
import type { Flare, Visit } from "@/lib/types";

const CELL = 11;
const GAP = 3;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Mark = { kind: "flare" | "emergency" | "visit"; text: string };

/**
 * A week-by-day calendar of recorded days. The records only mark flares and vet visits, so a blank day is
 * "no entry", never "a good day".
 */
export function HistoryCalendar({ flares, visits }: { flares: Flare[]; visits: Visit[] }) {
  const marks = new Map<string, Mark>();
  for (const v of visits) {
    marks.set(v.date, { kind: v.visitType === "emergency" ? "emergency" : "visit", text: `${fmtDate(v.date)}: ${v.visitType === "emergency" ? "emergency visit" : "vet visit"}` });
  }
  for (const f of flares) {
    const start = toTime(f.startDate);
    const end = f.endDate ? toTime(f.endDate) : start;
    for (let t = start; t <= end; t += DAY) {
      const iso = new Date(t).toISOString().slice(0, 10);
      marks.set(iso, { kind: f.levelOfCare === "emergency" ? "emergency" : "flare", text: `${f.dateApproximate ? "About " : ""}${fmtDate(iso)}: flare${f.suspectedCause ? ` (${f.suspectedCause.toLowerCase()})` : ""}` });
    }
  }

  const all = [...visits.map((v) => v.date), ...flares.map((f) => f.startDate)].sort();
  const first = toTime(all[0]);
  const today = toTime(new Date().toISOString().slice(0, 10));
  // Start on the Monday on or before the first record.
  const startDow = (new Date(first).getUTCDay() + 6) % 7;
  const gridStart = first - startDow * DAY;
  const weeks = Math.ceil((today - gridStart) / DAY / 7) + 1;
  const width = weeks * (CELL + GAP);
  const height = 7 * (CELL + GAP) + 20;

  const monthLabels: { x: number; text: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const d = new Date(gridStart + w * 7 * DAY);
    if (d.getUTCMonth() !== lastMonth && d.getUTCDate() <= 7) {
      monthLabels.push({ x: w * (CELL + GAP), text: d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : MONTHS[d.getUTCMonth()] });
      lastMonth = d.getUTCMonth();
    }
  }

  const cells = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const t = gridStart + (w * 7 + d) * DAY;
      if (t < first - 0 || t > today) continue;
      const iso = new Date(t).toISOString().slice(0, 10);
      const m = marks.get(iso);
      const x = w * (CELL + GAP);
      const y = 20 + d * (CELL + GAP);
      if (!m) {
        cells.push(<rect key={iso} x={x} y={y} width={CELL} height={CELL} rx="2" fill="var(--chart-grid)" />);
      } else if (m.kind === "visit") {
        cells.push(<g key={iso}><title>{m.text}</title><rect x={x} y={y} width={CELL} height={CELL} rx="2" fill="var(--brand-soft)" stroke="var(--brand)" strokeWidth="1.5" /></g>);
      } else {
        const fill = m.kind === "emergency" ? "var(--red-fill)" : "var(--amber-fill)";
        cells.push(
          <g key={iso}>
            <title>{m.text}</title>
            <rect x={x} y={y} width={CELL} height={CELL} rx="2" fill={fill} />
            {m.kind === "emergency" && <path d={`M${x + 3},${y + 3} L${x + CELL - 3},${y + CELL - 3} M${x + CELL - 3},${y + 3} L${x + 3},${y + CELL - 3}`} stroke="var(--surface)" strokeWidth="1.5" />}
          </g>,
        );
      }
    }
  }

  return (
    <figure>
      <ScrollEnd label="Calendar of recorded flares and visits, scrolls sideways. Opens on the most recent months.">
        <svg width={width} height={height} role="img" aria-label={`Calendar from ${fmtDate(all[0])} to today. ${flares.length} flare episodes and ${visits.length} visits are marked. Days without a mark have no entry.`}>
          {monthLabels.map((m) => <text key={m.x + m.text} x={m.x} y={12} fontSize="10" fill="var(--muted)">{m.text}</text>)}
          {cells}
        </svg>
      </ScrollEnd>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-amber-fill" /> Flare (home or vet guidance)</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-red-fill" /> ✕ Emergency</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm border-2 border-brand bg-brand-soft" /> Vet visit</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: "var(--chart-grid)" }} /> No entry (not the same as a good day)</span>
      </figcaption>
    </figure>
  );
}
