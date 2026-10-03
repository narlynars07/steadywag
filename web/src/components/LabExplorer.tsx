"use client";

import { useMemo, useRef, useState } from "react";
import { KEY_TESTS } from "./LabSummary";
import { LineChart } from "./LineChart";
import { Card, Chip, Confidence } from "./ui";
import { fmtDate, LAB_PLAIN } from "@/lib/format";
import type { LabPoint, LabTestSummary } from "@/lib/types";

/** What the Flag column says. A result the records call high, with no range printed, says so instead of "No flag". */
function FlagChip({ p }: { p: LabPoint }) {
  const noRange = p.refLow == null && p.refHigh == null;
  if (p.flag === "high" || (!p.flag && p.qualifier === "gt")) return <Chip tone="amber">{noRange ? "Above range (no range reported)" : "High"}</Chip>;
  if (p.flag === "low") return <Chip tone="amber">{noRange ? "Below range (no range reported)" : "Low"}</Chip>;
  if (p.flag === "normal") return <Chip tone="green">In range</Chip>;
  return <Chip>No flag reported</Chip>;
}

const CATEGORY_LABEL: Record<string, string> = {
  liver: "Liver", pancreas: "Pancreas", lipids: "Fats", kidney: "Kidney", "blood-count": "Blood count", chemistry: "Chemistry", other: "Other",
};
const ORDER = ["liver", "pancreas", "lipids", "blood-count", "kidney", "chemistry", "other"];

export function LabExplorer({ tests, results }: { tests: LabTestSummary[]; results: (LabPoint & { code: string })[] }) {
  const [code, setCode] = useState("ALT");
  // null means "automatic": use a log scale when values span a huge range, so recovery stays visible.
  const [logPref, setLogPref] = useState<boolean | null>(null);

  const [showMore, setShowMore] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const keyTests = KEY_TESTS.map((c) => tests.find((t) => t.code === c)).filter((t): t is LabTestSummary => !!t);

  const grouped = useMemo(() => {
    const g: Record<string, LabTestSummary[]> = {};
    for (const t of tests) if (!KEY_TESTS.includes(t.code)) (g[t.category] ??= []).push(t);
    return ORDER.filter((c) => g[c]).map((c) => ({ category: c, tests: g[c] }));
  }, [tests]);

  const test = tests.find((t) => t.code === code) ?? tests[0];
  const series = useMemo(() => results.filter((r) => r.code === test.code), [results, test.code]);
  const flagged = series.filter((p) => p.flag === "high" || p.flag === "low").length;
  const vals = series.map((p) => p.value).filter((v) => v > 0);
  const autoLog = vals.length > 1 && Math.max(...vals) / Math.min(...vals) > 30;
  const log = logPref ?? autoLog;

  // Keep the list open while the chosen test is one of the "more" tests. On a phone, jump to the chart after choosing.
  const more = showMore || !KEY_TESTS.includes(test.code);
  const pick = (t: LabTestSummary) => (
    <li key={t.code}>
      <button
        onClick={() => {
          setCode(t.code);
          setLogPref(null);
          if (typeof window !== "undefined" && window.innerWidth < 768) setTimeout(() => chartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
        }}
        aria-pressed={t.code === test.code}
        className={`w-full rounded-lg px-3 py-1.5 text-left text-sm ${t.code === test.code ? "bg-brand text-on-brand" : "bg-surface text-ink hover:bg-brand-soft md:bg-transparent"}`}
      >
        <span className="font-medium">{t.code}</span>
        <span className={`block text-xs ${t.code === test.code ? "text-on-brand/85" : "text-muted"}`}>{LAB_PLAIN[t.code] ?? t.name}</span>
      </button>
    </li>
  );

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Lab tests" className="space-y-4 md:sticky md:top-20 md:self-start">
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Key tests</h3>
          <ul className="flex flex-wrap gap-1.5 md:block md:space-y-0.5">{keyTests.map(pick)}</ul>
        </div>
        <div>
          <button type="button" onClick={() => setShowMore((v) => !v)} aria-expanded={more} className="flex min-h-11 items-center text-sm font-semibold text-brand2">
            {more ? "Hide the other tests" : `More tests (${tests.length - keyTests.length})`}
          </button>
          {more && (
            <div className="mt-2 space-y-4">
              {grouped.map((g) => (
                <div key={g.category}>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{CATEGORY_LABEL[g.category]}</h3>
                  <ul className="flex flex-wrap gap-1.5 md:block md:space-y-0.5">{g.tests.map(pick)}</ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="space-y-6">
        <div ref={chartRef} className="scroll-mt-20" />
        <Card
          title={`${test.name} (${test.code})`}
          aside={
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={log} onChange={(e) => setLogPref(e.target.checked)} />
              Log scale
            </label>
          }
        >
          <p className="mb-3 text-muted">
            <strong className="font-semibold text-ink">{test.code}: {LAB_PLAIN[test.code] ?? test.name}.</strong>
            {test.whatItMeasures ? ` ${test.whatItMeasures}` : ""}
          </p>
          <LineChart points={series} unit={test.unit} label={test.name} scale={log ? "log" : "linear"} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone="brand">{series.length} results</Chip>
            {flagged > 0 ? <Chip tone="amber">{flagged} outside the range</Chip> : <Chip tone="green">All in range</Chip>}
          </div>
        </Card>

        <Card title="Every value">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <caption className="sr-only">All {test.code} results, newest first</caption>
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr><th className="py-1 pr-3 font-medium">Date</th><th className="py-1 pr-3 font-medium">Result</th><th className="py-1 pr-3 font-medium">Reference</th><th className="py-1 font-medium">Flag</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...series].reverse().map((p, i) => (
                  <tr key={i} className="align-top">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(p.date)}</td>
                    <td className="py-1.5 pr-3 font-medium whitespace-nowrap">
                      {p.qualifier === "gt" ? ">" : p.qualifier === "lt" ? "<" : ""}{p.value} <span className="font-normal text-muted">{p.unit ?? test.unit}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-muted whitespace-nowrap">{p.refLow != null && p.refHigh != null ? `${p.refLow}–${p.refHigh}` : "not given"}</td>
                    <td className="py-1.5">
                      <FlagChip p={p} />
                      {/* Single-source and conflicting results print their note once, inside the flagged box. Confirmed ones print it plainly. */}
                      <Confidence value={p.confidence} note={p.note} />
                      {(!p.confidence || p.confidence === "confirmed") && p.note && <div className="mt-1 text-xs text-muted">{p.note}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
