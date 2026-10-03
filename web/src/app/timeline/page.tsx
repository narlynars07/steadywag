import { HistoryCalendar } from "@/components/HistoryCalendar";
import { TimelineList, type TimelineEvent } from "@/components/TimelineList";
import { Card, PageHead } from "@/components/ui";
import { getFlares, getImaging, getMedications, getVisits } from "@/lib/data";
import { doseLine, MODALITY_LABEL, VISIT_LABEL } from "@/lib/format";
import type { Confidence, Flare, Imaging, Medication, SourceNote, Visit } from "@/lib/types";

export const metadata = { title: "Timeline · Steadywag" };
// The calendar runs to today, so refresh it now and then.
export const revalidate = 300;

type Detail = { heading: string; text: string };
const RANK: Record<Confidence, number> = { confirmed: 0, "single-source": 1, conflicting: 2 };

/** When two records describe the same event, keep the more cautious source note, never the more reassuring one. */
function worst(...sources: (SourceNote | undefined)[]): { confidence?: Confidence; note?: string } {
  const found = sources.filter((s): s is SourceNote => !!s?.confidence);
  if (!found.length) return {};
  const pick = found.reduce((a, b) => (RANK[b.confidence!] > RANK[a.confidence!] ? b : a));
  return { confidence: pick.confidence, note: pick.note };
}

const compact = (items: (Detail | null | "" | undefined)[]) => items.filter(Boolean) as Detail[];

function visitDetails(v: Visit): Detail[] {
  return compact([
    v.medicationChanges && { heading: "Medication changes", text: v.medicationChanges },
    v.recommendations?.length ? { heading: "Recommendations", text: v.recommendations.join(" · ") } : null,
    v.nextRecheck && { heading: "Next recheck", text: v.nextRecheck },
  ]);
}

/** An emergency visit and the flare it was for are one event, not two. */
function emergencyEvent(v: Visit, f?: Flare): TimelineEvent {
  const src = worst(v.source, f?.source);
  return {
    id: v._id, date: v.date, kind: "visit", also: f ? ["flare"] : undefined, label: "Emergency visit",
    title: v.diagnoses?.[0] ?? f?.suspectedCause ?? "Emergency visit", summary: v.summary, tone: "red",
    details: compact([
      ...(f ? [
        f.signs?.length ? { heading: "Signs noticed", text: f.signs.join(", ") } : null,
        f.supportiveCare && { heading: "Care given", text: f.supportiveCare },
        f.outcome && { heading: "Outcome", text: f.outcome },
      ] : []),
      ...visitDetails(v),
    ]),
    ...src,
  };
}

/** An imaging visit and its scan are one event, not two. */
function imagingVisitEvent(v: Visit, i?: Imaging): TimelineEvent {
  const src = worst(v.source, i?.source);
  return {
    id: v._id, date: v.date, kind: "visit", also: i ? ["imaging"] : undefined, label: "Imaging visit",
    title: i?.headline ?? v.diagnoses?.[0] ?? "Imaging visit", summary: v.summary, tone: "brand",
    details: compact([
      ...visitDetails(v),
      i?.findings && { heading: `${MODALITY_LABEL[i.modality] ?? "Imaging"}: findings`, text: i.findings },
      i?.conclusion && { heading: "Radiology conclusion", text: i.conclusion },
      i?.comparison && { heading: "Compared with", text: i.comparison },
    ]),
    ...src,
  };
}

/** Medication events. A restart reads as a restart, and a same-day stop and start of one drug is a dose change. */
function medicationEvents(meds: Medication[]): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  const byName = new Map<string, Medication[]>();
  for (const m of meds) byName.set(m.name, [...(byName.get(m.name) ?? []), m].sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? "")));

  for (const list of byName.values()) {
    list.forEach((m, idx) => {
      const prev = idx > 0 ? list[idx - 1] : undefined;
      const sameDayChange = !!prev && !!prev.endDate && prev.endDate === m.startDate;
      if (m.startDate && m.status !== "listed-not-given") {
        if (sameDayChange) {
          out.push({
            id: `${m._id}-change`, date: m.startDate, kind: "medication", label: "Dose changed", tone: "green",
            title: `${m.name}: ${prev!.dose ?? "?"} to ${m.dose ?? "?"}`, summary: m.purpose,
            confidence: m.source?.confidence, note: m.source?.note,
          });
        } else {
          out.push({
            id: `${m._id}-start`, date: m.startDate, kind: "medication", label: idx > 0 ? "Medication restarted" : "Medication started", tone: "green",
            title: `${m.name}: ${doseLine(m)}`, summary: m.purpose, confidence: m.source?.confidence, note: m.source?.note,
          });
        }
      }
      const next = list[idx + 1];
      const changedNextDay = !!next && !!m.endDate && next.startDate === m.endDate;
      if (m.endDate && !changedNextDay) {
        out.push({ id: `${m._id}-stop`, date: m.endDate, kind: "medication", label: "Medication stopped", title: `${m.name}: ${doseLine(m)}`, summary: m.notes, tone: "neutral" });
      }
    });
  }
  return out;
}

export default async function TimelinePage() {
  const [visits, flares, imaging, meds] = await Promise.all([getVisits(), getFlares(), getImaging(), getMedications()]);

  const flareByDate = new Map(flares.map((f) => [f.startDate, f]));
  const imagingByDate = new Map(imaging.map((i) => [i.date, i]));
  const usedFlares = new Set<string>();
  const usedImaging = new Set<string>();

  const visitEvents = visits.map((v): TimelineEvent => {
    if (v.visitType === "emergency") {
      const f = flareByDate.get(v.date);
      if (f) usedFlares.add(f._id);
      return emergencyEvent(v, f);
    }
    if (v.visitType === "imaging") {
      const i = imagingByDate.get(v.date);
      if (i) usedImaging.add(i._id);
      return imagingVisitEvent(v, i);
    }
    return {
      id: v._id, date: v.date, kind: "visit", label: VISIT_LABEL[v.visitType] ?? "Visit",
      title: v.diagnoses?.[0] ?? VISIT_LABEL[v.visitType] ?? "Visit", summary: v.summary, tone: "brand",
      details: visitDetails(v), confidence: v.source?.confidence, note: v.source?.note,
    };
  });

  const events: TimelineEvent[] = [
    ...visitEvents,
    ...flares.filter((f) => !usedFlares.has(f._id)).map((f): TimelineEvent => ({
      id: f._id, date: f.startDate, approx: !!f.dateApproximate, kind: "flare", label: f.levelOfCare === "emergency" ? "Emergency flare" : "Flare",
      title: f.suspectedCause ?? "Flare", summary: [f.signs?.join(", "), f.outcome].filter(Boolean).join(". "),
      tone: f.levelOfCare === "emergency" ? "red" : "amber",
      details: f.supportiveCare ? [{ heading: "Care given", text: f.supportiveCare }] : [],
      confidence: f.source?.confidence, note: f.source?.note,
    })),
    ...imaging.filter((i) => !usedImaging.has(i._id)).map((i): TimelineEvent => ({
      id: i._id, date: i.date, kind: "imaging", label: MODALITY_LABEL[i.modality] ?? "Imaging",
      title: i.headline ?? MODALITY_LABEL[i.modality] ?? "Imaging", summary: i.conclusion,
      tone: "neutral",
      details: compact([i.findings && { heading: "Findings", text: i.findings }, i.comparison && { heading: "Compared with", text: i.comparison }]),
      confidence: i.source?.confidence, note: i.source?.note,
    })),
    ...medicationEvents(meds),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <PageHead
        title="Timeline"
        lead="Everything on record, newest first: visits, flares, scans, and every medication change, from the first elevated liver value in November 2022."
      />
      <div className="space-y-6">
        <Card title="Flares and visits at a glance">
          <p className="mb-3 text-sm text-muted">
            Each square is one day. Marked days are flares and vet visits from his records. A blank square means nothing is recorded for that day.
          </p>
          <HistoryCalendar flares={flares} visits={visits} />
        </Card>
        <TimelineList events={events} />
      </div>
    </>
  );
}
