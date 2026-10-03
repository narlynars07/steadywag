import { AskApp } from "@/components/AskApp";
import { getDog, getMedications, getVisits, getWeights } from "@/lib/data";
import { ageYears, fmtDate } from "@/lib/format";

export const revalidate = 60;

export default async function AskPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 300) : undefined;
  const go = sp.go === "1";
  const [dog, meds, weights, visits] = await Promise.all([getDog(), getMedications(), getWeights(), getVisits()]);
  const lastWeight = weights.at(-1);
  const lastVisit = visits.find((v) => v.visitType === "specialist-recheck");
  const notGiven = meds.find((m) => m.status === "listed-not-given");
  return (
    <AskApp
      initialQuestion={q}
      autorun={go}
      profile={{
        name: "Theo",
        line: `${ageYears(dog.birthYear)}-year-old ${dog.breed}${lastWeight ? ` · ${lastWeight.weightKg} kg` : ""}`,
        status: lastVisit ? `Doing very well at his ${fmtDate(lastVisit.date)} visit` : "Records on file",
        alert: notGiven?.name,
        lastVisitDate: lastVisit?.date ?? null,
      }}
    />
  );
}
