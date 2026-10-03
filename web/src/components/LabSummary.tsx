import { Chip } from "./ui";
import { fmtDate, LAB_PLAIN } from "@/lib/format";
import type { LabPoint, LabTestSummary } from "@/lib/types";

export const KEY_TESTS = ["ALT", "ALKP", "TRIG", "CPL"];

function status(p: LabPoint) {
  const noRange = p.refLow == null && p.refHigh == null;
  if (p.flag === "high" || (!p.flag && p.qualifier === "gt")) return { tone: "amber" as const, label: noRange ? "Above range" : "High" };
  if (p.flag === "low") return { tone: "amber" as const, label: "Low" };
  if (p.flag === "normal") return { tone: "green" as const, label: "In range" };
  return { tone: "neutral" as const, label: "No range reported" };
}

const n = (v: number) => v.toLocaleString("en-US");
/** A value as the records state it: a result reported as "above 1,000" keeps its sign. */
const shown = (p: { value: number; qualifier?: "exact" | "gt" | "lt" }) => `${p.qualifier === "gt" ? ">" : p.qualifier === "lt" ? "<" : ""}${n(p.value)}`;

/** The top of the Labs page: where he is now, then the story year by year. Everything is computed from the records. */
export function LabSummary({ tests, results, missingNote }: { tests: LabTestSummary[]; results: (LabPoint & { code: string })[]; missingNote?: string }) {
  const key = KEY_TESTS.map((c) => tests.find((t) => t.code === c)).filter((t): t is LabTestSummary => !!t?.latest);

  const years = [...new Set(results.map((r) => r.date.slice(0, 4)))].sort().reverse().map((y) => {
    const inYear = results.filter((r) => r.date.startsWith(y));
    const alt = inYear.filter((r) => r.code === "ALT");
    return {
      year: y,
      dates: new Set(inYear.map((r) => r.date)).size,
      count: inYear.length,
      alt: alt.length ? { first: alt[0], last: alt.at(-1)!, max: Math.max(...alt.map((a) => a.value)) } : null,
    };
  });

  return (
    <div className="mb-6 space-y-5">
      <section aria-labelledby="now-heading">
        <h2 id="now-heading" className="text-xl font-extrabold tracking-tight text-ink">Where he is now</h2>
        <p className="mt-1 text-sm text-muted">His most recent result for the four tests his team watches most.</p>
        <ul className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {key.map((t) => {
            const p = t.latest!;
            const s = status(p);
            return (
              <li key={t.code} className="rounded-2xl border border-line bg-surface p-3.5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">{t.code}</p>
                <p className="text-xs text-muted">{LAB_PLAIN[t.code] ?? t.name}</p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
                  {p.qualifier === "gt" ? ">" : p.qualifier === "lt" ? "<" : ""}{n(p.value)} <span className="text-sm font-medium text-muted">{p.unit ?? t.unit}</span>
                </p>
                <p className="text-xs text-muted">{fmtDate(p.date)}</p>
                <div className="mt-1.5"><Chip tone={s.tone} wrap>{s.label}</Chip></div>
              </li>
            );
          })}
        </ul>
        {missingNote && <p role="note" className="mt-2 rounded-xl bg-amber-soft px-3.5 py-2.5 text-sm text-amber">{missingNote}</p>}
      </section>

      <section aria-labelledby="years-heading">
        <h2 id="years-heading" className="text-xl font-extrabold tracking-tight text-ink">Year by year</h2>
        <p className="mt-1 text-sm text-muted">The liver enzyme ALT in each year, with how many results are on file.</p>
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
          {years.map((y) => (
            <li key={y.year} className="flex items-start gap-3 px-3.5 py-3">
              <span className="w-12 shrink-0 text-lg font-extrabold tracking-tight text-brand2">{y.year}</span>
              <div className="min-w-0 text-sm text-ink2">
                {y.alt ? (
                  <p>
                    <span className="font-semibold text-ink">ALT {shown(y.alt.first)}{y.alt.first.date !== y.alt.last.date ? ` → ${shown(y.alt.last)}` : ""}</span>
                    {y.alt.max > Math.max(y.alt.first.value, y.alt.last.value) && <> (highest {n(y.alt.max)})</>}
                  </p>
                ) : (
                  <p className="text-muted">No ALT result this year</p>
                )}
                <p className="text-xs text-muted">{y.count} results across {y.dates} lab {y.dates === 1 ? "date" : "dates"}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
