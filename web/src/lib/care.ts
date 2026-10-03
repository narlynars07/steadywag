import type { CareRoutine, Medication } from "./types";

/** The four kinds of source a fact can come from. The UI and the agent always say which. */
export const SOURCE_LABEL = {
  vet: "Vet records",
  routine: "Family routine",
  recall: "Family recall",
  observation: "Family observations",
  checkin: "Your check-ins",
} as const;
export type SourceKind = keyof typeof SOURCE_LABEL;

/** The times the family's routine gives a medication ("about 8:30 AM, after breakfast"). Empty when the routine has none. */
export function routineTimes(medId: string, routine: CareRoutine[]): string[] {
  return routine
    .filter((r) => r.kind === "medication" && r.items?.some((i) => i.medicationId === medId))
    .map((r) => r.timeLabel ?? r.title);
}

/** Is a medication due on this weekday key ("mon".."sun")? Daily medications have no days. */
export function dueOn(m: Pick<Medication, "days">, dayKey: string): boolean {
  return !m.days?.length || m.days.includes(dayKey);
}

/** What his vet's records say about when to give it, in the vet's own terms. Empty when they say nothing. */
export function vetTiming(m: Pick<Medication, "timeOfDay" | "timingNote">): string {
  const parts: string[] = [];
  if (m.timeOfDay === "morning") parts.push("AM, per his medication list");
  if (m.timingNote && !m.timeOfDay) parts.push(m.timingNote);
  return parts.join(" ");
}
