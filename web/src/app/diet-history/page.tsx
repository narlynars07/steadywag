import { DietHistory, NOT_IN_RECORDS, type Form } from "@/components/DietHistory";
import { PageHead } from "@/components/ui";
import { getDietHistory, getDog, getMedications } from "@/lib/data";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Diet history · Steadywag" };
export const revalidate = 60;

export default async function DietHistoryPage() {
  const [dog, meds, history] = await Promise.all([getDog(), getMedications(), getDietHistory()]);

  const current = [...new Set(meds.filter((m) => m.status === "active").map((m) => m.name))];

  // His adult diets come from Sanity (dietHistoryEntry), each tagged as family recall or a medical record.
  const adults = history.filter((h) => h.section === "adult");
  const adultRows = adults.map((h) => ({
    type: h.dietType ?? "",
    brand: h.brand ?? "",
    flavor: h.formula ?? "",
    from: h.startedOn ?? "",
    to: h.endedOn ?? "",
  }));
  const provenance = adults.map((h, i) =>
    h.origin === "family-recall"
      ? `Row ${i + 1}: family recall, as the family told the nutrition service${h.source?.documentDate ? ` (written into the ${fmtDate(h.source.documentDate)} consult)` : ""}. Not a medical finding, and not checked against receipts or labels.`
      : `Row ${i + 1}: from a medical record${h.source?.documentDate ? ` (the ${fmtDate(h.source.documentDate)} nutrition consult)` : ""}.`,
  );

  // Everything prefilled here is already in his de-identified medical records:
  // the January 20 and February 17, 2023 specialist reports, the March 10, 2023 biopsy report,
  // the nutrition consult of August 2023, the 9/29/2023 report (zinc removed) and the medication list.
  // Questions his records say nothing about are marked "Not in his records" rather than left blank or guessed.
  // The family's recalled answers will replace those later, labeled as coming from the family.
  const born = dog?.birthYear;
  const defaults: Form = {
    a: {
      dogName: dog?.name ?? "",
      // Only his birth year is on file, so the age on the biopsy date is a one-year range.
      ageAtBiopsy: born ? `About ${2023 - born - 1} to ${2023 - born} years old (born ${born}; biopsy on March 10, 2023)` : "",
      puppyDiet: NOT_IN_RECORDS,
      puppyMonths: NOT_IN_RECORDS,
      transitionAge: NOT_IN_RECORDS,
      "chew.meat": NOT_IN_RECORDS,
      "chew.liver": NOT_IN_RECORDS,
      "chew.bully": NOT_IN_RECORDS,
      "chew.hooves": NOT_IN_RECORDS,
      "chew.rawhide": NOT_IN_RECORDS,
      biopsyPrompt: "enzymes",
      symptomatic: "No symptoms (January 2023 specialist report).",
      medHistory:
        "ALT was 366 in November 2022, 863 in December 2022 and above 1000 on January 13, 2023, with no symptoms. A liver supplement (Denamarin) was started in November 2022. After imaging and tests, a laparoscopic liver biopsy on March 10, 2023 showed mild chronic hepatitis with copper accumulating in liver cells (959 micrograms per gram, dry weight): copper storage disease.",
      chelation: "yes",
      otherMeds: current.length
        ? `Current medications in his records: ${current.join(", ")}. Heartworm, flea and tick prevention are not in his records.`
        : "",
    },
    rows: {
      adult: adultRows,
      treats: [
        {
          name: "Before diagnosis: partly in his records (the August 2023 nutrition consult lists some treats and human foods).",
          notes: "The family will add the full list.",
        },
      ],
      supps: [
        { name: "Denamarin (liver support)", duration: "Started November 2022. Not on his list after early 2023.", source: "" },
        { name: "Vitamin B12", duration: "Injections in early 2023, then daily by mouth. Not listed after 2023.", source: "" },
        { name: "Zinc (part of the original home-cooked recipe)", duration: "August to September 29, 2023. Stopped on the specialist's advice.", source: "" },
        { name: "Multivitamin and fish oil (part of the home-cooked recipe)", duration: "Since August 2023", source: "From the nutrition service recipe" },
      ],
    },
  };

  return (
    <>
      <PageHead
        title="Diet history"
        lead="A full diet history is one of the first things a liver specialist asks for, and most families can't answer it from memory. Use this form to build one for your own dog: fill in what you know, mark what you don't remember, then print it or send it to your vet."
      />
      <p className="-mt-3 mb-6 max-w-2xl text-ink2">
        Researchers are studying whether dietary copper contributes to liver copper buildup, which is why the diet <strong className="font-semibold">before</strong> diagnosis matters most.
      </p>
      <DietHistory defaults={defaults} provenance={provenance} />
    </>
  );
}
