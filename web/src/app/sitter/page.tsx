import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { Chip } from "@/components/ui";
import { SOURCE_LABEL, vetTiming } from "@/lib/care";
import { getCareRoutine, getDietRules, getMedications } from "@/lib/data";
import { freqLabel } from "@/lib/format";

export const metadata = { title: "Sitter brief · Steadywag" };
export const revalidate = 60;

function Tag({ children }: { children: string }) {
  return <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand2">{children}</span>;
}

/** Everything someone covering for Theo needs, built straight from his records. No agent run, so it opens instantly and prints cleanly. */
export default async function SitterPage() {
  const [routine, meds, rules] = await Promise.all([getCareRoutine(), getMedications(), getDietRules()]);
  const notGiven = meds.find((m) => m.status === "listed-not-given");
  const medOf = (id: string) => meds.find((m) => m._id === id);
  const steps = routine.filter((r) => r.kind !== "note");
  const treat = rules.find((r) => r._id === "dietRule-treat-allowance");
  const avoid = rules.filter((r) => r.kind === "avoid");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-brand2">For whoever is covering</p>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink">Sitter brief for Theo</h1>
        <p className="mt-1 text-[15px] leading-relaxed text-ink2">Built from his records and his family&apos;s routine.</p>
      </div>

      {notGiven && (
        <div role="note" className="print-card rounded-2xl border-2 border-amber-fill bg-amber-soft px-4 py-3 text-[15px] leading-snug text-amber">
          <strong className="font-semibold">The paperwork would get this wrong: {notGiven.name.toLowerCase()} is on his written list, but don&apos;t give it.</strong>{" "}
          A caregiver was told verbally not to give it, and nothing written says so.
        </div>
      )}

      <section className="print-card flex flex-col gap-3" aria-labelledby="day">
        <h2 id="day" className="text-lg font-extrabold tracking-tight text-ink">His day, in order</h2>
        {steps.map((r) => {
          const items = (r.items ?? []).flatMap((i) => { const m = medOf(i.medicationId); return m ? [{ i, m }] : []; });
          return (
            <div key={r._id} className="rounded-2xl border border-line bg-surface px-3.5 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h3 className="text-base font-bold text-ink">{r.title}</h3>
                <span className="text-sm text-muted">{r.timeLabel} · <Tag>{SOURCE_LABEL.routine}</Tag></span>
              </div>
              {r.detail && r.kind !== "medication" && <p className="mt-1 text-sm leading-snug text-ink2">{r.detail}</p>}
              {items.length > 0 && (
                <ul className="mt-2 divide-y divide-line">
                  {items.map(({ i, m }) => (
                    <li key={m._id} className="py-2">
                      <p className="text-[15px] font-semibold text-ink">{m.name} <span className="font-normal text-ink2">{m.dose}</span></p>
                      <p className="text-sm text-ink2">{freqLabel(m)}{m.days?.length ? " only" : ""}</p>
                      {m.writtenInstruction && <p className="mt-0.5 text-sm text-ink2">{m.writtenInstruction} <Tag>{SOURCE_LABEL.vet}</Tag></p>}
                      {vetTiming(m) && <p className="text-xs text-muted">{vetTiming(m)} <Tag>{SOURCE_LABEL.vet}</Tag></p>}
                      {i.note && <p className="text-xs text-muted">{i.note}</p>}
                      {m.source?.confidence === "conflicting" && <div className="mt-1"><Chip tone="red" wrap>Records disagree. Ask his family which applies.</Chip></div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <section className="print-card rounded-2xl border border-line bg-surface px-3.5 py-3">
        <h2 className="text-base font-bold text-ink">Treats</h2>
        <p className="mt-1 text-sm leading-snug text-ink2">{treat?.rule ?? "Treats are limited to 42 kcal a day and must be low in copper and sodium."} <Tag>{SOURCE_LABEL.vet}</Tag></p>
        <Link href="/food" className="no-print mt-1 flex min-h-11 items-center text-sm font-semibold text-brand2">His approved treats →</Link>
      </section>

      <section className="print-card rounded-2xl border border-line bg-surface px-3.5 py-3" aria-labelledby="avoid">
        <h2 id="avoid" className="text-base font-bold text-ink">Never give</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-snug text-ink2">
          {avoid.map((r) => <li key={r._id}><strong className="font-semibold text-ink">{r.title}.</strong> {r.rule}</li>)}
        </ul>
      </section>

      <section className="print-card rounded-2xl border border-red/30 bg-red-soft px-3.5 py-3 text-sm leading-snug text-red">
        <h2 className="text-base font-bold">Call his vet or an emergency vet now if he…</h2>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>stops eating for a day or more</li>
          <li>vomits more than once</li>
          <li>has blood in his stool or vomit, or black, tar-like stool</li>
          <li>has yellow gums or eyes</li>
          <li>collapses, has a seizure, or has trouble breathing</li>
          <li>has a swollen, painful belly, or seems very unwell</li>
        </ul>
      </section>

      <div className="print-card rounded-2xl border-2 border-dashed border-line bg-surface px-4 py-3 text-[15px] font-semibold text-ink">
        Add your vet&apos;s and emergency clinic&apos;s phone numbers before you share this.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PrintButton />
        <p className="no-print text-sm text-muted">Questions about something here? Tap the chat button.</p>
      </div>
    </div>
  );
}
