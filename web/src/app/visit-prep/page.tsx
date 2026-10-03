import { CheckInsSince } from "@/components/CheckInsSince";
import { CopySummary } from "@/components/CopySummary";
import { Card, Chip, PageHead } from "@/components/ui";
import { getDog, getFlares, getGaps, getLabSeries, getMedications, getQuestions, getVisits, getWeights } from "@/lib/data";
import { doseLine, fmtApproxDate, fmtDate } from "@/lib/format";
import type { Medication } from "@/lib/types";

export const metadata = { title: "Visit prep · Steadywag" };
export const revalidate = 60;

const KIND_LABEL: Record<string, string> = {
  "missing-document": "Document not on file", "missing-result": "Result never recorded",
  "verbal-instruction": "Spoken, never written down", conflict: "Records disagree",
};

/** When a medication was first started, and whether it was ever stopped and restarted (a gap of more than a day between periods). */
function history(all: Medication[], name: string) {
  const periods = all
    .filter((m) => m.name === name && m.startDate)
    .map((m) => ({ start: m.startDate!, end: m.endDate }))
    .sort((a, b) => a.start.localeCompare(b.start));
  let breaks = false;
  for (let i = 1; i < periods.length; i++) {
    const prevEnd = periods[i - 1].end;
    if (prevEnd && (Date.parse(periods[i].start) - Date.parse(prevEnd)) / 86_400_000 > 1) breaks = true;
  }
  return { since: periods[0]?.start, breaks };
}

/** "2 years 9 months" from a start date to today. */
function span(since: string): string {
  const s = new Date(`${since}T12:00:00`);
  const n = new Date();
  let months = (n.getFullYear() - s.getFullYear()) * 12 + n.getMonth() - s.getMonth();
  if (n.getDate() < s.getDate()) months--;
  if (months < 1) return "under a month";
  const y = Math.floor(months / 12);
  const r = months % 12;
  const part = (v: number, unit: string) => `${v} ${unit}${v === 1 ? "" : "s"}`;
  return [y ? part(y, "year") : "", r ? part(r, "month") : ""].filter(Boolean).join(" ");
}

export default async function VisitPrep() {
  const [dog, meds, visits, weights, questions, gaps, alt, trig, flares] = await Promise.all([
    getDog(), getMedications(), getVisits(), getWeights(), getQuestions(), getGaps(), getLabSeries("ALT"), getLabSeries("TRIG"), getFlares(),
  ]);
  const last = visits.find((v) => v.visitType === "specialist-recheck")!;
  const active = meds.filter((m) => m.status === "active");
  const notGiven = meds.filter((m) => m.status === "listed-not-given");
  const w = weights.at(-1)!;
  const lastALT = alt.at(-1)!;
  const lastTrig = trig.at(-1);

  // Long-term medications (active ones), with how long he has been on each, plus the pancreatitis flares on record.
  const longTerm = [...new Set(active.map((m) => m.name))].map((name) => {
    const h = history(meds, name);
    return { name, purpose: active.find((m) => m.name === name)?.purpose, ...h };
  }).filter((m) => m.since).sort((a, b) => a.since!.localeCompare(b.since!));
  const pancreatitis = flares.filter((f) => /pancreatitis/i.test(f.suspectedCause ?? "")).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const sinceLine = (m: (typeof longTerm)[number]) => `${m.name}: since ${fmtDate(m.since!)} (${span(m.since!)}${m.breaks ? ", with breaks" : ""})`;

  const text = [
    `${dog.name}: summary for his next specialist visit`,
    `Last specialist visit ${fmtDate(last.date)}; plan was a recheck in about ${last.nextRecheck?.replace(/^about /i, "")}, fasted.`,
    "",
    "Current medications (per the written list):",
    ...active.map((m) => `- ${m.name}: ${doseLine(m)}`),
    ...notGiven.map((m) => `- ${m.name} (${doseLine(m)}): still on the written list but NOT being given (verbal instruction). Please confirm and correct the list.`),
    "",
    "How long he has been on each current medication (dates from his records):",
    ...longTerm.map((m) => `- ${sinceLine(m)}`),
    `Pancreatitis flares on record: ${pancreatitis.length ? pancreatitis.map((f) => fmtApproxDate(f.startDate, f.dateApproximate)).join("; ") : "none"}.`,
    "",
    `Latest numbers: ALT ${lastALT.value} U/L (${fmtDate(lastALT.date)}); ${lastTrig ? `triglycerides ${lastTrig.value} mg/dL (${fmtDate(lastTrig.date)})` : "no triglyceride result on file"}; weight ${w.weightKg} kg (${fmtDate(w.date)}).`,
    "",
    "Questions:",
    ...questions.map((q, i) => `${i + 1}. ${q.question}`),
    "",
    "Records we could not find (please help if you can):",
    ...gaps.map((g) => `- ${g.title}`),
  ].join("\n");

  return (
    <>
      <PageHead title="Visit prep" lead="One page to bring to the next appointment: what changed, what to ask, and what the family still can't find. Printable.">
        <CopySummary text={text} />
      </PageHead>
      <div className="mb-6"><CheckInsSince sinceIso={last.date} /></div>

      <div className="space-y-6">
        <Card title="Where things stand">
          <ul className="grid gap-3 text-sm sm:grid-cols-3">
            <li><span className="block text-xs uppercase tracking-wide text-muted">Last specialist visit</span><strong>{fmtDate(last.date)}</strong><br />Doing very well, plan: recheck in about {last.nextRecheck?.replace(/^about /i, "")}, fasted.</li>
            <li><span className="block text-xs uppercase tracking-wide text-muted">Latest ALT</span><strong>{lastALT.value} U/L</strong> ({fmtDate(lastALT.date)})<br />In range since December 2024.</li>
            <li><span className="block text-xs uppercase tracking-wide text-muted">Triglycerides</span><strong>{lastTrig ? `${lastTrig.value} mg/dL` : "n/a"}</strong> ({fmtDate(lastTrig?.date)})<br />The Aug 25 recheck result isn&apos;t on file.</li>
          </ul>
        </Card>

        <Card title="Long-term medications" aside="Dates from his records">
          <p className="mb-3 text-sm text-muted">
            How long he has been on each current medication, so questions about long-term effects start from facts. A start date doesn&apos;t show a medication is
            related to anything. This list is for the conversation with his vet.
          </p>
          <ul className="divide-y divide-line">
            {longTerm.map((m) => (
              <li key={m.name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                <span>
                  <strong className="font-medium">{m.name}</strong>
                  {m.purpose && <span className="text-sm text-muted"> · {m.purpose.charAt(0).toLowerCase() + m.purpose.slice(1)}</span>}
                </span>
                <span className="text-sm text-ink2">
                  since {fmtDate(m.since!)} · {span(m.since!)}
                  {m.breaks && <span className="text-muted"> · with breaks</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink2">
            <strong className="font-medium">Pancreatitis flares on record:</strong>{" "}
            {pancreatitis.length ? pancreatitis.map((f) => fmtApproxDate(f.startDate, f.dateApproximate)).join(" · ") : "none"}
          </p>
        </Card>

        <Card title="Questions to ask" aside={`${questions.length} open`}>
          <ol className="space-y-4">
            {questions.map((q, i) => (
              <li key={q._id} className="flex gap-3">
                <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{i + 1}</span>
                <div>
                  <p className="font-medium">{q.question}</p>
                  {q.why && <p className="mt-1 text-sm text-muted">{q.why}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {q.condition && <Chip wrap>{q.condition}</Chip>}
                    {q.guidance && (
                      <a href={q.guidance.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-brand underline">
                        Source: {q.guidance.title}
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Records still missing" aside={`${gaps.length} open`}>
          <p className="mb-4 text-sm text-muted">A short list the family can work through, or ask the clinic to send in one request.</p>
          <ul className="space-y-4">
            {gaps.map((g) => (
              <li key={g._id} className="rounded-xl border border-line bg-paper p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={g.kind === "verbal-instruction" ? "red" : "amber"}>{KIND_LABEL[g.kind] ?? g.kind}</Chip>
                  <h3 className="font-semibold">{g.title}</h3>
                </div>
                <p className="mt-1.5 text-sm">{g.why}</p>
                {g.ownerNote && <p className="mt-1.5 text-sm italic text-muted">Family: {g.ownerNote}</p>}
                {g.whereToLook && g.whereToLook.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted">
                    {g.whereToLook.map((s) => <li key={s}>{s}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Summary to hand over">
          <pre className="whitespace-pre-wrap rounded-xl bg-paper p-4 font-mono text-xs leading-relaxed">{text}</pre>
        </Card>
      </div>
    </>
  );
}
