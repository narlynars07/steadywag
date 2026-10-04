"use client";

import Image from "next/image";
import { useRef, useState, useSyncExternalStore } from "react";
import { ACTIVITIES, YELLOW_PLACES, EMPTY_CHECKIN, deleteCheckIn, describe, eraseCheckIns, importCheckIns, parse, saveCheckIn, snapshot, subscribe, toCsv, toJson, type CheckIn } from "@/lib/checkins";
import { DeviceOnlyNote } from "./DeviceOnlyNote";
import { fmtDate } from "@/lib/format";
import { useLocalDay } from "@/lib/useLocalDay";

const STOOL_TITLES = ["Hard pellets", "Firm and formed", "Moist and formed", "Soft log", "Soft pile", "Mushy", "Watery"];

function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: T[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[13px] font-semibold text-ink2">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)}
            className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${value === o ? "border-brand bg-brand text-on-brand" : "border-line bg-surface text-ink"}`}>{o}</button>
        ))}
      </div>
    </fieldset>
  );
}

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

export function CheckInForm({ scale }: { scale: { score: number; text: string }[] }) {
  const today = useLocalDay();
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const all = parse(raw);

  // Any day can be opened and edited: tap it in the strip or choose Edit in the list. Today is the default.
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;
  const saved = all.find((e) => e.date === date);
  const [draft, setDraft] = useState<CheckIn | null>(null);
  const entry: CheckIn = draft ?? saved ?? EMPTY_CHECKIN(date);
  const set = (patch: Partial<CheckIn>) => setDraft((prev) => ({ ...(prev ?? saved ?? EMPTY_CHECKIN(date)), date, ...patch }));
  const [flash, setFlash] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const openDay = (d: string | null) => { setPicked(d === today ? null : d); setDraft(null); setFlash(""); };
  const isToday = date === today;
  const urgent = entry.appetite === "None" || entry.vomit === "Yes" || entry.yellow === "Seen";

  const strip = Array.from({ length: 14 }, (_, i) => {
    if (!today) return null;
    const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - (13 - i));
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { k, n: d.getDate(), logged: all.some((e) => e.date === k) };
  });

  const save = () => { saveCheckIn({ ...entry, date }); setDraft(null); setFlash(`Saved on this device for ${isToday ? "today" : fmtDate(date)}.`); };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink">Daily check-in</h1>
        <p className="mt-1 text-[15px] leading-relaxed text-ink2">His vet asked for a log of his days. Thirty seconds, and I&apos;ll bring it to his next visit.</p>
      </div>

      <DeviceOnlyNote what="Your check-ins" />

      {!isToday && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand bg-brand-soft px-3.5 py-2.5 text-sm text-ink">
          <span>Editing <strong className="font-semibold">{fmtDate(date)}</strong>{saved ? "" : " (nothing saved for this day yet)"}</span>
          <button type="button" onClick={() => openDay(null)} className="min-h-11 rounded-full px-3 font-semibold text-brand2 hover:underline">Back to today</button>
        </div>
      )}

      <Choice label="Appetite" options={["Ate all", "Some", "None"]} value={entry.appetite} onChange={(v) => set({ appetite: v })} />
      <Choice label="Drinking water, compared with usual" options={["Less than usual", "Normal", "More than usual"]} value={entry.drinking} onChange={(v) => set({ drinking: v })} />
      <Choice label="Energy" options={["Normal", "Lower than usual"]} value={entry.energy} onChange={(v) => set({ energy: v })} />

      <fieldset>
        <legend className="mb-1 text-[13px] font-semibold text-ink2">Stool score</legend>
        <p className="mb-2 text-sm text-muted">Tap the picture that looks most like it. Number 2 is ideal.</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button key={n} type="button" aria-pressed={entry.stool === n} aria-label={`Score ${n}, ${STOOL_TITLES[n - 1]}`} onClick={() => set({ stool: entry.stool === n ? null : n })}
              className={`flex flex-col items-center gap-1 rounded-xl border bg-surface p-1.5 text-center ${entry.stool === n ? "border-brand ring-2 ring-brand" : "border-line"}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold ${entry.stool === n ? "bg-brand text-on-brand" : "bg-brand-soft text-brand2"}`}>{n}</span>
              <Image src={`/stool/${n}.png`} alt="" width={274} height={202} className="h-auto w-full" />
              <span className="text-[11px] font-semibold leading-tight text-ink2">{STOOL_TITLES[n - 1]}</span>
            </button>
          ))}
        </div>
        {entry.stool && (
          <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-sm leading-snug text-ink2">
            {scale.find((s) => s.score === entry.stool)?.text ?? "His guide doesn't describe this score."} It describes appearance only.
          </p>
        )}
        <details className="mt-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand2">See the full stool guide</summary>
          <div className="overflow-x-auto rounded-xl border border-line bg-surface p-2">
            <Image src="/stool-guide.webp" alt="Stool scoring guide, scores 1 to 7: hard pellets, firm and formed (ideal), moist and formed, soft log, soft pile, mushy, watery." width={2172} height={724} className="h-auto min-w-[640px] w-full" />
          </div>
        </details>
      </fieldset>

      <Choice label="Vomiting" options={["No", "Yes"]} value={entry.vomit} onChange={(v) => set({ vomit: v })} />
      <Choice label="Medications" options={["All given", "Missed one"]} value={entry.meds} onChange={(v) => set({ meds: v })} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-semibold text-ink2">Activity today (pick any)</legend>
        <div className="flex flex-wrap gap-2">
          {ACTIVITIES.map((a) => {
            const on = entry.activity.includes(a);
            return (
              <button key={a} type="button" aria-pressed={on} onClick={() => set({ activity: on ? entry.activity.filter((x) => x !== a) : [...entry.activity.filter((x) => (a === "Mostly rested" ? false : x !== "Mostly rested")), a] })}
                className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${on ? "border-brand bg-brand text-on-brand" : "border-line bg-surface text-ink"}`}>{a}</button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
        <legend className="px-1 text-[13px] font-semibold text-ink2">Body check</legend>
        <p className="-mt-1 text-sm text-muted">His vet asks about these at every visit. A quick look is enough.</p>
        <Choice label="Bruising under the skin" options={["None seen", "Seen"]} value={entry.bruising} onChange={(v) => set({ bruising: v })} />
        <Choice label="Yellow tint (jaundice) in his eyes, ear flaps or gums" options={["None seen", "Seen"]} value={entry.yellow} onChange={(v) => set({ yellow: v, yellowWhere: v === "Seen" ? entry.yellowWhere : [] })} />
        {entry.yellow === "Seen" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13px] font-semibold text-ink2">Where? (pick any)</legend>
            <div className="flex flex-wrap gap-2">
              {YELLOW_PLACES.map((p) => {
                const on = entry.yellowWhere.includes(p);
                return (
                  <button key={p} type="button" aria-pressed={on} onClick={() => set({ yellowWhere: on ? entry.yellowWhere.filter((x) => x !== p) : [...entry.yellowWhere, p] })}
                    className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${on ? "border-brand bg-brand text-on-brand" : "border-line bg-paper text-ink"}`}>{p}</button>
                );
              })}
            </div>
          </fieldset>
        )}
      </fieldset>

      {entry.bruising === "Seen" && <p role="status" className="rounded-2xl border border-amber-fill/50 bg-amber-soft px-3.5 py-3 text-sm font-semibold text-amber">Tell his vet about the bruising, and where you saw it. You can add the place in the note below.</p>}
      {urgent && <p role="alert" className="rounded-2xl border border-red/30 bg-red-soft px-3.5 py-3 text-sm font-semibold text-red">{entry.yellow === "Seen" ? "Yellow gums or eyes are on his warning-sign list. " : ""}Contact his vet or an emergency vet.</p>}

      <div className="flex flex-col gap-2">
        <label htmlFor="ci-note" className="text-[13px] font-semibold text-ink2">Note (optional)</label>
        <input id="ci-note" value={entry.note} maxLength={200} autoComplete="off" onChange={(e) => set({ note: e.target.value })}
          className="h-12 rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-brand" />
      </div>

      <button type="button" onClick={save} disabled={!date} className="h-[52px] rounded-2xl bg-brand text-base font-bold text-on-brand disabled:opacity-40">
        {saved ? (isToday ? "Update today" : "Update this day") : isToday ? "Save today" : "Save this day"}
      </button>
      <p aria-live="polite" className="-mt-3 min-h-5 text-sm text-green">{flash}</p>

      <section>
        <h2 className="text-base font-bold text-ink">Last 14 days</h2>
        <p className="text-sm text-muted">Tap a day to look at it or fix it.</p>
        <div className="mt-2 grid grid-cols-7 gap-1.5 sm:grid-cols-14">
          {strip.map((s, i) => s ? (
            <button key={s.k} type="button" onClick={() => openDay(s.k)} aria-pressed={s.k === date} aria-label={`${fmtDate(s.k)}${s.logged ? ", logged" : ", not logged"}`}
              className={`flex h-11 items-center justify-center rounded-lg text-xs font-semibold ${s.logged ? "bg-green-fill text-on-brand" : "border border-line bg-surface text-muted"} ${s.k === date ? "ring-2 ring-brand ring-offset-1" : ""}`}>{s.n}</button>
          ) : <span key={i} className="h-11" />)}
        </div>
      </section>

      <section aria-labelledby="entries">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="entries" className="text-base font-bold text-ink">All saved days</h2>
          <p className="text-sm text-muted">{all.length} {all.length === 1 ? "day" : "days"}</p>
        </div>
        {all.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No check-ins yet. The log starts empty.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
            {all.map((e) => (
              <li key={e.date} className="flex items-start gap-2 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{fmtDate(e.date)}</p>
                  <p className="text-sm text-ink2">{describe(e) || "No answers"}</p>
                </div>
                <button type="button" onClick={() => { openDay(e.date); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-brand2">Edit</button>
                <button type="button" onClick={() => { if (window.confirm(`Delete the check-in for ${fmtDate(e.date)}?`)) { deleteCheckIn(e.date); if (e.date === date) setDraft(null); setFlash("Deleted."); } }} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-red">Delete</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface px-3.5 py-3">
        <h2 id="keep-a-copy" className="scroll-mt-24 text-base font-bold text-ink">Keep a copy</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink2">
          Your check-ins are saved on this device, in this browser. They stay after you close the page, but clearing the browser&apos;s site data or using a private window removes them,
          and they don&apos;t move to another phone. Download a backup now and then, and restore it here if you ever need to.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => download("theo-checkins-backup.json", "application/json", toJson(all))} disabled={all.length === 0} className="min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand disabled:opacity-40">Download backup</button>
          <button type="button" onClick={() => download("theo-checkins.csv", "text/csv", toCsv(all))} disabled={all.length === 0} className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink disabled:opacity-40">Download CSV</button>
          <button type="button" onClick={() => fileRef.current?.click()} className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink">Restore a backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-label="Choose a backup file"
            onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const n = importCheckIns(await f.text()); setDraft(null); setFlash(n ? `Restored ${n} ${n === 1 ? "day" : "days"}.` : "That file had no check-ins in it."); e.target.value = ""; }} />
          <button type="button" disabled={all.length === 0} onClick={() => { if (window.confirm("Erase every check-in saved on this device?")) { eraseCheckIns(); setDraft(null); setFlash("Erased."); } }}
            className="min-h-11 rounded-xl border border-red/40 bg-surface px-4 text-sm font-semibold text-red disabled:opacity-40">Erase all</button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">Nothing is sent or saved on a server unless you ask for a visit summary.</p>
      </section>
    </div>
  );
}
