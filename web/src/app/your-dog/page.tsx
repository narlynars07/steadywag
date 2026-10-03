import Link from "next/link";
import { Card } from "@/components/ui";

export const metadata = { title: "Your dog · Steadywag" };

const STEPS = [
  ["Fill in what you know.", "Foods, treats, chews, supplements, water."],
  ["Mark what you can't remember.", "That's useful too."],
  ["Download it.", "A PDF for your vet, or a CSV for researchers."],
] as const;

export default function YourDogPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-brand2">For your dog</p>
        <h1 className="mt-1 text-[26px] font-extrabold leading-tight tracking-tight text-ink">Tools from Theo&apos;s story</h1>
      </div>

      <Card>
        <h2 className="text-lg font-extrabold tracking-tight text-ink">Your dog&apos;s diet history, ready for the vet</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink2">
          When a dog is diagnosed with copper-related liver disease, the specialist asks what the dog ate before the diagnosis. Most families can&apos;t answer
          from memory. This walks you through it.
        </p>
        <ol className="mt-4 space-y-2">
          {STEPS.map(([bold, rest], i) => (
            <li key={bold} className="flex gap-2.5 text-sm leading-snug text-ink2">
              <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-extrabold text-brand2">{i + 1}</span>
              <span><strong className="font-semibold text-ink">{bold}</strong> {rest}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/diet-history" className="flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-bold text-on-brand">Start my dog&apos;s history</Link>
          <Link href="/diet-history?example=1" className="flex min-h-11 items-center rounded-xl bg-brand-soft px-4 text-sm font-bold text-brand2">See Theo&apos;s example</Link>
        </div>
        <p className="mt-3 text-xs text-muted">Everything stays in your browser.</p>
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold tracking-tight text-ink">Guide to copper-associated liver disease</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink2">
          Published sources on diagnosis, treatment and diet, in plain words, with who the evidence is about and a link to every original.
        </p>
        <Link href="/guide" className="mt-2 flex min-h-11 items-center text-sm font-bold text-brand2 underline-offset-4 hover:underline">Read the guide →</Link>
      </Card>
    </div>
  );
}
