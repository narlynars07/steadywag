import { Chat } from "@/components/Chat";
import { PageHead } from "@/components/ui";

export const metadata = { title: "Ask the records · Steadywag" };

export default async function AskPage({ searchParams }: PageProps<"/ask">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 300) : undefined;
  return (
    <>
      <PageHead
        title="Ask the records"
        lead="Answers come only from Theodore's records and cited veterinary guidance, and each one shows the sources it was built from. Steadywag points out what the records don't say, and never replaces a vet."
      />
      <div className="mb-4 rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber">
        Not veterinary advice. If your dog isn&apos;t eating, is vomiting repeatedly, has blood or black stool, yellow gums, or seems very unwell, contact your vet or an emergency vet now.
      </div>
      <Chat initialQuestion={q} />
    </>
  );
}
