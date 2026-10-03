import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, Chip } from "@/components/ui";
import { LineChart, type Annotation, type Lane, type Marker } from "@/components/LineChart";
import { Sparkline } from "@/components/Sparkline";
import { getDog, getFlares, getGaps, getFamilyNotes, getHistoryChapters, getHistoryPatterns, getHistorySummary, getLabSeries, getMedications, getQuestions, getVisits, getWeights } from "@/lib/data";
import { SOURCE_LABEL } from "@/lib/care";
import type { HistorySource } from "@/lib/types";
import { ageYears, fmtDate, fmtMonthYear } from "@/lib/format";

// Data refreshes every minute.
export const revalidate = 60;

function Icon({ name }: { name: "calendar" | "alert" | "file" | "pill" }) {
  const p = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "calendar") return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
  if (name === "alert") return <svg {...p}><path d="M12 3 22 20H2L12 3Z" /><path d="M12 10v4M12 17.2v.1" /></svg>;
  if (name === "file") return <svg {...p}><path d="M7 3h7l5 5v13H7V3Z" /><path d="M14 3v5h5" /></svg>;
  return <svg {...p}><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" /><path d="m9.5 9.5 5 5" /></svg>;
}

function AttentionRow({ icon, warn, title, sub, action, href }: { icon: "calendar" | "alert" | "file" | "pill"; warn?: boolean; title: string; sub: ReactNode; action: string; href: string }) {
  return (
    <li className="flex items-start gap-3 border-b border-brand2/15 py-4 last:border-b-0">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${warn ? "bg-amber-soft text-amber" : "bg-surface text-brand2"}`}>
        <Icon name={icon} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{title}</p>
        <p className="text-sm text-muted">{sub}</p>
      </div>
      <Link href={href} className="shrink-0 pt-0.5 text-sm font-medium text-brand2 underline-offset-4 hover:underline">{action}</Link>
    </li>
  );
}

function Trend({ label, value, unit, chip, children }: { label: string; value: string; unit: string; chip: ReactNode; children: ReactNode }) {
  return (
    <section className="print-card rounded-[22px] border border-line bg-surface p-5 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted">{label}</p>
        {chip}
      </div>
      <p className="mt-1 font-sans text-4xl font-bold tracking-tight text-ink">
        {value} <span className="text-base font-medium text-muted">{unit}</span>
      </p>
      <div className="mt-2">{children}</div>
    </section>
  );
}

const LABEL: Record<string, string> = { vetVisit: "Visit", flareEpisode: "Flare", imagingStudy: "Imaging" };

/** Names a record a history claim rests on and links to the page that shows it. */
function sourceLink(s: HistorySource): { key: string; label: string; href: string } | null {
  if (s._type === "vetVisit" || s._type === "flareEpisode" || s._type === "imagingStudy") return { key: s._id, label: `${LABEL[s._type]} · ${fmtDate(s.date)}`, href: `/timeline#${s._id}` };
  if (s._type === "labResult") return { key: s._id, label: `${s.code ?? "Lab"} ${s.value?.toLocaleString() ?? ""} · ${fmtDate(s.date)}`, href: "/labs" };
  if (s._type === "medication") return { key: `med-${s.name}`, label: s.name ?? "Medication", href: "/meds" };
  if (s._type === "recordGap") return { key: s._id, label: "Missing from the records", href: "/visit-prep" };
  return null;
}

function SourceList({ sources }: { sources?: HistorySource[] }) {
  const seen = new Set<string>();
  const links = (sources ?? []).map(sourceLink).filter((l): l is NonNullable<typeof l> => !!l && !seen.has(l.key) && !!seen.add(l.key));
  if (!links.length) return null;
  return (
    <details className="mt-2 text-sm">
      <summary className="flex min-h-11 cursor-pointer items-center text-brand2">{SOURCE_LABEL.vet}: {links.length} records behind this</summary>
      <ul className="flex flex-wrap gap-1.5 pb-1">
        {links.map((l) => (
          <li key={l.key}><Link href={l.href} className="flex min-h-9 items-center rounded-full bg-brand-soft px-3 text-xs font-semibold text-brand2 hover:underline">{l.label}</Link></li>
        ))}
      </ul>
    </details>
  );
}

const DRUG_LANES: { match: RegExp; label: string; color: string }[] = [
  { match: /^penicillamine/i, label: "Penicillamine", color: "var(--brand)" },
  { match: /^prednisone/i, label: "Prednisone", color: "var(--blue)" },
  { match: /^atopica/i, label: "Atopica", color: "var(--green-fill)" },
  { match: /^fenofibrate/i, label: "Fenofibrate", color: "var(--amber-fill)" },
];

export default async function History() {
  const [dog, meds, alt, alkp, weights, visits, gaps, questions, flares, summary, chapters, patterns, familyNotes] = await Promise.all([
    getDog(), getMedications(), getLabSeries("ALT"), getLabSeries("ALKP"), getWeights(), getVisits(), getGaps(), getQuestions(), getFlares(),
    getHistorySummary(), getHistoryChapters(), getHistoryPatterns(), getFamilyNotes(),
  ]);

  const lastALT = alt.at(-1)!;
  const peakALT = alt.reduce((a, b) => (b.value > a.value ? b : a));
  const lastALKP = alkp.at(-1)!;
  const lastWeight = weights.at(-1)!;
  const prevWeight = weights.at(-2)!;
  const weightDelta = +(lastWeight.weightKg - prevWeight.weightKg).toFixed(1);
  const lastVisit = visits.find((v) => v.visitType === "specialist-recheck")!;
  const notGiven = meds.filter((m) => m.status === "listed-not-given");
  const trigGap = gaps.find((g) => /triglyceride/i.test(g.title));
  const dietQuestion = questions.find((q) => /low-fat/i.test(q.question));

  const biopsy = visits.find((v) => v.visitType === "procedure")?.date;
  const annotations: Annotation[] = biopsy ? [{ date: biopsy, label: "Liver biopsy" }] : [];
  const lanes: Lane[] = DRUG_LANES.map((d) => ({
    label: d.label,
    color: d.color,
    periods: meds
      .filter((m) => d.match.test(m.name) && m.startDate)
      .map((m) => ({ start: m.startDate!, end: m.endDate ?? null, title: `${m.name}${m.dose ? ` ${m.dose}` : ""}: ${fmtDate(m.startDate)} to ${m.endDate ? fmtDate(m.endDate) : "now"}` })),
  })).filter((l) => l.periods.length);
  const markers: Marker[] = flares.map((f) => ({
    date: f.startDate,
    kind: /reaction/i.test(f.suspectedCause ?? "") ? "reaction" : "flare",
    approximate: !!f.dateApproximate,
    label: `${/reaction/i.test(f.suspectedCause ?? "") ? "Suspected reaction" : "Flare"}: ${f.dateApproximate ? "about " : ""}${fmtDate(f.startDate)}`,
  }));

  return (
    <div className="space-y-6">
      {/* One opening card: who he is, his story in 60 seconds, where he stands today, and why the records have gaps. */}
      <section aria-labelledby="sixty" className="rounded-[22px] border border-line bg-surface p-5 shadow-[var(--shadow)] sm:p-6">
        <div className="flex items-center gap-3.5">
          <Image src="/theo.jpg" alt="Theo, a cream and tan Shih Tzu mix, smiling at the camera on a rocky lakeshore" width={144} height={144} priority
            className="h-[72px] w-[72px] shrink-0 rounded-full border-[3px] border-surface object-cover object-[50%_30%] shadow-[0_0_0_2px_var(--brand)]" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-brand2">His history</p>
            <h1 id="sixty" className="text-[26px] font-extrabold leading-tight tracking-tight text-ink">{summary?.title ?? "Theo in 60 seconds"}</h1>
            <p className="text-sm text-muted">{ageYears(dog.birthYear)}-year-old neutered {dog.sex} {dog.breed}</p>
          </div>
        </div>

        {summary && (
          <>
            <p className="mt-4 text-[15px] leading-relaxed text-ink2 sm:text-base">{summary.body}</p>
            <SourceList sources={summary.sources} />
          </>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["ALT now", `${lastALT.value} U/L`, "In range", "green" as const],
            ["Weight", `${lastWeight.weightKg} kg`, `${weightDelta > 0 ? "+" : ""}${weightDelta} kg since ${fmtMonthYear(prevWeight.date).split(" ")[0]}`, "neutral" as const],
            ["Last specialist visit", fmtDate(lastVisit.date), "Doing very well", "green" as const],
            ["Still open", `${gaps.length} records`, "not on file", "amber" as const],
          ].map(([label, value, note, tone]) => (
            <div key={label} className="rounded-xl bg-paper px-3 py-2.5">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="text-[17px] font-extrabold tracking-tight text-ink">{value}</dd>
              <dd className={`text-xs font-semibold ${tone === "green" ? "text-green" : tone === "amber" ? "text-amber" : "text-muted"}`}>{note}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 flex flex-wrap gap-2">
          {dog.conditions.map((c) => (
            <Chip key={c._id} wrap tone={c.status === "resolved" ? "green" : "brand"} title={c.summary}>
              {c.title}{c.status === "resolved" ? " · resolved" : ""}
            </Chip>
          ))}
        </div>

        <details className="mt-4 border-t border-line">
          <summary className="flex min-h-12 cursor-pointer items-center text-[15px] font-semibold text-brand2">About this record, and why it has gaps</summary>
          <div className="space-y-3 pb-1 text-[15px] leading-relaxed text-ink2">
            <p>
              Theo&apos;s care lives in about 180 pages of PDFs, emails, and things said out loud in an exam room, across four different teams. Most of it agrees. The places it
              doesn&apos;t are the ones that matter: a spoken instruction about one medication never reached the written list, a lower-fat diet has been recommended at four visits
              and still hasn&apos;t been made, and a key lab result from his last visit was never recorded.
            </p>
            <p>
              Steadywag doesn&apos;t hide what&apos;s missing or inconsistent. It shows it, so the right question gets asked at the next visit instead of being discovered in an
              emergency. We&apos;re sharing it, de-identified, so one real case laid out clearly can help other dogs and the families caring for them.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/" className="flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-medium text-on-brand">Ask the records</Link>
              <Link href="/diet-history" className="flex min-h-11 items-center rounded-full border border-line bg-surface px-5 text-sm font-medium hover:bg-brand-soft">Build a diet history for your dog</Link>
            </div>
          </div>
        </details>
      </section>

      <nav aria-label="On this page" className="sticky top-16 z-20 -mx-4 overflow-x-auto bg-paper/95 px-4 py-2 backdrop-blur sm:mx-0 sm:px-0 md:top-[4.5rem]">
        <ul className="flex gap-2">
          {[["The whole story", "#chart"], ["Chapters", "#chapters"], ["What it shows", "#patterns"], ...(familyNotes.length ? [["From his family", "#family"]] : []), ["What's missing", "#open"]].map(([l, h]) => (
            <li key={h} className="shrink-0"><a href={h} className="flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-brand2 hover:bg-brand-soft">{l}</a></li>
          ))}
        </ul>
      </nav>

      <div id="chart" className="scroll-mt-32" />
      <Card title="The whole story, one timeline" aside={<Link href="/labs" className="text-brand2 underline">All labs</Link>}>
        <p className="mb-2 text-sm text-muted">ALT liver enzyme on a log scale, with his medications and flares underneath. Scrolls sideways on a phone.</p>
        <LineChart points={alt} unit="U/L" label="ALT" annotations={annotations} scale="log" height={260} lanes={lanes} markers={markers} minWidth={640} />
        <p className="mt-2 text-sm text-muted">ALT is a stand-in marker: it can miss mild leftover copper.</p>
      </Card>

      <section aria-labelledby="chapters" className="scroll-mt-32 space-y-3">
        <h2 id="chapters" className="text-xl font-extrabold tracking-tight text-ink">Five chapters</h2>
        {chapters.map((c, i) => (
          <details key={c._id} open={i === 0} className="group rounded-2xl border border-line bg-surface">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3">
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand2">{c.order}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold leading-snug text-ink">{c.title}</span>
                <span className="block text-xs text-muted">{c.dates}</span>
              </span>
              <span aria-hidden="true" className="text-xl text-brand2 group-open:hidden">+</span>
              <span aria-hidden="true" className="hidden text-xl text-brand2 group-open:inline">−</span>
            </summary>
            <div className="space-y-3 border-t border-line px-4 pb-4 pt-3">
              <p className="text-[15px] leading-relaxed text-ink2">{c.summary}</p>
              {c.keyNumbers && c.keyNumbers.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {c.keyNumbers.map((k) => <li key={k}><Chip wrap tone="brand">{k}</Chip></li>)}
                </ul>
              )}
              {c.notInRecords && c.notInRecords.length > 0 && (
                <div className="rounded-xl bg-amber-soft px-3 py-2 text-sm text-amber">
                  <strong className="font-semibold">Not in the records:</strong>
                  <ul className="mt-1 list-disc pl-5">{c.notInRecords.map((n) => <li key={n}>{n}</li>)}</ul>
                </div>
              )}
              <SourceList sources={c.sources} />
              <Link href={`/?q=${encodeURIComponent(`Tell me about this chapter of his history: ${c.title} (${c.dates}).`)}&go=1`} className="flex min-h-11 items-center text-sm font-bold text-brand2">Ask about this chapter →</Link>
            </div>
          </details>
        ))}
      </section>

      <section aria-labelledby="patterns" className="scroll-mt-32 space-y-3">
        <h2 id="patterns" className="text-xl font-extrabold tracking-tight text-ink">What his history shows</h2>
        {patterns.map((p) => (
          <article key={p._id} className="rounded-2xl border border-line bg-surface px-4 py-3">
            <h3 className="text-[15px] font-bold leading-snug text-ink">{p.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink2">{p.body}</p>
            {p.timingOnly && <p className="mt-2"><Chip wrap tone="amber">Timing only. The records don&apos;t show cause.</Chip></p>}
            <SourceList sources={p.sources} />
          </article>
        ))}
      </section>

      {familyNotes.length > 0 && (
        <section id="family" aria-labelledby="family-heading" className="scroll-mt-32 space-y-3">
          <div>
            <h2 id="family-heading" className="text-xl font-extrabold tracking-tight text-ink">From Theo&apos;s family</h2>
            <p className="mt-1 text-sm text-muted">What one family has learned while caring for him. These are observations, not medical advice and not instructions from a veterinarian.</p>
          </div>
          {familyNotes.map((n) => (
            <article key={n._id} className="rounded-2xl border border-line bg-surface px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="brand">{SOURCE_LABEL.observation}</Chip>
                {n.directedBy === "family" && <span className="text-xs text-muted">Not something his vet told us to do</span>}
              </div>
              <h3 className="mt-1.5 text-[15px] font-bold leading-snug text-ink">{n.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink2">{n.body}</p>
              {n.askYourVet && <p className="mt-2 text-sm text-muted"><span className="font-semibold text-ink2">Worth asking your own vet:</span> {n.askYourVet}</p>}
            </article>
          ))}
          <p className="rounded-xl bg-amber-soft px-3.5 py-2.5 text-sm text-amber">Every dog and every illness is different. If your dog is vomiting, won&apos;t eat, or seems dehydrated, call your vet.</p>
        </section>
      )}

      <nav aria-label="More of his records" className="flex flex-wrap gap-2">
        {[["Timeline", "/timeline"], ["Labs", "/labs"], ["Medications", "/meds"], ["Visit prep", "/visit-prep"]].map(([l, h]) => (
          <Link key={h} href={h} className="flex min-h-11 items-center rounded-full border border-line bg-surface px-5 text-sm font-semibold text-brand2 hover:bg-brand-soft">{l}</Link>
        ))}
      </nav>

      <div id="open" className="scroll-mt-32" />
      <Card title="Open items in Theo's chart" aside="What Steadywag flags" tone="lavender">
        <p className="mb-1 text-sm text-ink2">
          A spoken instruction that never reached the written list, a result nobody recorded, a recommendation still not done. Each one is kept visible on
          purpose.
        </p>
        <ul>
          {notGiven[0] && (
            <AttentionRow icon="pill" warn title={`${notGiven[0].name}: listed, not given`} sub="A spoken instruction never reached the written list" action="See why" href="/meds" />
          )}
          <AttentionRow icon="calendar" title={`Specialist recheck · about ${lastVisit.nextRecheck?.replace(/^about /i, "")} from ${fmtDate(lastVisit.date)}`} sub="Fasted, so triglycerides can be read" action="Prep summary" href="/visit-prep" />
          <AttentionRow icon="file" title={`${gaps.length} records aren't on file`} sub={trigGap ? `Including: ${trigGap.title.replace(/ was never recorded/i, "")}` : "Each lists where to look"} action="See what's missing" href="/visit-prep" />
          {dietQuestion && (
            <AttentionRow icon="alert" warn title="Lower-fat diet still not made" sub="Recommended in four reports since March 2026" action="Open food plan" href="/food" />
          )}
        </ul>
      </Card>

      <header>
        <p className="mb-1 text-sm font-medium uppercase tracking-wide text-brand2">His chart</p>
        <h2 className="font-serif text-3xl font-bold leading-none text-ink">Trends</h2>
      </header>

      <div className="grid gap-6 sm:grid-cols-3">
        <Trend label={`ALT · since ${fmtMonthYear(alt[0].date)}`} value={String(lastALT.value)} unit="U/L" chip={<Chip tone="green">In range</Chip>}>
          <Sparkline points={alt} color="var(--brand)" label="ALT" />
          <p className="text-xs text-muted">Peak {peakALT.value.toLocaleString()} in {fmtMonthYear(peakALT.date)}</p>
        </Trend>
        <Trend label={`Weight · since ${fmtMonthYear(weights[0].date)}`} value={String(lastWeight.weightKg)} unit="kg" chip={<Chip>{weightDelta > 0 ? "+" : ""}{weightDelta} kg vs {fmtMonthYear(prevWeight.date).split(" ")[0]}</Chip>}>
          <Sparkline points={weights.map((w) => ({ date: w.date, value: w.weightKg }))} color="var(--blue)" label="Weight" />
          <p className="text-xs text-muted">Body score {lastWeight.bodyConditionScore ?? "n/a"} of 9</p>
        </Trend>
        <Trend label={`ALKP · since ${fmtMonthYear(alkp[0].date)}`} value={String(lastALKP.value)} unit="U/L" chip={<Chip tone={lastALKP.flag === "normal" ? "green" : "amber"}>{lastALKP.flag === "normal" ? "In range" : "Flagged"}</Chip>}>
          <Sparkline points={alkp} color="var(--amber-fill)" label="ALKP" />
          <p className="text-xs text-muted">A bile-duct marker. It rose in March 2026 and settled.</p>
        </Trend>
      </div>
    </div>
  );
}
