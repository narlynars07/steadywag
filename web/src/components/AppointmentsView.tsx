"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { KINDS, KIND_LABEL, deleteAppointment, eraseAppointments, importAppointments, newId, parse, saveAppointment, snapshot, subscribe, toIcs, toJson, type Appointment, type ApptKind } from "@/lib/appointments";
import { fmtDate } from "@/lib/format";
import { useLocalDay } from "@/lib/useLocalDay";

const DOT: Record<ApptKind, string> = { vet: "bg-brand", grooming: "bg-blue", dental: "bg-green-fill", other: "bg-amber-fill" };
const WEEK = ["S", "M", "T", "W", "T", "F", "S"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function whenLabel(a: Appointment) {
  if (!a.time) return fmtDate(a.date);
  const [h, m] = a.time.split(":").map(Number);
  return `${fmtDate(a.date)} · ${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

const BLANK = (date: string): Appointment => ({ id: "", kind: "vet", date, time: "", title: "", place: "", notes: "" });

export interface Suggestion { date: string; title: string; basis: string; notes: string }

export function AppointmentsView({ suggestion }: { suggestion?: Suggestion | null }) {
  const today = useLocalDay();
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const all = parse(raw);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [cursor, setCursor] = useState<{ y: number; m: number } | null>(null);
  const base = today ? { y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 } : null;
  const view = cursor ?? base;
  const [draft, setDraft] = useState<Appointment | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const form = draft ?? BLANK(picked ?? today);
  const editing = !!form.id && all.some((a) => a.id === form.id);
  const set = (patch: Partial<Appointment>) => setDraft({ ...form, ...patch });

  const upcoming = all.filter((a) => a.date >= today);
  // Offer his specialist's own recheck plan until a vet appointment is on the calendar.
  const showSuggestion = !!suggestion && !!today && !upcoming.some((a) => a.kind === "vet");
  const past = all.filter((a) => a.date < today).reverse();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) return;
    saveAppointment({ ...form, id: form.id || newId() });
    setDraft(null); setFlash(editing ? "Updated." : "Saved on this device.");
  };
  const edit = (a: Appointment) => { setDraft(a); setFlash(""); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  // The month grid.
  let cells: (number | null)[] = [];
  let monthLabel = "";
  if (view) {
    const first = new Date(view.y, view.m, 1);
    const days = new Date(view.y, view.m + 1, 0).getDate();
    cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
    monthLabel = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  const move = (delta: number) => { if (!view) return; const d = new Date(view.y, view.m + delta, 1); setCursor({ y: d.getFullYear(), m: d.getMonth() }); };
  const onDay = (d: Appointment[], date: string) => (d.length ? setPicked(date) : (setPicked(date), setDraft(null)));

  const Row = ({ a }: { a: Appointment }) => (
    <li className="flex flex-col gap-2 px-3.5 py-3">
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${DOT[a.kind]}`} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">{KIND_LABEL[a.kind]}{a.title ? ` · ${a.title}` : ""}</p>
          <p className="text-sm text-ink2">{whenLabel(a)}</p>
          {a.place && <p className="text-sm text-muted">{a.place}</p>}
          {a.notes && <p className="mt-0.5 text-sm text-muted">{a.notes}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 pl-5">
        <button type="button" onClick={() => download(`theo-${a.date}-${a.kind}.ics`, "text/calendar", toIcs(a))} className="min-h-11 rounded-lg px-2.5 text-sm font-semibold text-brand2 hover:bg-brand-soft">Add to my calendar</button>
        <button type="button" onClick={() => edit(a)} className="min-h-11 rounded-lg px-2.5 text-sm font-semibold text-brand2 hover:bg-brand-soft">Edit</button>
        <button type="button" onClick={() => { if (window.confirm("Delete this appointment?")) { deleteAppointment(a.id); setFlash("Deleted."); } }} className="min-h-11 rounded-lg px-2.5 text-sm font-semibold text-red hover:bg-red-soft">Delete</button>
      </div>
    </li>
  );

  const shownDay = picked ? all.filter((a) => a.date === picked) : [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink">Appointments</h1>
        <p className="mt-1 text-[15px] leading-relaxed text-ink2">Vet visits, grooming and dental, all in one place. Add each one to your own calendar for a reminder.</p>
      </div>

      <section aria-labelledby="up" className="flex flex-col gap-2">
        <h2 id="up" className="text-lg font-extrabold tracking-tight text-ink">Coming up</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface px-3.5 py-3 text-sm text-muted">Nothing scheduled yet. Add his next visit below.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">{upcoming.map((a) => <Row key={a.id} a={a} />)}</ul>
        )}
      </section>

      {showSuggestion && suggestion && (
        <section aria-label="Suggested from his records" className="rounded-2xl border border-brand bg-brand-soft px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-brand2">Suggested from his records</p>
          <p className="mt-0.5 text-[15px] font-bold text-ink">{suggestion.title} · around {fmtDate(suggestion.date)}</p>
          <p className="text-sm text-ink2">{suggestion.basis} The date is an estimate.</p>
          <button type="button" onClick={() => { setDraft({ ...BLANK(suggestion.date), kind: "vet", title: suggestion.title, notes: suggestion.notes }); setFlash(""); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
            className="mt-1 min-h-11 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand">Use this in the form</button>
        </section>
      )}

      <form ref={formRef} onSubmit={save} className="scroll-mt-24 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4" aria-labelledby="form-h">
        <h2 id="form-h" className="text-lg font-extrabold tracking-tight text-ink">{editing ? "Edit appointment" : "Add an appointment"}</h2>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-ink2">What kind</legend>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={form.kind === k} onClick={() => set({ kind: k })}
                className={`flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold ${form.kind === k ? "border-brand bg-brand text-on-brand" : "border-line bg-paper text-ink"}`}>
                <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${DOT[k]} ring-1 ring-surface`} />{KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink2">Date
            <input type="date" required value={form.date} onChange={(e) => set({ date: e.target.value })} className="h-12 rounded-xl border border-line bg-paper px-3 text-[15px] font-normal text-ink outline-none focus:border-brand" />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink2">Time (optional)
            <input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} className="h-12 rounded-xl border border-line bg-paper px-3 text-[15px] font-normal text-ink outline-none focus:border-brand" />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink2">What is it for?
          <input value={form.title} maxLength={120} placeholder="For example: specialist recheck, fasted" onChange={(e) => set({ title: e.target.value })} className="h-12 rounded-xl border border-line bg-paper px-3 text-[15px] font-normal text-ink outline-none focus:border-brand" />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink2">Where (optional)
          <input value={form.place} maxLength={160} onChange={(e) => set({ place: e.target.value })} className="h-12 rounded-xl border border-line bg-paper px-3 text-[15px] font-normal text-ink outline-none focus:border-brand" />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink2">Notes (optional)
          <textarea rows={2} value={form.notes} maxLength={500} placeholder="For example: no food after 8 PM the night before" onChange={(e) => set({ notes: e.target.value })} className="rounded-xl border border-line bg-paper px-3 py-2.5 text-[15px] font-normal text-ink outline-none focus:border-brand" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={!form.date} className="h-12 flex-1 rounded-2xl bg-brand px-5 text-base font-bold text-on-brand disabled:opacity-40">{editing ? "Update appointment" : "Save appointment"}</button>
          {(draft || picked) && <button type="button" onClick={() => { setDraft(null); setPicked(null); }} className="h-12 rounded-2xl border border-line px-5 text-sm font-semibold text-ink2">Cancel</button>}
        </div>
        <p aria-live="polite" className="min-h-5 text-sm text-green">{flash}</p>
      </form>

      <section aria-labelledby="cal" className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="cal" className="text-lg font-extrabold tracking-tight text-ink">{monthLabel || "Calendar"}</h2>
          <div className="flex gap-1">
            <button type="button" onClick={() => move(-1)} aria-label="Previous month" className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-brand2 hover:bg-brand-soft">‹</button>
            <button type="button" onClick={() => setCursor(null)} className="min-h-11 rounded-full px-3 text-sm font-semibold text-brand2 hover:bg-brand-soft">Today</button>
            <button type="button" onClick={() => move(1)} aria-label="Next month" className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-brand2 hover:bg-brand-soft">›</button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted" aria-hidden="true">{WEEK.map((w, i) => <span key={i}>{w}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {view && cells.map((d, i) => {
            if (!d) return <span key={i} />;
            const date = iso(view.y, view.m, d);
            const here = all.filter((a) => a.date === date);
            return (
              <button key={i} type="button" onClick={() => onDay(here, date)} aria-pressed={picked === date}
                aria-label={`${fmtDate(date)}${here.length ? `, ${here.length} appointment${here.length > 1 ? "s" : ""}` : ""}`}
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl border text-sm ${date === today ? "border-brand font-bold text-brand2" : "border-transparent text-ink"} ${picked === date ? "bg-brand-soft" : "hover:bg-paper"}`}>
                {d}
                <span className="flex h-2 gap-0.5">{here.slice(0, 3).map((a) => <span key={a.id} className={`h-1.5 w-1.5 rounded-full ${DOT[a.kind]}`} />)}</span>
              </button>
            );
          })}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">{KINDS.map((k) => <li key={k} className="flex items-center gap-1.5"><span aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT[k]}`} />{KIND_LABEL[k]}</li>)}</ul>
        {picked && (
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-sm font-semibold text-ink">{fmtDate(picked)}</p>
            {shownDay.length === 0 ? <p className="text-sm text-muted">Nothing on this day. The form above is set to it, so you can add one.</p> : <ul className="divide-y divide-line">{shownDay.map((a) => <Row key={a.id} a={a} />)}</ul>}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <details className="rounded-2xl border border-line bg-surface">
          <summary className="flex min-h-12 cursor-pointer items-center px-3.5 text-[15px] font-semibold text-brand2">Past appointments ({past.length})</summary>
          <ul className="divide-y divide-line border-t border-line">{past.map((a) => <Row key={a.id} a={a} />)}</ul>
        </details>
      )}

      <section className="rounded-2xl border border-line bg-surface px-3.5 py-3">
        <h2 className="text-base font-bold text-ink">Keep a copy</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink2">
          Appointments are saved on this device, in this browser. They stay after you close the page, but clearing site data or using a private window removes them, and they don&apos;t move to another phone.
          Use <strong className="font-semibold">Add to my calendar</strong> to put each one in your own calendar, and download a backup now and then.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={all.length === 0} onClick={() => download("theo-appointments-backup.json", "application/json", toJson(all))} className="min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand disabled:opacity-40">Download backup</button>
          <button type="button" onClick={() => fileRef.current?.click()} className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink">Restore a backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-label="Choose a backup file"
            onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const n = importAppointments(await f.text()); setFlash(n ? `Restored ${n} ${n === 1 ? "appointment" : "appointments"}.` : "That file had no appointments in it."); e.target.value = ""; }} />
          <button type="button" disabled={all.length === 0} onClick={() => { if (window.confirm("Erase every appointment saved on this device?")) { eraseAppointments(); setFlash("Erased."); } }} className="min-h-11 rounded-xl border border-red/40 bg-surface px-4 text-sm font-semibold text-red disabled:opacity-40">Erase all</button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">Nothing is sent or saved on a server.</p>
      </section>
    </div>
  );
}
