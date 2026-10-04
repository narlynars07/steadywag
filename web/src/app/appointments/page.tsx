import { AppointmentsView, type Suggestion } from "@/components/AppointmentsView";
import { getVisits } from "@/lib/data";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Appointments · Steadywag" };
export const revalidate = 60;

/** His specialist's own plan, turned into a suggested date: the last recheck visit plus the interval it asked for. The date is an estimate. */
function suggest(last: { date: string; nextRecheck?: string; recommendations?: string[] } | undefined): Suggestion | null {
  const n = Number(/(\d+)\s*month/i.exec(last?.nextRecheck ?? "")?.[1]);
  if (!last || !n) return null;
  const d = new Date(`${last.date}T12:00:00`);
  d.setMonth(d.getMonth() + n);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    date,
    title: `Specialist recheck${/fast/i.test(`${last.nextRecheck ?? ""} ${(last.recommendations ?? []).join(" ")}`) ? ", fasted" : ""}`,
    basis: `His ${fmtDate(last.date)} report says to recheck in ${last.nextRecheck?.replace(/^about /i, "")}.`,
    notes: "Date is an estimate from his last report. Confirm it with his team.",
  };
}

export default async function AppointmentsPage() {
  const visits = await getVisits();
  const last = visits.find((v) => v.visitType === "specialist-recheck");
  return <AppointmentsView suggestion={suggest(last)} />;
}
