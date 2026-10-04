import Link from "next/link";
import { fmtMonthYear } from "@/lib/format";

const WARN = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
    <path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" />
  </svg>
);

/**
 * The one thing his paperwork gets wrong: a medication that is on his written list but was never given, because a caregiver was
 * told in person to stop. Written for someone who knows nothing about the history, and flagged as an open question for his vet.
 * It says only what his records say: the instruction was verbal and never written down. It does not say when the list will change.
 */
export function NotGivenCallout({ name, since, variant = "full" }: { name: string; since?: string | null; variant?: "full" | "compact" }) {
  const story = (
    <ol className="space-y-1.5 text-sm leading-snug">
      <li className="flex gap-2"><span aria-hidden="true" className="font-bold">1.</span><span>His vet prescribed it{since ? ` in ${fmtMonthYear(since)}` : ""}, with the instruction to stop it at the first sign of pancreatitis.</span></li>
      <li className="flex gap-2"><span aria-hidden="true" className="font-bold">2.</span><span>Later, a caregiver was told <strong className="font-semibold">in person</strong> not to give it, after his bile duct problem settled.</span></li>
      <li className="flex gap-2"><span aria-hidden="true" className="font-bold">3.</span><span>That was <strong className="font-semibold">never written down</strong>, so his June and August medication lists still show it as current.</span></li>
    </ol>
  );
  const question = (
    <div className="rounded-xl bg-surface/70 px-3 py-2.5 text-sm leading-snug text-ink">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">Open question for his vet</p>
      <p className="mt-0.5">&ldquo;Can the written medication list be corrected so {name.toLowerCase()} is no longer listed?&rdquo;</p>
      <p className="mt-1 text-xs text-muted">Which visit gave the instruction isn&apos;t recorded either.</p>
      <Link href="/visit-prep" className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-brand2 underline-offset-4 hover:underline">See it on Visit prep →</Link>
    </div>
  );

  if (variant === "compact") {
    return (
      <div role="note" className="rounded-xl bg-amber-soft p-3 text-[13px] leading-snug text-amber">
        <div className="flex items-start gap-2">
          {WARN}
          <p><strong className="font-semibold">Don&apos;t give {name}.</strong> It&apos;s still on his written list, but he was told in person to stop it.</p>
        </div>
        <details className="mt-1 text-ink">
          <summary className="flex min-h-11 cursor-pointer items-center pl-6 text-[13px] font-semibold text-brand2">What happened, and what&apos;s still open</summary>
          <div className="space-y-2 pb-1 pl-1">{story}{question}</div>
        </details>
      </div>
    );
  }

  return (
    <section role="note" aria-label={`${name} is on his list but not being given`} className="rounded-2xl border-2 border-amber-fill/60 bg-amber-soft p-4 text-amber">
      <div className="flex items-start gap-2.5">
        {WARN}
        <div className="min-w-0 space-y-3">
          <h2 className="text-base font-extrabold leading-snug">{name}: on his list, but not being given</h2>
          <div className="text-ink">{story}</div>
          <p className="text-[15px] font-bold">Please don&apos;t give it.</p>
          {question}
        </div>
      </div>
    </section>
  );
}
