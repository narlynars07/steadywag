import { CheckInForm } from "@/components/CheckInForm";
import { getFecalScale } from "@/lib/data";

export const metadata = { title: "Check-in · Steadywag" };
export const revalidate = 60;

export default async function CheckInPage() {
  return <CheckInForm scale={await getFecalScale()} />;
}
