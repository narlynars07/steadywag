import { TodayView } from "@/components/TodayView";
import { getCareRoutine, getDietRules, getFoods, getMedications } from "@/lib/data";

export const metadata = { title: "Today · Steadywag" };
export const revalidate = 60;

export default async function TodayPage() {
  const [routine, meds, rules, foods] = await Promise.all([getCareRoutine(), getMedications(), getDietRules(), getFoods()]);
  const conflict = foods.find((f) => f.role === "conflict");
  return (
    <TodayView
      data={{
        routine,
        meds: meds.filter((m) => m.status === "active" || m.status === "listed-not-given"),
        notGiven: meds.find((m) => m.status === "listed-not-given")?.name,
        treatRule: rules.find((r) => r._id === "dietRule-treat-allowance")?.rule,
        recipe: rules.find((r) => r._id === "dietRule-recipe")?.rule,
        conflict: conflict ? { name: conflict.name, note: conflict.note ?? "" } : undefined,
      }}
    />
  );
}
