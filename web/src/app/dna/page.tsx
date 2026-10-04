import Link from "next/link";
import { Card, Chip, PageHead } from "@/components/ui";
import { getDnaReport } from "@/lib/data";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "His DNA · Steadywag" };
export const revalidate = 60;

export default async function DnaPage() {
  const dna = await getDnaReport();
  if (!dna) return <PageHead title="His DNA" lead="No DNA report is on file." />;
  const mix = dna.breedMix ?? [];
  const max = Math.max(...mix.map((b) => b.percent), 1);
  const clear = (dna.breedRelevantClear ?? 0) + (dna.otherClear ?? 0);

  return (
    <>
      <PageHead
        title="His DNA"
        lead={`${dna.provider ? `${dna.provider[0].toUpperCase()}${dna.provider.slice(1)}` : "A DNA test"}, taken ${fmtDate(dna.testDate)}. A genetic test is not a diagnosis. Results are shown as the report states them.`}
      />
      <div className="space-y-6">
        <Card title="His breed mix" aside="Seven breeds">
          <ul className="space-y-2.5">
            {mix.map((b) => (
              <li key={b.breed} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
                <span className="font-medium text-ink">{b.breed}</span>
                <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-brand-soft"><span className="block h-full rounded-full bg-brand" style={{ width: `${(b.percent / max) * 100}%` }} /></span>
                <span className="text-right font-semibold text-ink2">{b.percent.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">His vet records call him a Shih Tzu mix. The test shows Shih Tzu is his largest single share, in a mix of seven.</p>
        </Card>

        <Card title="What the health panel found">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="green">No increased risk found</Chip>
            <span className="text-sm text-ink2">All {clear} results are Clear ({dna.breedRelevantClear} breed-relevant, {dna.otherClear} others).</span>
          </div>
          <h3 className="mt-5 text-base font-bold text-ink">Clear results that connect to his care</h3>
          <ul className="mt-2 space-y-3">
            {(dna.notableClear ?? []).map((g) => (
              <li key={g.title} className="rounded-xl bg-paper px-3.5 py-3">
                <p className="text-[15px] font-semibold text-ink">{g.title}</p>
                {g.tests && <p className="mt-0.5 text-sm text-ink2">{g.tests.join(" · ")}</p>}
                {g.whyItMatters && <p className="mt-1 text-sm text-muted">{g.whyItMatters}</p>}
              </li>
            ))}
          </ul>
        </Card>

        {(dna.notCovered || dna.comparison) && (
          <Card title="What this does not tell us" tone="lavender">
            {dna.notCovered && <p className="text-[15px] leading-relaxed text-ink2"><strong className="font-semibold text-ink">Not covered.</strong> {dna.notCovered}</p>}
            {dna.comparison && <p className="mt-3 text-[15px] leading-relaxed text-ink2"><strong className="font-semibold text-ink">Compared with the guidance.</strong> {dna.comparison}</p>}
            <Link href="/visit-prep" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand2 underline-offset-4 hover:underline">The open question for his vet →</Link>
          </Card>
        )}

        <Card title="Other results">
          <ul className="divide-y divide-line">
            {(dna.otherResults ?? []).map((r) => (
              <li key={r.title} className="py-3 first:pt-0 last:pb-0">
                <p className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-[15px] font-semibold text-ink">{r.title}</span><span className="text-sm font-semibold text-ink2">{r.result}</span></p>
                {r.note && <p className="mt-0.5 text-sm text-muted">{r.note}</p>}
              </li>
            ))}
          </ul>
        </Card>

        <p className="text-xs leading-relaxed text-muted">{dna.caveat} Source: a DNA test report, single-source.</p>
      </div>
    </>
  );
}
