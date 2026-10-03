/**
 * Daily check-ins. They live only in this browser (localStorage, with a memory fallback if the browser blocks storage).
 * Nothing is sent anywhere unless the family asks for a visit summary, and then only the entries since his last visit.
 */
export type Appetite = "Ate all" | "Some" | "None";
export type Energy = "Normal" | "Lower than usual";
export type YesNo = "Yes" | "No";
export type MedsGiven = "All given" | "Missed one";

export interface CheckIn {
  date: string; // YYYY-MM-DD, the family's own day
  appetite: Appetite | null;
  energy: Energy | null;
  stool: number | null; // 1 to 7
  vomit: YesNo | null;
  meds: MedsGiven | null;
  note: string;
}

export const EMPTY_CHECKIN = (date: string): CheckIn => ({ date, appetite: null, energy: null, stool: null, vomit: null, meds: null, note: "" });

export const STORE_KEY = "steadywag.checkins.v1";
let memory: string | undefined;
const listeners = new Set<() => void>();

export function snapshot(): string {
  if (memory !== undefined) return memory;
  try { return localStorage.getItem(STORE_KEY) ?? ""; } catch { return ""; }
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
}

function write(value: string) {
  memory = value;
  try { if (value) localStorage.setItem(STORE_KEY, value); else localStorage.removeItem(STORE_KEY); } catch { /* storage blocked: memory still holds it for this visit */ }
  listeners.forEach((l) => l());
}

export function parse(raw: string): CheckIn[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((e): e is CheckIn => !!e && typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch { return []; }
}

/** One entry per day: saving today again replaces today. */
export function saveCheckIn(entry: CheckIn) {
  const all = parse(snapshot()).filter((e) => e.date !== entry.date);
  write(JSON.stringify([entry, ...all].sort((a, b) => b.date.localeCompare(a.date))));
}

export function eraseCheckIns() { write(""); }

/** Removes one day's entry. */
export function deleteCheckIn(date: string) {
  const rest = parse(snapshot()).filter((e) => e.date !== date);
  write(rest.length ? JSON.stringify(rest) : "");
}

const APPETITE = ["Ate all", "Some", "None"] as const, ENERGY = ["Normal", "Lower than usual"] as const, YESNO = ["Yes", "No"] as const, MEDS = ["All given", "Missed one"] as const;
const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | null => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null);

/** Reads a backup file back in. Only well-formed entries are kept, and a restored day replaces the same day already saved. Returns how many were restored. */
export function importCheckIns(text: string): number {
  let list: unknown;
  try { list = JSON.parse(text); } catch { return 0; }
  if (!Array.isArray(list)) return 0;
  const clean: CheckIn[] = [];
  for (const e of list) {
    if (!e || typeof e !== "object" || typeof (e as CheckIn).date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test((e as CheckIn).date)) continue;
    const o = e as Record<string, unknown>;
    const stool = typeof o.stool === "number" && Number.isInteger(o.stool) && o.stool >= 1 && o.stool <= 7 ? o.stool : null;
    clean.push({ date: o.date as string, appetite: pick(o.appetite, APPETITE), energy: pick(o.energy, ENERGY), stool, vomit: pick(o.vomit, YESNO), meds: pick(o.meds, MEDS), note: typeof o.note === "string" ? o.note.slice(0, 200) : "" });
  }
  if (!clean.length) return 0;
  const keep = parse(snapshot()).filter((e) => !clean.some((c) => c.date === e.date));
  write(JSON.stringify([...clean, ...keep].sort((a, b) => b.date.localeCompare(a.date))));
  return clean.length;
}

/** A backup file the family can keep and restore from. */
export function toJson(all: CheckIn[]): string { return JSON.stringify(all, null, 2); }

/** Check-ins on or after a date, newest first, capped to what a request may carry. */
export function checkInsSince(all: CheckIn[], sinceIso: string | null, limit = 14): CheckIn[] {
  return all.filter((e) => !sinceIso || e.date > sinceIso).slice(0, limit);
}

export function toCsv(all: CheckIn[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [["Date", "Appetite", "Energy", "Stool score", "Vomiting", "Meds", "Note"].map(esc).join(",")];
  for (const e of [...all].reverse()) rows.push([e.date, e.appetite ?? "", e.energy ?? "", e.stool ? String(e.stool) : "", e.vomit ?? "", e.meds ?? "", e.note].map((x) => esc(x)).join(","));
  return rows.join("\r\n");
}

/** Plain-language line for one entry, used in the visit summary. */
export function describe(e: CheckIn): string {
  const parts: string[] = [];
  if (e.appetite) parts.push(`appetite ${e.appetite.toLowerCase()}`);
  if (e.energy) parts.push(`energy ${e.energy.toLowerCase()}`);
  if (e.stool) parts.push(`stool score ${e.stool}`);
  if (e.vomit) parts.push(e.vomit === "Yes" ? "vomited" : "no vomiting");
  if (e.meds) parts.push(e.meds === "All given" ? "all meds given" : "a med was missed");
  return parts.join(", ") + (e.note ? `. Note: "${e.note}"` : "");
}
