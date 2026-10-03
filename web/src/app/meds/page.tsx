import { Card, Chip, Confidence, PageHead } from "@/components/ui";
import { getCareRoutine, getGaps, getMedications } from "@/lib/data";
import { routineTimes, SOURCE_LABEL, vetTiming } from "@/lib/care";
import { doseLine, fmtDate } from "@/lib/format";
import type { Medication } from "@/lib/types";

export const metadata = { title: "Medications · Steadywag" };
export const revalidate = 60;

function period(m: Medication) {
  if (m.status === "active") return `${fmtDate(m.startDate)} to now`;
  return `${fmtDate(m.startDate)}${m.endDate ? ` to ${fmtDate(m.endDate)}` : ""}`;
}

export default async function MedsPage() {
  const [meds, gaps, routine] = await Promise.all([getMedications(), getGaps(), getCareRoutine()]);
  // The written list is what his specialist's reports show as current: the active drugs, plus ursodiol, which is on the list but not being given.
  const schedule = meds.filter((m) => m.status === "active" || m.status === "listed-not-given");
  const notGiven = meds.filter((m) => m.status === "listed-not-given");
  const listedOn = schedule.map((m) => m.lastConfirmedOn ?? "").sort().at(-1);

  const byName = new Map<string, Medication[]>();
  for (const m of meds) byName.set(m.name, [...(byName.get(m.name) ?? []), m]);
  const history = [...byName.entries()]
    .map(([name, list]) => ({ name, list: list.sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? "")) }))
    .sort((a, b) => (b.list.some((m) => m.status === "active") ? 1 : 0) - (a.list.some((m) => m.status === "active") ? 1 : 0) || a.name.localeCompare(b.name));
  const instructionGap = gaps.find((g) => g.kind === "verbal-instruction");

  return (
    <>
      <PageHead
        title="Medications"
        lead="What he takes now, how often, and how each drug has changed over time. This follows his specialist's written list and never changes it."
      />

      <div className="space-y-6">
        <Card title="Current written schedule" aside={listedOn ? `As of the ${fmtDate(listedOn)} specialist report` : undefined}>
          {/* Phone: one card per drug, so nothing scrolls sideways. */}
          <ul className="divide-y divide-line md:hidden">
            {schedule.map((m) => {
              const vet = vetTiming(m);
              const times = routineTimes(m._id, routine);
              const conflict = m.source?.confidence === "conflicting" && m.status === "active";
              return (
                <li key={m._id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-base font-bold text-ink">{m.name} <span className="font-normal text-ink2">{m.dose}</span></p>
                    <p className="text-sm text-ink2">{doseLine(m)}</p>
                  </div>
                  {m.status === "listed-not-given" && <Chip tone="red">Listed, not being given</Chip>}
                  {conflict && <Chip tone="red" wrap>Records disagree, needs confirmation</Chip>}
                  {m.writtenInstruction && <p className="text-sm text-muted"><span className="font-semibold text-ink2">His vet wrote:</span> {m.writtenInstruction}</p>}
                  <p className="text-sm text-muted">
                    <span className="font-semibold text-ink2">When:</span>{" "}
                    {vet && <>{SOURCE_LABEL.vet}: {vet}. </>}
                    {times.length > 0 && <>{SOURCE_LABEL.routine}: {times.join(" and ")}.</>}
                    {!vet && times.length === 0 && "Not given. See below."}
                  </p>
                  {m.purpose && <p className="text-sm text-muted"><span className="font-semibold text-ink2">For:</span> {m.purpose}</p>}
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[620px] text-left text-sm">
              <caption className="sr-only">Medications on his current written list, with his vet&apos;s instruction and when each is given</caption>
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Medication</th>
                  <th className="py-2 pr-3 font-medium">His vet&apos;s instruction</th>
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 font-medium">What it is for</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {schedule.map((m) => {
                  const vet = vetTiming(m);
                  const times = routineTimes(m._id, routine);
                  const conflict = m.source?.confidence === "conflicting" && m.status === "active";
                  return (
                    <tr key={m._id} className="align-top">
                      <td className="py-2.5 pr-3 font-medium">
                        {m.name}
                        <div className="font-normal text-muted">{m.dose}</div>
                        {m.status === "listed-not-given" && <div className="mt-1"><Chip tone="red">Listed, not being given</Chip></div>}
                        {conflict && <div className="mt-1"><Chip tone="red" wrap>Records disagree, needs confirmation</Chip></div>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div>{doseLine(m)}</div>
                        {m.writtenInstruction && <div className="mt-1 text-xs text-muted">As written: {m.writtenInstruction}</div>}
                      </td>
                      <td className="py-2.5 pr-3 text-muted">
                        {vet && <div><span className="font-medium text-ink2">{SOURCE_LABEL.vet}:</span> {vet}</div>}
                        {times.length > 0 && (
                          <div><span className="font-medium text-ink2">{SOURCE_LABEL.routine}:</span> {times.join(" and ")}</div>
                        )}
                        {!vet && times.length === 0 && <span>Not given. See below.</span>}
                      </td>
                      <td className="py-2.5 text-muted">{m.purpose}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            His vet&apos;s written instructions come first. Where they give no time, the time shown is his family&apos;s own routine, labeled as such.
            Some medications are also given as needed for nausea or poor appetite.
          </p>
        </Card>

        {notGiven.map((m) => (
          <section key={m._id} className="rounded-2xl border-2 border-red bg-red-soft p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-red">Listed, but not being given: {m.name}</h2>
              <Chip tone="red">Written list and real care differ</Chip>
            </div>
            <p className="mt-2 text-ink">
              {m.name} ({doseLine(m)}) is on his June and August written medication lists. It was <strong>never given</strong>: a caregiver at the visit was told verbally not to, after the bile duct problem settled by itself. Nothing written records that, so anyone covering his medications from the paperwork would think it is current.
            </p>
            {instructionGap && (
              <p className="mt-2 text-sm text-ink/80">
                <strong>Still missing:</strong> which visit gave the instruction.{instructionGap.ownerNote ? ` Family: ${instructionGap.ownerNote}` : ""} The fix is to ask his team to correct the written list.
              </p>
            )}
          </section>
        ))}

        <Card title="History of every drug" aside={`${meds.length} entries`}>
          <p className="mb-4 text-sm text-muted">Drugs that were stopped and restarted show each period separately, because the written lists alone hide that.</p>
          <div className="space-y-5">
            {history.map(({ name, list }) => (
              <div key={name}>
                <h3 className="text-lg font-semibold">{name}</h3>
                <ol className="mt-1 space-y-2 border-l-2 border-line pl-4">
                  {list.map((m) => (
                    <li key={m._id} className="relative">
                      <span aria-hidden="true" className={`absolute -left-[22px] top-1.5 h-3 w-3 rounded-full border-2 border-surface ${m.status === "active" ? "bg-green-fill" : m.status === "listed-not-given" ? "bg-red-fill" : "bg-muted"}`} />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{doseLine(m)}</span>
                        {m.status === "active" && <Chip tone="green">Active</Chip>}
                        {m.status === "listed-not-given" && <Chip tone="red">Listed, not given</Chip>}
                        {m.status === "stopped" && <Chip>Stopped</Chip>}
                      </div>
                      <div className="text-sm text-muted">{period(m)}{m.purpose ? ` · ${m.purpose}` : ""}</div>
                      {m.notes && <p className="mt-1 text-sm">{m.notes}</p>}
                      {m.timingNote && m.status !== "stopped" && <p className="mt-1 text-sm text-muted">Timing in his records: {m.timingNote}</p>}
                      <Confidence value={m.source?.confidence === "conflicting" ? "conflicting" : undefined} note={m.source?.note} />
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
