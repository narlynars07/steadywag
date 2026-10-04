/**
 * Daily check-ins. They live only in this browser (localStorage, with a memory fallback if the browser blocks storage).
 * Nothing is sent anywhere unless the family asks for a visit summary, and then only the entries since his last visit.
 */
export type Appetite = "Ate all" | "Some" | "None";
export type Energy = "Normal" | "Lower than usual";
export type YesNo = "Yes" | "No";
export type MedsGiven = "All given" | "Missed one";
export type Drinking = "Less than usual" | "Normal" | "More than usual";
export type Seen = "None seen" | "Seen";
export const ACTIVITIES = ["Walk", "Played or ran", "Puzzle or sniff game", "Mostly rested"] as const;
export type Activity = (typeof ACTIVITIES)[number];
export const YELLOW_PLACES = ["Eyes", "Ear flaps", "Gums"] as const;
export type YellowPlace = (typeof YELLOW_PLACES)[number];

export interface CheckIn {
  date: string; // YYYY-MM-DD, the family's own day
  appetite: Appetite | null;
  /** Drinking compared with his usual. His vet asks about this at every visit. */
  drinking: Drinking | null;
  energy: Energy | null;
  stool: number | null; // 1 to 7
  vomit: YesNo | null;
  meds: MedsGiven | null;
  /** What he did today. Any combination. Older entries have none. */
  activity: Activity[];
  /** Bruising under the skin. His vet asks about this at every visit. */
  bruising: Seen | null;
  /** A yellow tint (jaundice), and where it was seen. His vet asks about this at every visit. */
  yellow: Seen | null;
  yellowWhere: YellowPlace[];
  note: string;
}

export const EMPTY_CHECKIN = (date: string): CheckIn => ({
  date, appetite: null, drinking: null, energy: null, stool: null, vomit: null, meds: null, activity: [], bruising: null, yellow: null, yellowWhere: [], note: "",
});

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

const APPETITE = ["Ate all", "Some", "None"] as const, ENERGY = ["Normal", "Lower than usual"] as const, YESNO = ["Yes", "No"] as const, MEDS = ["All given", "Missed one"] as const;
const DRINKING = ["Less than usual", "Normal", "More than usual"] as const, SEEN = ["None seen", "Seen"] as const;
const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | null => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null);
const pickMany = <T extends string>(v: unknown, allowed: readonly T[]): T[] => (Array.isArray(v) ? v.filter((a): a is T => typeof a === "string" && (allowed as readonly string[]).includes(a)) : []);

/** Turns anything read from storage or a backup file into a well-formed entry. Older entries without the newer fields still load. */
function clean(e: unknown): CheckIn | null {
  if (!e || typeof e !== "object") return null;
  const o = e as Record<string, unknown>;
  if (typeof o.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return null;
  const stool = typeof o.stool === "number" && Number.isInteger(o.stool) && o.stool >= 1 && o.stool <= 7 ? o.stool : null;
  const yellow = pick(o.yellow, SEEN);
  return {
    date: o.date, appetite: pick(o.appetite, APPETITE), drinking: pick(o.drinking, DRINKING), energy: pick(o.energy, ENERGY), stool,
    vomit: pick(o.vomit, YESNO), meds: pick(o.meds, MEDS), activity: pickMany(o.activity, ACTIVITIES),
    bruising: pick(o.bruising, SEEN), yellow, yellowWhere: yellow === "Seen" ? pickMany(o.yellowWhere, YELLOW_PLACES) : [],
    note: typeof o.note === "string" ? o.note.slice(0, 200) : "",
  };
}

const newestFirst = (a: CheckIn, b: CheckIn) => b.date.localeCompare(a.date);

export function parse(raw: string): CheckIn[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(clean).filter((e): e is CheckIn => !!e).sort(newestFirst) : [];
  } catch { return []; }
}

/** One entry per day: saving today again replaces today. */
export function saveCheckIn(entry: CheckIn) {
  const all = parse(snapshot()).filter((e) => e.date !== entry.date);
  write(JSON.stringify([entry, ...all].sort(newestFirst)));
}

export function eraseCheckIns() { write(""); }

/** Removes one day's entry. */
export function deleteCheckIn(date: string) {
  const rest = parse(snapshot()).filter((e) => e.date !== date);
  write(rest.length ? JSON.stringify(rest) : "");
}

/** Reads a backup file back in. Only well-formed entries are kept, and a restored day replaces the same day already saved. Returns how many were restored. */
export function importCheckIns(text: string): number {
  let list: unknown;
  try { list = JSON.parse(text); } catch { return 0; }
  if (!Array.isArray(list)) return 0;
  const incoming = list.map(clean).filter((e): e is CheckIn => !!e);
  if (!incoming.length) return 0;
  const keep = parse(snapshot()).filter((e) => !incoming.some((c) => c.date === e.date));
  write(JSON.stringify([...incoming, ...keep].sort(newestFirst)));
  return incoming.length;
}

/** A backup file the family can keep and restore from. */
export function toJson(all: CheckIn[]): string { return JSON.stringify(all, null, 2); }

/** Check-ins on or after a date, newest first, capped to what a request may carry. */
export function checkInsSince(all: CheckIn[], sinceIso: string | null, limit = 14): CheckIn[] {
  return all.filter((e) => !sinceIso || e.date > sinceIso).slice(0, limit);
}

export function toCsv(all: CheckIn[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [["Date", "Appetite", "Drinking", "Energy", "Stool score", "Vomiting", "Meds", "Activity", "Bruising", "Yellow tint", "Yellow where", "Note"].map(esc).join(",")];
  for (const e of [...all].reverse()) {
    rows.push([e.date, e.appetite ?? "", e.drinking ?? "", e.energy ?? "", e.stool ? String(e.stool) : "", e.vomit ?? "", e.meds ?? "", e.activity.join("; "), e.bruising ?? "", e.yellow ?? "", e.yellowWhere.join("; "), e.note].map((x) => esc(x)).join(","));
  }
  return rows.join("\r\n");
}

/** Plain-language line for one entry, used in the visit summary. */
export function describe(e: CheckIn): string {
  const parts: string[] = [];
  if (e.appetite) parts.push(`appetite ${e.appetite.toLowerCase()}`);
  if (e.drinking) parts.push(`drinking ${e.drinking.toLowerCase()}`);
  if (e.energy) parts.push(`energy ${e.energy.toLowerCase()}`);
  if (e.stool) parts.push(`stool score ${e.stool}`);
  if (e.vomit) parts.push(e.vomit === "Yes" ? "vomited" : "no vomiting");
  if (e.meds) parts.push(e.meds === "All given" ? "all meds given" : "a med was missed");
  if (e.activity.length) parts.push(`activity: ${e.activity.map((a) => a.toLowerCase()).join(", ")}`);
  if (e.bruising) parts.push(e.bruising === "Seen" ? "bruising seen" : "no bruising seen");
  if (e.yellow) parts.push(e.yellow === "Seen" ? `yellow tint seen${e.yellowWhere.length ? ` in ${e.yellowWhere.map((p) => p.toLowerCase()).join(", ")}` : ""}` : "no yellow tint seen");
  return parts.join(", ") + (e.note ? `. Note: "${e.note}"` : "");
}

/**
 * The counts his vet asks about at every visit, across the days in a list: eating, drinking, yellow tint, bruising. Only days where the
 * question was answered are counted, so "3 of 9 days" never claims more than was recorded. These are the family's own observations.
 */
export function summarize(list: CheckIn[]): string[] {
  const out: string[] = [];
  const of = (answered: CheckIn[], hit: (e: CheckIn) => boolean, label: string) => {
    const n = answered.filter(hit).length;
    if (answered.length) out.push(`${label}: ${n} of ${answered.length} ${answered.length === 1 ? "day" : "days"}`);
  };
  const ate = list.filter((e) => e.appetite);
  of(ate, (e) => e.appetite !== "Ate all", "Ate less than all his food");
  const drank = list.filter((e) => e.drinking);
  of(drank, (e) => e.drinking === "More than usual", "Drinking more than usual");
  of(drank, (e) => e.drinking === "Less than usual", "Drinking less than usual");
  of(list.filter((e) => e.yellow), (e) => e.yellow === "Seen", "Yellow tint seen (eyes, ear flaps or gums)");
  of(list.filter((e) => e.bruising), (e) => e.bruising === "Seen", "Bruising seen");
  return out;
}
