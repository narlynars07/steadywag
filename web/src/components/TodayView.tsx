"use client";

import Link from "next/link";
import { Chip } from "./ui";
import { SOURCE_LABEL, dueOn, vetTiming } from "@/lib/care";
import { doseLine, freqLabel } from "@/lib/format";
import { useLocalDay } from "@/lib/useLocalDay";
import { useNow } from "@/lib/useNow";
import type { CareRoutine, Medication, RoutineItem } from "@/lib/types";

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

type Due = { item: RoutineItem; med: Medication };
type Step = { r: CareRoutine; due: Due[]; minutes: number | null };

function Source({ children }: { children: string }) {
  return <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand2">{children}</span>;
}

/** The time a routine step happens, to order the day and tell what is behind us. Bedtime has no clock time, so it sits late in the evening. */
function stepMinutes(r: CareRoutine): number | null {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(r.timeLabel ?? "");
  if (m) return (Number(m[1]) % 12) * 60 + Number(m[2]) + (m[3].toUpperCase() === "PM" ? 12 * 60 : 0);
  if (/bed/i.test(`${r.timeLabel ?? ""} ${r.title}`)) return 21 * 60 + 30;
  return null;
}

function StepCard({ step, tone = "plain" }: { step: Step; tone?: "plain" | "now" }) {
  const { r, due } = step;
  return (
    <div className={`rounded-2xl border bg-surface px-3.5 py-3 ${tone === "now" ? "border-brand shadow-[0_0_0_1px_var(--brand)]" : "border-line"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-base font-bold text-ink">{r.title}</h3>
        <span className="text-sm text-muted">{r.timeLabel}{r.timeLabel && <> · <Source>{SOURCE_LABEL.routine}</Source></>}</span>
      </div>
      {r.detail && r.kind !== "medication" && <p className="mt-1 text-sm leading-snug text-ink2">{r.detail}</p>}
      {due.length > 0 && (
        <ul className="mt-2 divide-y divide-line">
          {due.map(({ item, med }) => {
            const conflict = med.source?.confidence === "conflicting";
            return (
              <li key={med._id}>
                <details className="group">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-1.5">
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold text-ink">{med.name} <span className="font-normal text-ink2">{med.dose}</span></span>
                      <span className="block text-xs text-muted">{freqLabel(med)}</span>
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-lg text-brand2 group-open:hidden">+</span>
                    <span aria-hidden="true" className="hidden shrink-0 text-lg text-brand2 group-open:inline">−</span>
                  </summary>
                  <div className="space-y-1 pb-2 text-sm text-ink2">
                    {med.writtenInstruction && <p>{med.writtenInstruction} <Source>{SOURCE_LABEL.vet}</Source></p>}
                    {vetTiming(med) && <p className="text-xs text-muted">{vetTiming(med)} <Source>{SOURCE_LABEL.vet}</Source></p>}
                    {item.note && <p className="text-xs text-muted">{item.note}</p>}
                  </div>
                </details>
                {conflict && <div className="pb-2"><Chip tone="red" wrap>Records disagree, needs confirmation</Chip></div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TodayView({ data }: { data: TodayData }) {
  const day = useLocalDay();
  const now = useNow();
  const d = day ? new Date(`${day}T12:00:00`) : null;
  const key = d ? KEYS[d.getDay()] : null;
  const medOf = (id: string) => data.meds.find((m) => m._id === id);

  // The day, in order. A medication step is shown only if something in it is due today.
  const steps: Step[] = data.routine
    .filter((r) => r.kind !== "note")
    .map((r) => {
      const items = (r.items ?? []).flatMap((i) => { const med = medOf(i.medicationId); return med ? [{ item: i, med }] : []; });
      const due = key ? items.filter((x) => dueOn(x.med, key)) : items;
      return { r, due, minutes: stepMinutes(r), skip: r.kind === "medication" && key !== null && due.length === 0 };
    })
    .filter((s) => !("skip" in s && s.skip))
    .map(({ r, due, minutes }) => ({ r, due, minutes }));

  // What is behind us (more than 90 minutes ago), what is next, and what is later. Without the clock, show the whole day in order.
  const nowMin = now?.minutes ?? null;
  const isPast = (s: Step) => nowMin !== null && s.minutes !== null && s.minutes + 90 < nowMin;
  const past = nowMin === null ? [] : steps.filter(isPast);
  const upcoming = nowMin === null ? steps : steps.filter((s) => !isPast(s));
  const current = nowMin === null ? null : upcoming[0] ?? null;
  const later = nowMin === null ? upcoming : upcoming.slice(1);
  const currentIsDue = current && current.minutes !== null && nowMin !== null && current.minutes <= nowMin + 15;

  const notDue = key ? data.meds.filter((m) => m.status === "active" && !dueOn(m, key)) : [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink">Today{d ? ` · ${NAMES[d.getDay()]}` : ""}</h1>
        <p className="mt-1 text-[15px] leading-relaxed text-ink2">
          {now ? `It's ${now.label}. ` : ""}From his vet&apos;s written instructions, with times from his family&apos;s routine where the instructions don&apos;t give one.
        </p>
      </div>

      {data.notGiven && (
        <div role="note" className="rounded-2xl border border-amber-fill/50 bg-amber-soft px-3.5 py-3 text-sm leading-snug text-amber">
          <strong className="font-semibold">{data.notGiven} is on his written list, but don&apos;t give it.</strong> A verbal instruction never made it onto the paperwork.
        </div>
      )}

      {nowMin !== null && !current && (
        <p className="rounded-2xl border border-line bg-surface px-3.5 py-3 text-[15px] text-ink2">That&apos;s everything on his routine for today. Tomorrow starts with breakfast.</p>
      )}

      {current && (
        <section aria-label="Right now" className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-brand2">{currentIsDue ? "Due now" : "Next up"}</p>
          <StepCard step={current} tone="now" />
        </section>
      )}

      {later.length > 0 && (
        <section aria-label={nowMin === null ? "His day" : "Later today"} className="flex flex-col gap-2">
          <h2 className="text-base font-bold text-ink">{nowMin === null ? "His day" : "Later today"}</h2>
          {later.map((s) => <StepCard key={s.r._id} step={s} />)}
        </section>
      )}

      {past.length > 0 && (
        <details className="rounded-2xl border border-line bg-surface">
          <summary className="flex min-h-12 cursor-pointer items-center px-3.5 text-[15px] font-semibold text-brand2">Earlier today ({past.length})</summary>
          <div className="flex flex-col gap-2 px-3 pb-3">{past.map((s) => <StepCard key={s.r._id} step={s} />)}</div>
        </details>
      )}

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
