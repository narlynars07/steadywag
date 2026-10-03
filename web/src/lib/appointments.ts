/**
 * Upcoming and past appointments (vet, grooming, dental, other). They live only in this browser (localStorage, with a memory
 * fallback if the browser blocks storage), the same way the daily check-ins do. Nothing is sent anywhere.
 */
export type ApptKind = "vet" | "grooming" | "dental" | "other";

export interface Appointment {
  id: string;
  kind: ApptKind;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM, or "" for an all-day entry
  title: string; // what it is for, for example "Specialist recheck"
  place: string;
  notes: string;
}

export const KIND_LABEL: Record<ApptKind, string> = { vet: "Vet", grooming: "Grooming", dental: "Dental", other: "Other" };
export const KINDS = Object.keys(KIND_LABEL) as ApptKind[];

export const STORE_KEY = "steadywag.appointments.v1";
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

const sortAsc = (a: Appointment, b: Appointment) => `${a.date} ${a.time || "00:00"}`.localeCompare(`${b.date} ${b.time || "00:00"}`);

function clean(e: unknown): Appointment | null {
  if (!e || typeof e !== "object") return null;
  const o = e as Record<string, unknown>;
  if (typeof o.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return null;
  const kind = (KINDS as string[]).includes(o.kind as string) ? (o.kind as ApptKind) : "other";
  const time = typeof o.time === "string" && /^\d{2}:\d{2}$/.test(o.time) ? o.time : "";
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  return { id: typeof o.id === "string" && o.id ? o.id.slice(0, 40) : `a${Date.now()}${Math.random().toString(36).slice(2, 6)}`, kind, date: o.date, time, title: str(o.title, 120), place: str(o.place, 160), notes: str(o.notes, 500) };
}

export function parse(raw: string): Appointment[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(clean).filter((a): a is Appointment => !!a).sort(sortAsc) : [];
  } catch { return []; }
}

/** Adds an appointment, or replaces the one with the same id. */
export function saveAppointment(a: Appointment) {
  const rest = parse(snapshot()).filter((x) => x.id !== a.id);
  write(JSON.stringify([...rest, a].sort(sortAsc)));
}

export function deleteAppointment(id: string) {
  const rest = parse(snapshot()).filter((x) => x.id !== id);
  write(rest.length ? JSON.stringify(rest) : "");
}

export function eraseAppointments() { write(""); }

export const newId = () => `a${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

/** Reads a backup file back in. Only well-formed entries are kept. Returns how many were restored. */
export function importAppointments(text: string): number {
  let list: unknown;
  try { list = JSON.parse(text); } catch { return 0; }
  if (!Array.isArray(list)) return 0;
  const incoming = list.map(clean).filter((a): a is Appointment => !!a);
  if (!incoming.length) return 0;
  const keep = parse(snapshot()).filter((x) => !incoming.some((i) => i.id === x.id));
  write(JSON.stringify([...keep, ...incoming].sort(sortAsc)));
  return incoming.length;
}

export const toJson = (all: Appointment[]) => JSON.stringify(all, null, 2);

/** The next appointment on or after today (a date, YYYY-MM-DD). */
export function nextAppointment(all: Appointment[], today: string): Appointment | null {
  return all.find((a) => a.date >= today) ?? null;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\r?\n/g, "\\n");

/** A calendar file (.ics) for one appointment, so it can be added to Google, Apple or Outlook calendar with a reminder the day before. */
export function toIcs(a: Appointment): string {
  const d = a.date.replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  let when: string;
  if (a.time) {
    const [h, m] = a.time.split(":").map(Number);
    const end = new Date(2000, 0, 1, h + 1, m);
    const pad = (n: number) => String(n).padStart(2, "0");
    when = `DTSTART:${d}T${pad(h)}${pad(m)}00\r\nDTEND:${d}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
  } else {
    const next = new Date(`${a.date}T12:00:00`); next.setDate(next.getDate() + 1);
    const nd = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, "0")}${String(next.getDate()).padStart(2, "0")}`;
    when = `DTSTART;VALUE=DATE:${d}\r\nDTEND;VALUE=DATE:${nd}`;
  }
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Steadywag//Appointments//EN", "BEGIN:VEVENT",
    `UID:${a.id}@steadywag`, `DTSTAMP:${stamp}`, when,
    `SUMMARY:${esc(`Theo: ${KIND_LABEL[a.kind]}${a.title ? ` - ${a.title}` : ""}`)}`,
    ...(a.place ? [`LOCATION:${esc(a.place)}`] : []),
    ...(a.notes ? [`DESCRIPTION:${esc(a.notes)}`] : []),
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Theo's appointment is tomorrow", "TRIGGER:-P1D", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}
