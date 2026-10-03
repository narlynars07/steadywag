import { Card, Chip, PageHead } from "@/components/ui";
import { getGuidance } from "@/lib/data";
import type { Guidance } from "@/lib/types";

export const metadata = { title: "Guide · Steadywag" };
export const revalidate = 60;

// Reading order for someone new to the diagnosis, in plain language.
const TOPICS: { key: string; title: string }[] = [
  { key: "diagnosis", title: "How it's diagnosed" },
  { key: "treatment", title: "Treatment" },
  { key: "nutrition", title: "Food and diet" },
  { key: "monitoring", title: "Monitoring" },
  { key: "aging", title: "Life stage and aging" },
  { key: "vet-questions", title: "Questions to ask the vet" },
];

// Questions a family can bring to a vet. Each one comes from an entry below, so every "why" can be checked against its source.
const VET_QUESTIONS: { q: string; why: string; from: string }[] = [
  {
    q: "Was my dog's liver copper measured on a biopsy, and what was the number?",
    why: "A biopsy with a copper measurement is how it is diagnosed. Above about 1000 micrograms per gram of dry liver is typical, and 600 to 1000 is a gray zone.",
    from: "How copper-associated hepatitis is diagnosed",
  },
  {
    q: "How will we know the treatment is working: ALT alone, or a repeat copper measurement?",
    why: "A normal ALT is a stand-in for success, but it can miss mild leftover copper. Repeat measurement is described as the best check.",
    from: "Monitoring treatment response: ALT and repeat copper measurement",
  },
  {
    q: "Which side effects of the copper-binding drug should we watch for, and what do we do if he vomits after a dose?",
    why: "Nausea, vomiting and reduced appetite are the common side effects, and the statement lists ways to ease them.",
    from: "D-penicillamine: dosing, maintenance and side effects",
  },
  {
    q: "Is anything we give, including supplements, getting in the way of treatment?",
    why: "Zinc is not used together with penicillamine, so any supplement is worth checking with the vet.",
    from: "Copper-restricted diet for life, and zinc as maintenance",
  },
  {
    q: "What copper-restricted diet is right for him, and who will tailor it?",
    why: "A copper-restricted diet is advised for life, and a veterinary nutritionist tailors the plan to the individual dog.",
    from: "Copper-restricted diet for life, and zinc as maintenance",
  },
  {
    q: "How much copper could our drinking water add, and should we do anything about it?",
    why: "The statement advises limiting copper in drinking water and suggests flushing copper pipes for a few minutes.",
    from: "Copper-restricted diet for life, and zinc as maintenance",
  },
  {
    q: "Have other causes of the raised liver enzymes been looked for before any immune-suppressing drug is started?",
    why: "The statement advises a careful search for an underlying cause, such as copper, first.",
    from: "Immune-suppressing drugs in chronic hepatitis",
  },
  {
    q: "How long will he be on each medication, and how will we decide when to lower or stop it?",
    why: "One practice article describes penicillamine as usually lasting six to nine months with a copper-restricted diet. Your dog's course may differ.",
    from: "Copper hepatopathy in dogs: a practical overview",
  },
  {
    q: "If pancreatitis is part of the picture, how do the two conditions affect each other, and which signs mean call right away?",
    why: "Pancreatitis can block the bile duct, and recovery can be slow. A dog can seem better while the blockage still shows in blood tests.",
    from: "When pancreatitis blocks the bile duct: what 46 dogs showed",
  },
];

const EVIDENCE: Record<string, string> = {
  "consensus-statement": "Specialist consensus statement",
  "peer-reviewed-study": "Peer-reviewed study",
  "nutrition-service": "Veterinary nutrition service",
  "clinical-reference": "Clinical reference",
  "regulator-statement": "Regulator statement",
};

const REVIEW: Record<string, { label: string; tone: "amber" | "brand" | "green" }> = {
  draft: { label: "Draft, not checked against the source", tone: "amber" },
  checked: { label: "Checked against the source", tone: "brand" },
  "vet-reviewed": { label: "Reviewed by a veterinarian", tone: "green" },
};

function Entry({ g }: { g: Guidance }) {
  const review = REVIEW[g.reviewStatus ?? "draft"] ?? REVIEW.draft;
  const meta = [EVIDENCE[g.evidenceType ?? ""], g.publisher, g.year].filter(Boolean).join(" · ");
  return (
    <li className="py-3">
      <details>
        <summary className="cursor-pointer font-medium text-ink">{g.title}</summary>
        <div className="mt-3 space-y-3">
          <p className="text-ink">{g.summary}</p>
          {g.keyPoints && g.keyPoints.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-ink">
              {g.keyPoints.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
          {g.applicability && (
            <p className="rounded-lg bg-cream px-3 py-2 text-sm text-ink2">
              <strong className="font-semibold">Who the evidence is about. </strong>
              {g.applicability}
            </p>
          )}
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <Chip tone={review.tone}>{review.label}</Chip>
            <span>{g.sourceTitle}{meta ? ` (${meta})` : ""}.</span>
            <a href={g.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-brand2 underline">Read the original</a>
          </p>
        </div>
      </details>
    </li>
  );
}

export default async function GuidePage() {
  const all = await getGuidance();
  const known = new Set(TOPICS.map((t) => t.key));
  const groups = TOPICS.map((t) => ({ ...t, items: all.filter((g) => g.topic === t.key) }));
  const other = all.filter((g) => !g.topic || !known.has(g.topic));
  if (other.length) groups.push({ key: "other", title: "More", items: other });

  return (
    <>
      <PageHead
        title="Guide to copper-associated liver disease"
        lead="What the published sources say about diagnosing, treating and feeding a dog with copper storage disease, written in plain words, with a link to every original."
      />
      <div className="space-y-6">
        <Card tone="lavender">
          <p className="text-ink">
            <strong className="font-semibold">How to read this guide.</strong> Each entry summarizes one published source in our own words and says who the
            evidence is about. Most of the research comes from specific breeds, and a mixed-breed dog may not behave the same way. None of these
            entries has been reviewed by a veterinarian yet, and none replaces your own vet&apos;s plan. Where sources disagree, the entry says so.
          </p>
          <p className="mt-3 text-ink">
            <strong className="font-semibold">A note on units.</strong> Liver copper is reported two ways in these sources: milligrams per kilogram of dry
            weight (mg/kg) and micrograms per gram (µg/g, also called ppm). They are the same number, so 600 mg/kg dry weight is 600 micrograms per gram.
          </p>
        </Card>
        <Card title="Questions worth bringing to your vet" aside={`${VET_QUESTIONS.length} questions`}>
          <p className="mb-3 text-sm text-muted">
            Not advice, just good questions. Each one comes from an entry in this guide, so you can read the source behind it.
          </p>
          <ol className="space-y-4">
            {VET_QUESTIONS.map((x, i) => (
              <li key={x.q} className="flex gap-3">
                <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{i + 1}</span>
                <div>
                  <p className="font-medium text-ink">{x.q}</p>
                  <p className="mt-1 text-sm text-muted">{x.why}</p>
                  <p className="mt-1 text-sm text-ink2">From: {x.from}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
        {groups.filter((g) => g.items.length).map((g) => (
          <Card key={g.key} title={g.title} aside={`${g.items.length} ${g.items.length === 1 ? "entry" : "entries"}`}>
            <ul className="divide-y divide-line">
              {g.items.map((item) => <Entry key={item._id} g={item} />)}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
