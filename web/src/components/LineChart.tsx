import { DAY, fmtDate, fmtMonthYear, toTime } from "@/lib/format";
import type { LabPoint } from "@/lib/types";

export interface Annotation {
  date: string;
  label: string;
}

/** A row of bars on the shared time axis, for example one medication and its real breaks. */
export interface Lane {
  label: string;
  color: string;
  periods: { start: string; end: string | null; title: string }[];
}

/** A single event on the shared time axis. */
export interface Marker {
  date: string;
  label: string;
  kind: "flare" | "reaction";
  approximate?: boolean;
}

interface Props {
  points: LabPoint[];
  unit?: string;
  label: string;
  annotations?: Annotation[];
  scale?: "linear" | "log";
  height?: number;
  /** Line and point color. Defaults to the brand purple. */
  color?: string;
  /** Medication periods drawn as bars under the line, on the same time axis. */
  lanes?: Lane[];
  /** Flares and reactions drawn as markers under the bars. */
  markers?: Marker[];
  /** Keeps the chart this wide (px) and scrolls inside its own container on narrower screens. */
  minWidth?: number;
}

const W = 760;
const PAD = { l: 52, r: 16, t: 22, b: 34 };

/** A tidy axis step (1, 2, 2.5, 5 times a power of ten) so tick labels read as round numbers. */
function niceStep(range: number, ticks = 4): number {
  const raw = range / ticks;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** A line chart with the reference range shaded. Out-of-range points are diamonds, in-range points are circles. */
export function LineChart({ points, unit, label, annotations = [], scale = "linear", height = 300, color = "var(--brand)", lanes = [], markers = [], minWidth }: Props) {
  if (!points.length) return <p className="text-muted">No results on file.</p>;
  const H = height;
  const PL = lanes.length ? 104 : PAD.l; // room for the drug names beside the bars
  const LANE = 20;
  const lanesH = lanes.length * LANE + (markers.length ? 30 : 0);
  const TH = H + (lanesH ? lanesH + 12 : 0);
  const innerW = W - PL - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const withRef = points.find((p) => p.refLow != null && p.refHigh != null);
  const refLow = withRef?.refLow ?? null;
  const refHigh = withRef?.refHigh ?? null;

  const times = points.map((p) => toTime(p.date));
  const annoTimes = annotations.map((a) => toTime(a.date));
  const laneTimes = lanes.flatMap((l) => l.periods.flatMap((p) => [toTime(p.start), ...(p.end ? [toTime(p.end)] : [])]));
  const markTimes = markers.map((m) => toTime(m.date));
  const maxT = Math.max(...times, ...annoTimes, ...laneTimes, ...markTimes);
  const t0 = Math.min(...times, ...annoTimes, ...laneTimes, ...markTimes) - 20 * DAY;
  const t1 = maxT + 20 * DAY;
  const maxV = Math.max(...points.map((p) => p.value), refHigh ?? 0);
  const minV = Math.min(...points.map((p) => p.value), refLow ?? Infinity);

  const log = scale === "log" && minV > 0;
  const step = niceStep(maxV * 1.05);
  const yTop = log ? Math.pow(10, Math.ceil(Math.log10(maxV * 1.05))) : Math.ceil((maxV * 1.05) / step) * step;
  const yBot = log ? Math.pow(10, Math.floor(Math.log10(Math.max(minV * 0.8, 1)))) : 0;

  // Round coordinates: the server and the browser can differ in the last floating-point digits,
  // which would otherwise cause a hydration mismatch.
  const round = (n: number) => Math.round(n * 100) / 100;
  const x = (t: number) => round(PL + ((t - t0) / (t1 - t0)) * innerW);
  const y = (v: number) => {
    if (log) {
      const f = (Math.log10(Math.max(v, yBot)) - Math.log10(yBot)) / (Math.log10(yTop) - Math.log10(yBot));
      return round(PAD.t + (1 - f) * innerH);
    }
    return round(PAD.t + (1 - (v - yBot) / (yTop - yBot)) * innerH);
  };

  const ticks: number[] = [];
  if (log) {
    for (let v = yBot; v <= yTop; v *= 10) ticks.push(v);
  } else {
    for (let v = 0; v <= yTop + step / 2; v += step) ticks.push(+v.toFixed(6));
  }

  // Year markers on the x-axis.
  const years: { label: string; t: number }[] = [];
  for (let yr = new Date(t0).getUTCFullYear(); yr <= new Date(t1).getUTCFullYear(); yr++) {
    const t = Date.UTC(yr, 0, 1);
    if (t >= t0 && t <= t1) years.push({ label: String(yr), t });
  }

  const path = points.map((p, i) => `${i ? "L" : "M"}${x(toTime(p.date)).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const desc = `${label}: ${points.length} results from ${fmtMonthYear(first.date)} to ${fmtMonthYear(last.date)}. First ${first.value}${unit ? " " + unit : ""}, latest ${last.value}${unit ? " " + unit : ""}.`;

  return (
    <figure className="w-full">
      <div className={minWidth ? "overflow-x-auto" : undefined}>
      <svg viewBox={`0 0 ${W} ${TH}`} role="img" aria-label={desc} className="h-auto w-full" style={minWidth ? { minWidth } : undefined}>
        {/* grid and axis */}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PL} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={PL - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : +v.toFixed(1)}
            </text>
          </g>
        ))}
        {years.map((yr) => (
          <g key={yr.label}>
            <line x1={x(yr.t)} x2={x(yr.t)} y1={PAD.t} y2={lanesH ? TH - 4 : H - PAD.b} stroke="var(--chart-grid)" strokeWidth="1" strokeDasharray="2 4" />
            <text x={x(yr.t) + 4} y={H - PAD.b + 16} fontSize="11" fill="var(--muted)">{yr.label}</text>
          </g>
        ))}

        {/* reference range */}
        {refLow != null && refHigh != null && (
          <g>
            <rect x={PL} width={innerW} y={y(refHigh)} height={Math.max(2, y(refLow) - y(refHigh))} fill="var(--green-soft)" opacity="0.9" />
            <text x={PL + 6} y={y(refHigh) - 4} fontSize="11" fill="var(--green)">
              Reference range {refLow}–{refHigh}
            </text>
          </g>
        )}

        {/* annotations */}
        {annotations.map((a, i) => {
          const ax = x(toTime(a.date));
          const row = i % 3;
          return (
            <g key={a.date + a.label}>
              <line x1={ax} x2={ax} y1={PAD.t + 4 + row * 13} y2={H - PAD.b} stroke="var(--brand)" strokeWidth="1" strokeDasharray="3 3" opacity="0.65" />
              <text x={ax + 4} y={PAD.t + 12 + row * 13} fontSize="10.5" fill="var(--brand)">{a.label}</text>
            </g>
          );
        })}

        <path d={path} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => {
          const cx = x(toTime(p.date));
          const cy = y(p.value);
          const out = p.flag === "high" || p.flag === "low";
          const title = `${fmtDate(p.date)}: ${p.qualifier === "gt" ? ">" : p.qualifier === "lt" ? "<" : ""}${p.value}${unit ? " " + unit : ""}${out ? ` (${p.flag})` : ""}`;
          return (
            <g key={i}>
              <title>{title}</title>
              {out ? (
                <path d={`M${cx},${cy - 6} L${cx + 6},${cy} L${cx},${cy + 6} L${cx - 6},${cy} Z`} fill="var(--amber-fill)" stroke="var(--surface)" strokeWidth="1.5" />
              ) : (
                <circle cx={cx} cy={cy} r="4.5" fill={color} stroke="var(--surface)" strokeWidth="1.5" />
              )}
              {p.qualifier === "gt" && <text x={cx + 8} y={cy - 6} fontSize="12" fill="var(--amber)" fontWeight="600">&gt;</text>}
              {p.confidence === "conflicting" && <circle cx={cx} cy={cy} r="9" fill="none" stroke="var(--red)" strokeWidth="1.5" strokeDasharray="2 2" />}
            </g>
          );
        })}

        {/* medication periods: one bar per period, so a stop and a restart show as a real gap */}
        {lanes.map((ln, i) => {
          const ly = H + 8 + i * LANE;
          return (
            <g key={ln.label}>
              <text x={PL - 8} y={ly + 12} textAnchor="end" fontSize="11" fill="var(--ink-2)">{ln.label}</text>
              <line x1={PL} x2={W - PAD.r} y1={ly + 7} y2={ly + 7} stroke="var(--chart-grid)" strokeWidth="1" />
              {ln.periods.map((p) => {
                const a = x(toTime(p.start));
                const b = x(p.end ? toTime(p.end) : maxT);
                return (
                  <rect key={p.start} x={a} y={ly + 1} width={Math.max(4, round(b - a))} height="12" rx="3" fill={ln.color} stroke="var(--surface)" strokeWidth="1">
                    <title>{p.title}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}

        {/* flares and reactions */}
        {markers.length > 0 && (() => {
          const my = H + 8 + lanes.length * LANE + 16;
          return (
            <g>
              <text x={PL - 8} y={my + 4} textAnchor="end" fontSize="11" fill="var(--ink-2)">Flares</text>
              <line x1={PL} x2={W - PAD.r} y1={my} y2={my} stroke="var(--chart-grid)" strokeWidth="1" />
              {markers.map((m) => {
                const mx = x(toTime(m.date));
                const reaction = m.kind === "reaction";
                return (
                  <g key={m.date + m.label}>
                    <title>{m.label}</title>
                    {reaction ? (
                      <circle cx={mx} cy={my} r="6" fill={m.approximate ? "var(--surface)" : "var(--red-fill)"} stroke="var(--red-fill)" strokeWidth="2" />
                    ) : (
                      <path d={`M${mx},${my - 7} L${mx + 7},${my} L${mx},${my + 7} L${mx - 7},${my} Z`} fill={m.approximate ? "var(--surface)" : "var(--amber-fill)"} stroke="var(--amber-fill)" strokeWidth="2" />
                    )}
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* latest value label */}
        <text x={x(toTime(last.date)) - 8} y={y(last.value) - 12} textAnchor="end" fontSize="12" fontWeight="600" fill="var(--ink)">
          {last.value}{unit ? ` ${unit}` : ""}
        </text>
      </svg>
      </div>
      <figcaption className="mt-1 text-xs text-muted">
        Diamonds mark values outside the reference range. A dashed ring marks a value whose records disagree.
        {lanes.length > 0 && " Bars show when each medication was given, with its real breaks."}
        {markers.length > 0 && " Under them, an amber diamond is a flare and a red circle is a suspected medication reaction. A hollow marker means the date is approximate."}
        {log && " Log scale: each gridline is ten times the one below, so large swings and small ones both show."}
      </figcaption>
    </figure>
  );
}
