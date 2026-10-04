"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { checkInsSince, describe, parse, snapshot, subscribe, summarize } from "@/lib/checkins";
import { fmtDate } from "@/lib/format";

/** The family's own check-ins since his last visit, read from this browser only. They are family-entered observations, not vet records. */
export function CheckInsSince({ sinceIso }: { sinceIso: string | null }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const list = checkInsSince(parse(raw), sinceIso, 30);

  return (
    <section className="no-print-hide print-card rounded-[22px] border border-line bg-surface p-5 shadow-[var(--shadow)]" aria-labelledby="ci-since">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ci-since" className="text-xl font-bold text-ink">Your check-ins since his last visit</h2>
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand2">Your check-ins</span>
      </div>
      {list.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No check-ins since {sinceIso ? fmtDate(sinceIso) : "his last visit"} on this device. A 30-second daily log gives his vet something concrete to look at.{" "}
          <Link href="/check-in" className="font-semibold text-brand2 underline-offset-4 hover:underline">Start today&apos;s check-in</Link>
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">Family-entered observations, not vet records. {list.length} {list.length === 1 ? "day" : "days"} logged.</p>
          {summarize(list).length > 0 && (
            <div className="mt-3 rounded-xl bg-paper px-3.5 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">What his vet usually asks</p>
              <ul className="mt-1 space-y-0.5 text-sm text-ink">{summarize(list).map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          )}
          <ul className="mt-2 divide-y divide-line">
            {list.map((e) => (
              <li key={e.date} className="py-2 text-sm">
                <span className="font-semibold text-ink">{fmtDate(e.date)}</span>
                <span className="text-ink2"> · {describe(e) || "no answers"}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
