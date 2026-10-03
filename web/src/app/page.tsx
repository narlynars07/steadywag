import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, Chip } from "@/components/ui";
import { LineChart, type Annotation } from "@/components/LineChart";
import { Sparkline } from "@/components/Sparkline";
import { getDog, getGaps, getLabSeries, getMedications, getQuestions, getVisits, getWeights } from "@/lib/data";
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

export default async function Overview() {
  const [dog, meds, alt, alkp, weights, visits, gaps, questions] = await Promise.all([
    getDog(), getMedications(), getLabSeries("ALT"), getLabSeries("ALKP"), getWeights(), getVisits(), getGaps(), getQuestions(),
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

  const byId = (id: string) => meds.find((m) => m._id === id)?.startDate;
  const biopsy = visits.find((v) => v.visitType === "procedure")?.date;
  const annotations: Annotation[] = [
    biopsy && { date: biopsy, label: "Liver biopsy" },
    byId("medication-prednisone-1") && { date: byId("medication-prednisone-1")!, label: "Prednisone starts" },
    byId("medication-prednisone-2") && { date: byId("medication-prednisone-2")!, label: "Prednisone doubled" },
    byId("medication-cyclosporine") && { date: byId("medication-cyclosporine")!, label: "Atopica (cyclosporine) starts" },
  ].filter(Boolean) as Annotation[];

  return (
    <div className="space-y-6">
      <section aria-labelledby="intro" className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="max-w-3xl">
        <h1 id="intro" className="font-serif text-4xl font-bold leading-tight text-ink sm:text-5xl">Meet {dog.name}.</h1>
        <p className="mt-4 text-lg text-ink2">
          Theo is {[8, 11, 18].includes(ageYears(dog.birthYear)) ? "an" : "a"} {ageYears(dog.birthYear)}-year-old {dog.breed} whose liver stores too much copper. He eats a diet formulated for him alone, takes
          medications on a schedule, and has had repeated flares of pancreatitis. His care lives in about 180 pages of PDFs, emails, and things said out
          loud in an exam room.
        </p>
        <p className="mt-3 text-ink2">
          Most of those records agree. The places they don&apos;t are the ones that matter. A spoken instruction about one medication never reached the
          written list. A lower-fat diet has been recommended at four visits and still hasn&apos;t been made. A key lab result from his last visit was never
          recorded.
        </p>
        <p className="mt-3 text-ink2">
          Steadywag pulls his records into one chart that shows what&apos;s known, what&apos;s missing, and what to ask at the next visit. We&apos;re sharing
          it, de-identified, so one real case laid out clearly can help other dogs and the families caring for them.
        </p>
        </div>
        <Image
          src="/theo.jpg"
          alt="Theo, a cream and tan Shih Tzu mix, smiling at the camera on a rocky lakeshore"
          width={755}
          height={1000}
          priority
          sizes="(min-width: 768px) 280px, 70vw"
          className="mx-auto aspect-[4/5] w-full max-w-[280px] rounded-[22px] object-cover shadow-[var(--shadow)] md:mx-0"
        />
      </section>

      <section aria-labelledby="why-gaps" className="max-w-3xl rounded-[22px] border border-line bg-surface p-5 shadow-[var(--shadow)] sm:p-6">
        <p id="why-gaps" className="text-ink2">
          <strong className="font-semibold text-ink">Why the gaps are here.</strong> Theo&apos;s care runs through four different teams, about 180 pages of
          records, and instructions given out loud in exam rooms. No one person can hold all of it, including us. Steadywag doesn&apos;t hide what&apos;s
          missing or inconsistent. It shows it, so the right question gets asked at the next visit instead of being discovered in an emergency.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/ask" className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-on-brand">Ask the records</Link>
          <Link href="/diet-history" className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium hover:bg-brand-soft">Build a diet history for your dog</Link>
        </div>
      </section>

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
        <h2 className="font-serif text-3xl font-bold leading-none text-ink">At a glance</h2>
        <p className="mt-3 text-muted">
          {ageYears(dog.birthYear)}-year-old neutered {dog.sex} {dog.breed} · {lastWeight.weightKg} kg · last specialist visit {fmtDate(lastVisit.date)}, doing very well
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {dog.conditions.map((c) => (
            <Chip key={c._id} tone={c.status === "resolved" ? "green" : "brand"} title={c.summary}>
              {c.title}{c.status === "resolved" ? " · resolved" : ""}
            </Chip>
          ))}
        </div>
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

      <Card title="ALT: the liver enzyme to watch" aside={<Link href="/labs" className="text-brand2 underline">All labs</Link>}>
        <LineChart points={alt} unit="U/L" label="ALT" annotations={annotations} scale="log" height={320} />
        <p className="mt-2 text-sm text-muted">
          ALT peaked at 2,431 in December 2023, fell through prednisone and then Atopica (cyclosporine), and has been in range since December 2024. ALT is a stand-in marker: it can miss mild leftover copper.
        </p>
      </Card>
    </div>
  );
}
