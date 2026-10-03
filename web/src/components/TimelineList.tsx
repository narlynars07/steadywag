"use client";

import { useState } from "react";
import { Chip, Confidence } from "./ui";
import { fmtApproxDate } from "@/lib/format";
import type { Confidence as C } from "@/lib/types";

type Kind = "visit" | "flare" | "imaging" | "medication";

export interface TimelineEvent {
  id: string;
  date: string;
  /** True when the records only give an approximate date, so it reads "about Jun 30, 2025". */
  approx?: boolean;
  kind: Kind;
  /** A merged entry (for example an emergency visit that is also a flare) shows under these filters too. */
  also?: Kind[];
  label: string;
  title: string;
  summary?: string;
  details?: { heading: string; text: string }[];
  confidence?: C;
  note?: string;
  tone: "neutral" | "brand" | "amber" | "red" | "green";
}

const KINDS: { key: TimelineEvent["kind"] | "all"; label: string }[] = [
  { key: "all", label: "Everything" }, { key: "visit", label: "Visits" }, { key: "flare", label: "Flares" },
  { key: "imaging", label: "Imaging" }, { key: "medication", label: "Medication changes" },
];

const DOT = { neutral: "bg-muted", brand: "bg-brand", amber: "bg-amber-fill", red: "bg-red-fill", green: "bg-green-fill" } as const;

export function TimelineList({ events }: { events: TimelineEvent[] }) {
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("all");
  const shown = events.filter((e) => kind === "all" || e.kind === kind || e.also?.includes(kind));
  const byYear = new Map<string, TimelineEvent[]>();
  for (const e of shown) byYear.set(e.date.slice(0, 4), [...(byYear.get(e.date.slice(0, 4)) ?? []), e]);

  return (
    <div>
      <div role="group" aria-label="Filter timeline" className="mb-5 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button key={k.key} onClick={() => setKind(k.key)} aria-pressed={kind === k.key}
            className={`rounded-full border px-3 py-1 text-sm ${kind === k.key ? "border-brand bg-brand text-on-brand" : "border-line bg-surface text-muted hover:bg-brand-soft"}`}>
            {k.label}
          </button>
        ))}
        <span className="ml-auto self-center text-sm text-muted">{shown.length} entries</span>
      </div>

      {[...byYear.entries()].map(([year, list]) => (
        <section key={year} className="mb-8">
          <h2 className="sticky top-24 z-10 mb-3 bg-paper/90 py-1 font-serif text-2xl font-semibold backdrop-blur">{year}</h2>
          <ol className="space-y-3 border-l-2 border-line pl-5">
            {list.map((e) => (
              <li key={e.id} className="relative rounded-xl border border-line bg-surface p-4">
                <span aria-hidden="true" className={`absolute -left-[30px] top-5 h-3.5 w-3.5 rounded-full border-2 border-paper ${DOT[e.tone]}`} />
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={e.tone}>{e.label}</Chip>
                  <time dateTime={e.date} className="text-sm text-muted">{fmtApproxDate(e.date, e.approx)}</time>
                </div>
                <h3 className="mt-1 font-semibold">{e.title}</h3>
                {e.summary && <p className="mt-1 text-ink/90">{e.summary}</p>}
                {e.details && e.details.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-brand">More detail</summary>
                    <dl className="mt-2 space-y-2 text-sm">
                      {e.details.map((d) => (
                        <div key={d.heading}><dt className="font-medium">{d.heading}</dt><dd className="text-muted">{d.text}</dd></div>
                      ))}
                    </dl>
                  </details>
                )}
                <Confidence value={e.confidence === "confirmed" ? undefined : e.confidence} note={e.note} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
