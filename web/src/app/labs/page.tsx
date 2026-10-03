import { LabExplorer } from "@/components/LabExplorer";
import { PageHead } from "@/components/ui";
import { getAllLabResults, getLabTests } from "@/lib/data";

export const metadata = { title: "Labs · Steadywag" };
export const revalidate = 60;

export default async function LabsPage() {
  const [tests, results] = await Promise.all([getLabTests(), getAllLabResults()]);
  return (
    <>
      <PageHead
        title="Lab trends"
        lead="Every result on file, in plain language, against its reference range. Results from before the referral were reported by the family vet and may lack a range."
      />
      <LabExplorer tests={tests} results={results} />
    </>
  );
}
