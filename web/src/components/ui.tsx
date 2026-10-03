import type { ReactNode } from "react";
import type { Confidence } from "@/lib/types";
import { CONFIDENCE_LABEL } from "@/lib/format";

export function PageHead({ title, lead, children }: { title: string; lead?: string; children?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        <h1 className="font-serif text-4xl font-bold leading-none text-ink sm:text-[42px]">{title}</h1>
        {lead && <p className="mt-3 text-muted">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

/** A rounded card. tone="lavender" is the tinted panel used for what needs attention. */
export function Card({
  title, aside, children, className = "", tone = "plain",
}: { title?: string; aside?: ReactNode; children: ReactNode; className?: string; tone?: "plain" | "lavender" }) {
  const lav = tone === "lavender";
  return (
    <section className={`print-card rounded-[22px] border p-5 sm:p-6 ${lav ? "border-transparent bg-brand-soft" : "border-line bg-surface shadow-[var(--shadow)]"} ${className}`}>
      {(title || aside) && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {title && <h2 className={`font-serif font-bold ${lav ? "text-2xl text-brand2" : "text-xl text-ink"}`}>{title}</h2>}
          {aside && <div className="text-sm text-muted">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

const TONES = {
  neutral: "bg-cream text-ink2 border-line",
  brand: "bg-brand-soft text-brand2 border-transparent",
  blue: "bg-blue-soft text-ink2 border-transparent",
  amber: "bg-amber-soft text-amber border-transparent",
  red: "bg-red-soft text-red border-transparent",
  green: "bg-green-soft text-green border-transparent",
} as const;

export function Chip({ tone = "neutral", children, title, wrap }: { tone?: keyof typeof TONES; children: ReactNode; title?: string; wrap?: boolean }) {
  // Short chips stay on one line. A long one (a full condition name) can opt in to wrapping so it never pushes the page wider than the screen.
  return (
    <span title={title} className={`inline-flex max-w-full items-center gap-1 ${wrap ? "whitespace-normal" : "whitespace-nowrap"} rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Honest provenance: says how sure the record is. Always text, never only color. */
export function Confidence({ value, note }: { value?: Confidence; note?: string }) {
  if (!value || value === "confirmed") return null;
  // With a note, the note explains the problem and a short lead-in names it. Without one, the label says it once.
  return (
    <p className={`mt-2 rounded-lg px-3 py-2 text-sm ${value === "conflicting" ? "bg-red-soft text-red" : "bg-amber-soft text-amber"}`}>
      {note ? (
        <>
          <strong className="font-semibold">{value === "conflicting" ? "Records disagree, needs confirmation. " : "Single source. "}</strong>
          {note}
        </>
      ) : (
        <strong className="font-semibold">{CONFIDENCE_LABEL[value]}</strong>
      )}
    </p>
  );
}
