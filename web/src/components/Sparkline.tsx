import { DAY, fmtMonthYear, toTime } from "@/lib/format";

interface Point {
  date: string;
  value: number;
}

const W = 400;
const H = 90;
const PAD = 8;

const round = (n: number) => Math.round(n * 100) / 100;

/** A small area chart with a soft fill and a dot on the latest value. Uses a log scale when values span a huge range. */
export function Sparkline({ points, color, label }: { points: Point[]; color: string; label: string }) {
  if (points.length < 2) return null;
  const times = points.map((p) => toTime(p.date));
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const vals = points.map((p) => p.value);
  const hi = Math.max(...vals);
  const lo = Math.min(...vals);
  const log = lo > 0 && hi / lo > 30;
  const f = (v: number) => (log ? Math.log10(v) : v);
  const fl = f(lo);
  const fh = f(hi);
  const span = fh - fl || 1;

  const x = (t: number) => round(PAD + ((t - t0) / Math.max(t1 - t0, DAY)) * (W - PAD * 2));
  const y = (v: number) => round(H - PAD - ((f(v) - fl) / span) * (H - PAD * 2));

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(toTime(p.date))},${y(p.value)}`).join(" ");
  const area = `${line} L${x(t1)},${H - PAD} L${x(t0)},${H - PAD} Z`;
  const last = points[points.length - 1];
  const gid = `g-${label.replace(/\W+/g, "")}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-[72px] w-full" aria-label={`${label}: ${points.length} results from ${fmtMonthYear(points[0].date)} to ${fmtMonthYear(last.date)}`}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(toTime(last.date))} cy={y(last.value)} r="4.5" fill={color} stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}
