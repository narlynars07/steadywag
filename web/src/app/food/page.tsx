import Link from "next/link";
import { FoodChecker } from "@/components/FoodChecker";
import { Card, Chip, Confidence, PageHead } from "@/components/ui";
import { getDietRules, getFoods } from "@/lib/data";
import { CONFIDENCE_LABEL } from "@/lib/format";
import type { DietRule } from "@/lib/types";

export const metadata = { title: "Food · Steadywag" };
export const revalidate = 60;

const KIND: Record<string, { label: string; tone: "red" | "amber" | "brand" | "green" | "neutral" }> = {
  avoid: { label: "Avoid", tone: "red" },
  limit: { label: "Limit", tone: "amber" },
  prefer: { label: "Prefer", tone: "green" },
  consistency: { label: "Keep consistent", tone: "brand" },
};

export default async function FoodPage() {
  const [foods, rules] = await Promise.all([getFoods(), getDietRules()]);
  const recipe = rules.find((r) => r._id === "dietRule-recipe");
  const rest = rules.filter((r) => r._id !== "dietRule-recipe");
  const conflicts = foods.filter((f) => f.role === "conflict");

  return (
    <>
      <PageHead
        title="Food and treats"
        lead="His diet was written by a veterinary nutrition service and adjusted with his specialist. Steadywag checks foods against that plan. It never invents new rules."
      />
      <div className="space-y-6">
        <FoodChecker foods={foods} />

        <Card title="Treats">
          <p className="text-ink">
            Treats stay at or under 42 kcal a day, about 10 percent of his food, and low in copper and sodium, per the August 2023 nutrition plan.
          </p>
        </Card>

        {conflicts.map((f) => (
          <section key={f._id} className="rounded-2xl border-2 border-amber bg-amber-soft p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-amber">{f.name}</h2>
              <Chip tone="amber">{CONFIDENCE_LABEL.conflicting}</Chip>
            </div>
            <p className="mt-2 text-ink">{f.note?.replace(/^Records disagree, needs confirmation\.\s*/, "")}</p>
            <p className="mt-2 text-sm text-ink/80">
              Nothing here picks a side. It is on his <Link href="/visit-prep" className="text-brand2 underline">visit questions</Link>, so his team can say which applies.
            </p>
          </section>
        ))}

        {recipe && (
          <Card title="The recipe, as documented">
            <p className="text-ink">{recipe.rule}</p>
            <p className="mt-2 text-sm text-muted">{recipe.rationale}</p>
            <Confidence value={recipe.source?.confidence} note={recipe.source?.note} />
          </Card>
        )}

        <Card title="The plan&apos;s rules" aside={`${rest.length} rules`}>
          <ul className="divide-y divide-line">
            {rest.map((r: DietRule) => {
              const k = KIND[r.kind ?? ""] ?? { label: "Note", tone: "neutral" as const };
              return (
                <li key={r._id} className="py-3">
                  <details>
                    <summary className="flex cursor-pointer items-center gap-2">
                      <Chip tone={k.tone}>{k.label}</Chip>
                      <span className="font-medium">{r.title}</span>
                    </summary>
                    <p className="mt-2 text-ink">{r.rule}</p>
                    {r.rationale && <p className="mt-1 text-sm text-muted">Why: {r.rationale}</p>}
                    <Confidence value={r.source?.confidence === "confirmed" ? undefined : r.source?.confidence} note={r.source?.note} />
                  </details>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
