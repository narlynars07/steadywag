import { LabExplorer } from "@/components/LabExplorer";
import { LabSummary } from "@/components/LabSummary";
import { PageHead } from "@/components/ui";
import { getAllLabResults, getGaps, getLabTests } from "@/lib/data";

export const metadata = { title: "Labs · Steadywag" };
export const revalidate = 60;

export default async function LabsPage() {
  const [tests, results, gaps] = await Promise.all([getLabTests(), getAllLabResults(), getGaps()]);
  const trigGap = gaps.find((g) => /triglyceride/i.test(g.title));
  return (
    <>
      <PageHead
        title="Lab trends"
        lead="Every result on file, in plain language, against its reference range. Results from before the referral were reported by the family vet and may lack a range."
      />
      <LabSummary tests={tests} results={results} missingNote={trigGap ? `${trigGap.title}.` : undefined} />
      <h2 className="mb-3 text-xl font-extrabold tracking-tight text-ink">Every test, one at a time</h2>
      <LabExplorer tests={tests} results={results} />
    </>
  );
}
