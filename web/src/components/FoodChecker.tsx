"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, Chip } from "./ui";
import { CONFIDENCE_LABEL } from "@/lib/format";
import type { Food } from "@/lib/types";

const DAILY_TREAT_CAP_KCAL = 42;

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export function FoodChecker({ foods }: { foods: Food[] }) {
  const [query, setQuery] = useState("");

  const q = norm(query);
  const { matches, partial } = useMemo(() => {
    if (!q) return { matches: [] as Food[], partial: false };
    const words = q.split(" ");
    const has = (f: Food, w: string) => {
      const hay = norm(`${f.name} ${f.category ?? ""}`);
      return hay.includes(w) || hay.includes(w.replace(/(ies|s)$/, "")) || hay.includes(w.replace(/y$/, "ies"));
    };
    const exact = foods.filter((f) => words.every((w) => has(f, w)));
    if (exact.length) return { matches: exact, partial: false };
    // No food matches every word ("freeze dried salmon"): show items sharing a meaningful word, labelled as related.
    const long = words.filter((w) => w.length >= 5);
    return { matches: long.length ? foods.filter((f) => long.some((w) => has(f, w))) : [], partial: true };
  }, [q, foods]);

  return (
    <Card title="Can he have this?">
      <label htmlFor="food-q" className="mb-1 block text-sm text-muted">Type a food or treat</label>
      <input
        id="food-q"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="blueberries, salmon, cheese, jerky…"
        className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-base outline-none focus:border-brand"
        autoComplete="off"
      />
      <p className="mt-2 text-xs text-muted">Answers come only from the diet plan his specialist and the nutrition service wrote. Steadywag will not guess about foods that aren&apos;t in it.</p>

      {q && (
        <div className="mt-4 space-y-3" aria-live="polite">
          {matches.length > 0 ? (
            <>
              {partial && (
                <p className="text-sm text-muted">
                  Nothing in his plan matches &ldquo;{query}&rdquo; exactly. These are the closest related entries. Check they really apply, and ask his team if unsure.
                </p>
              )}
              {matches.map((f) => <Verdict key={f._id} food={f} />)}
            </>
          ) : (
            <div className="rounded-xl border-2 border-amber bg-amber-soft p-4">
              <div className="mb-1 flex items-center gap-2"><Chip tone="amber">Not in his plan</Chip><strong>{query}</strong></div>
              <p className="text-sm text-ink">
                His plan doesn&apos;t cover this, so Steadywag can&apos;t say whether it&apos;s okay. What the plan does say: treats stay low in copper and sodium and under {DAILY_TREAT_CAP_KCAL} kcal a day, organ meats and many seafoods are avoided, and his specialist has recommended lowering the fat. Best next step: ask his team.
              </p>
              <Link href={`/ask?q=${encodeURIComponent(`Can Theodore have ${query}? What does his plan say?`)}`} className="mt-3 inline-block rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-on-brand">
                Ask the records what the plan says
              </Link>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Verdict({ food }: { food: Food }) {
  if (food.role === "avoid") {
    return (
      <div className="rounded-xl border-2 border-red bg-red-soft p-4">
        <div className="mb-1 flex items-center gap-2"><Chip tone="red">Avoid</Chip><strong>{food.name}</strong></div>
        <p className="text-sm text-ink">{food.avoidReason}</p>
        <p className="mt-1 text-xs text-muted">From the nutrition consult&apos;s avoid list.</p>
      </div>
    );
  }
  if (food.role === "conflict") {
    return (
      <div className="rounded-xl border-2 border-amber bg-amber-soft p-4">
        <div className="mb-1 flex items-center gap-2"><Chip tone="amber">{CONFIDENCE_LABEL.conflicting}</Chip><strong>{food.name}</strong></div>
        <p className="text-sm text-ink">{food.note?.replace(/^Records disagree, needs confirmation\.\s*/, "")}</p>
        <p className="mt-1 text-xs text-muted">{food.dataSource}</p>
      </div>
    );
  }
  if (food.role === "approved-treat") {
    return (
      <div className="rounded-xl border-2 border-green bg-green-soft p-4">
        <div className="mb-1 flex items-center gap-2"><Chip tone="green">Approved treat</Chip><strong>{food.name}</strong></div>
        <p className="text-sm text-ink">
          The plan lists <strong>{food.servingDescription}</strong> as a treat, about <strong>{food.servingKcal} kcal</strong>. It counts toward the {DAILY_TREAT_CAP_KCAL} kcal daily treat limit.
        </p>
        <Nutrients food={food} />
      </div>
    );
  }
  return (
    <div className="rounded-xl border-2 border-brand bg-brand-soft p-4">
      <div className="mb-1 flex items-center gap-2"><Chip tone="brand">In his recipe</Chip><strong>{food.name}</strong></div>
      <p className="text-sm text-ink">{food.note ?? "Part of the formulated recipe."}</p>
      <Nutrients food={food} />
    </div>
  );
}

function Nutrients({ food }: { food: Food }) {
  if (food.kcalPer100g == null) return null;
  return (
    <>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-muted">Calories / 100 g</dt><dd>{food.kcalPer100g}</dd></div>
        <div><dt className="text-xs text-muted">Fat / 100 g</dt><dd>{food.fatGPer100g} g</dd></div>
        <div><dt className="text-xs text-muted">Protein / 100 g</dt><dd>{food.proteinGPer100g} g</dd></div>
        <div><dt className="text-xs text-muted">Copper / 100 g</dt><dd>{food.copperMgPer100g} mg</dd></div>
      </dl>
      <p className="mt-2 text-xs text-muted">{food.dataSource}</p>
    </>
  );
}
