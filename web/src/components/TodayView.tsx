"use client";

import Link from "next/link";
import { Chip } from "./ui";
import { SOURCE_LABEL, dueOn, vetTiming } from "@/lib/care";
import { doseLine } from "@/lib/format";
import { useLocalDay } from "@/lib/useLocalDay";
import type { CareRoutine, Medication } from "@/lib/types";

const KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface TodayData {
  routine: CareRoutine[];
  meds: Medication[];
  notGiven?: string;
  treatRule?: string;
  recipe?: string;
  conflict?: { name: string; note: string };
}

function Source({ children }: { children: string }) {
  return <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand2">{children}</span>;
}

export function TodayView({ data }: { data: TodayData }) {
  const day = useLocalDay();
  const d = day ? new Date(`${day}T12:00:00`) : null;
  const key = d ? KEYS[d.getDay()] : null;
  const medOf = (id: string) => data.meds.find((m) => m._id === id);

  // The day as a timeline. A medication step is shown only if something in it is due today.
  const steps = data.routine.filter((r) => r.kind !== "note").map((r) => {
    const items = (r.items ?? []).map((i) => ({ item: i, med: medOf(i.medicationId) })).filter((x) => x.med);
    const due = key ? items.filter((x) => dueOn(x.med!, key)) : items;
    return { r, due, skipped: r.kind === "medication" && key !== null && due.length === 0 };
  });
  const shown = steps.filter((s) => !s.skipped);

  const notDue = key
    ? data.meds.filter((m) => m.status === "active" && !dueOn(m, key))
    : [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink">Today{d ? ` · ${NAMES[d.getDay()]}` : ""}</h1>
        <p className="mt-1 text-[15px] leading-relaxed text-ink2">From his vet&apos;s written instructions, with times from his family&apos;s routine where the instructions don&apos;t give one.</p>
      </div>

      {data.notGiven && (
        <div role="note" className="rounded-2xl border border-amber-fill/50 bg-amber-soft px-3.5 py-3 text-sm leading-snug text-amber">
          <strong className="font-semibold">{data.notGiven} is on his written list, but don&apos;t give it.</strong> A verbal instruction never made it onto the paperwork.
        </div>
      )}

      <ol className="flex flex-col gap-3 border-l-2 border-line pl-4">
        {shown.map(({ r, due }) => (
          <li key={r._id} className="relative">
            <span aria-hidden="true" className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-paper bg-brand" />
            <div className="rounded-2xl border border-line bg-surface px-3.5 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h2 className="text-base font-bold text-ink">{r.title}</h2>
                <span className="text-sm text-muted">{r.timeLabel}{r.timeLabel && <> · <Source>{SOURCE_LABEL.routine}</Source></>}</span>
              </div>
              {r.detail && <p className="mt-1 text-sm leading-snug text-ink2">{r.detail}</p>}
              {due.length > 0 && (
                <ul className="mt-2 divide-y divide-line">
                  {due.map(({ item, med }) => {
                    const m = med!;
                    const conflict = m.source?.confidence === "conflicting";
                    return (
                      <li key={m._id} className="py-2">
                        <p className="text-[15px] font-semibold text-ink">{m.name} <span className="font-normal text-ink2">{m.dose}</span></p>
                        <p className="text-sm text-ink2">{doseLine(m)}</p>
                        {m.writtenInstruction && <p className="mt-0.5 text-sm text-ink2">{m.writtenInstruction} <Source>{SOURCE_LABEL.vet}</Source></p>}
                        {vetTiming(m) && <p className="text-xs text-muted">{vetTiming(m)} <Source>{SOURCE_LABEL.vet}</Source></p>}
                        {item.note && <p className="text-xs text-muted">{item.note}</p>}
                        {conflict && <div className="mt-1"><Chip tone="red" wrap>Records disagree, needs confirmation</Chip></div>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>

      {key && notDue.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface px-3.5 py-3">
          <h2 className="text-base font-bold text-ink">Not due today</h2>
          <ul className="mt-1 divide-y divide-line">
            {notDue.map((m) => (
              <li key={m._id} className="py-2 text-sm text-ink2">
                <span className="font-semibold text-ink">{m.name}</span> · {doseLine(m)}
                {m.source?.confidence === "conflicting" && <div className="mt-1"><Chip tone="red" wrap>Records disagree, needs confirmation</Chip></div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface px-3.5 py-3">
        <h2 className="text-base font-bold text-ink">Food</h2>
        {data.recipe && <p className="mt-1 line-clamp-4 text-sm leading-snug text-ink2">{data.recipe}</p>}
        {data.treatRule && <p className="mt-2 text-sm leading-snug text-ink2"><strong className="font-semibold text-ink">Treats:</strong> {data.treatRule}</p>}
        {data.conflict && (
          <div className="mt-2 rounded-xl bg-red-soft px-3 py-2 text-sm leading-snug text-red">
            <strong className="font-semibold">{data.conflict.name}:</strong> {data.conflict.note}
          </div>
        )}
        <Link href="/food" className="mt-2 flex min-h-11 items-center text-sm font-semibold text-brand2">Open Food →</Link>
      </section>

      <section className="rounded-2xl border border-red/30 bg-red-soft px-3.5 py-3 text-sm leading-snug text-red">
        <h2 className="text-base font-bold">Call the vet if he…</h2>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>stops eating for a day or more</li>
          <li>vomits more than once</li>
          <li>has blood in his stool or vomit, or black stool</li>
          <li>has yellow gums or eyes</li>
          <li>collapses, has a seizure, or has trouble breathing</li>
          <li>has a swollen, painful belly, or seems very unwell</li>
        </ul>
        <p className="mt-1">Contact his vet or an emergency vet.</p>
      </section>

      <section className="rounded-2xl border border-line bg-surface px-3.5 py-3">
        <h2 className="text-base font-bold text-ink">Activity</h2>
        <p className="mt-1 text-sm text-ink2">His records don&apos;t include an activity plan.</p>
        <p className="text-sm font-semibold text-brand2">Ask at his next visit.</p>
      </section>
    </div>
  );
}
