import type { Confidence } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08-25" -> "Aug 25, 2026". Works on the date string, never through a timezone. */
export function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function fmtMonthYear(iso?: string | null): string {
  if (!iso) return "";
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function toTime(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export const DAY = 86_400_000;

export const WEEKDAYS = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
];

export const VISIT_LABEL: Record<string, string> = {
  "specialist-consult": "First specialist consult",
  "specialist-recheck": "Specialist recheck",
  "technician-visit": "Technician visit",
  procedure: "Procedure",
  imaging: "Imaging visit",
  emergency: "Emergency visit",
  diagnostics: "Results and diagnostics",
  "primary-care": "Family vet",
  "nutrition-consult": "Nutrition consult",
};

export const MODALITY_LABEL: Record<string, string> = { ultrasound: "Abdominal ultrasound", ct: "CT scan", xray: "X-ray" };

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  confirmed: "Confirmed by a signed vet document",
  "single-source": "One source, not cross-checked",
  conflicting: "Records disagree, needs confirmation",
};

export const TIME_OF_DAY: Record<string, string> = {
  morning: "Morning, after breakfast",
  evening: "Evening",
  bedtime: "Bedtime",
  "as-needed": "As needed",
};

export function ageYears(birthYear: number, now = new Date()): number {
  return now.getFullYear() - birthYear;
}

/** "about Jun 30, 2025" when the records only give an approximate date, otherwise the plain date. */
export function fmtApproxDate(iso?: string | null, approximate?: boolean | null): string {
  const d = fmtDate(iso);
  return d && approximate ? `about ${d}` : d;
}

/**
 * How often a medication is given, in plain words. The records write q12, q24 and "x3 weekly"; this is the one place
 * those become sentences, so the schedule, history, timeline and visit summary never disagree.
 */
export function freqLabel(m: { frequency?: string; days?: string[] }): string {
  const raw = (m.frequency ?? "").trim();
  if (!raw || raw === "-") return "";
  const days = (m.days ?? []).map((k) => WEEKDAYS.find((w) => w.key === k)?.label).filter(Boolean).join(", ");
  return raw
    .replace(/\bq12\b/g, "twice a day (every 12 hours)")
    .replace(/\bq24\b/g, "once a day")
    .replace(/\bx3 weekly\b/g, `3 times a week${days ? ` (${days})` : ""}`);
}

/** "25 mg, twice a day (every 12 hours)". */
export function doseLine(m: { dose?: string; frequency?: string; days?: string[] }): string {
  return [m.dose, freqLabel(m)].filter(Boolean).join(", ");
}

/** Plain-language meaning of each lab code, shown next to the code so "BA-POST" is never a mystery. */
export const LAB_PLAIN: Record<string, string> = {
  ALT: "liver enzyme",
  ALKP: "bile-duct enzyme",
  GGT: "bile-duct enzyme",
  TBIL: "bilirubin, a bile pigment",
  ALB: "albumin, a liver-made protein",
  GLOB: "globulins, immune proteins",
  TP: "total protein",
  "BUN/UREA": "urea, a kidney waste product",
  CREA: "creatinine, a kidney marker",
  GLU: "blood sugar",
  CHOL: "cholesterol",
  TRIG: "triglycerides, a blood fat",
  LIPA: "lipase on the routine panel",
  AMYL: "amylase, a digestive enzyme",
  CPL: "pancreas-specific lipase",
  Ca: "calcium",
  PHOS: "phosphorus",
  Sodium: "sodium",
  Potassium: "potassium",
  Chloride: "chloride",
  AST: "liver and muscle enzyme",
  "BA-PRE": "bile acids before a meal",
  "BA-POST": "bile acids after a meal",
  HCT: "share of blood that is red cells",
  HGB: "hemoglobin, the oxygen carrier",
  RBC: "red blood cells",
  WBC: "white blood cells",
  NEUT: "neutrophils, infection-fighting cells",
  LYMPHS: "lymphocytes, immune cells",
  PLT: "platelets, clotting cells",
};
