"use client";

import { useState, useSyncExternalStore } from "react";
import { EMPTY_CHECKIN, eraseCheckIns, parse, saveCheckIn, snapshot, subscribe, toCsv, type CheckIn } from "@/lib/checkins";
import { useLocalDay } from "@/lib/useLocalDay";

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

export function CheckInForm({ scale }: { scale: { score: number; text: string }[] }) {
  const day = useLocalDay();
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const all = parse(raw);
  const saved = all.find((e) => e.date === day);
  // The draft starts from today's saved entry, so reopening today edits it.
  const [draft, setDraft] = useState<CheckIn | null>(null);
  const entry: CheckIn = draft ?? saved ?? EMPTY_CHECKIN(day);
  const set = (patch: Partial<CheckIn>) => setDraft((prev) => ({ ...(prev ?? saved ?? EMPTY_CHECKIN(day)), date: day, ...patch }));
  const [flash, setFlash] = useState("");

  const urgent = entry.appetite === "None" || entry.vomit === "Yes";
  const strip = Array.from({ length: 14 }, (_, i) => {
    if (!day) return null;
    const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() - (13 - i));
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { k, n: d.getDate(), logged: all.some((e) => e.date === k) };
  });

  const save = () => { saveCheckIn({ ...entry, date: day }); setDraft(null); setFlash("Saved to this browser."); };
  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(all)], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "theo-checkins.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink">Daily check-in</h1>
        <p className="mt-1 text-[15px] leading-relaxed text-ink2">His vet asked for a log of his days. Thirty seconds, and I&apos;ll bring it to his next visit.</p>
      </div>

      <Choice label="Appetite" options={["Ate all", "Some", "None"]} value={entry.appetite} onChange={(v) => set({ appetite: v })} />
      <Choice label="Energy" options={["Normal", "Lower than usual"]} value={entry.energy} onChange={(v) => set({ energy: v })} />

      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-ink2">Stool score (1 to 7)</legend>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button key={n} type="button" aria-pressed={entry.stool === n} onClick={() => set({ stool: n })}
              className={`h-11 min-w-0 flex-1 rounded-xl border text-sm font-semibold ${entry.stool === n ? "border-brand bg-brand text-on-brand" : "border-line bg-surface text-ink"}`}>{n}</button>
          ))}
        </div>
        {entry.stool && (
          <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-sm leading-snug text-ink2">
            {scale.find((s) => s.score === entry.stool)?.text ?? "His guide doesn't describe this score."} It describes appearance only.
          </p>
        )}
      </fieldset>

      <Choice label="Vomiting" options={["No", "Yes"]} value={entry.vomit} onChange={(v) => set({ vomit: v })} />
      <Choice label="Medications" options={["All given", "Missed one"]} value={entry.meds} onChange={(v) => set({ meds: v })} />

      {urgent && <p role="alert" className="rounded-2xl border border-red/30 bg-red-soft px-3.5 py-3 text-sm font-semibold text-red">Contact his vet or an emergency vet.</p>}

      <div className="flex flex-col gap-2">
        <label htmlFor="ci-note" className="text-[13px] font-semibold text-ink2">Note (optional)</label>
        <input id="ci-note" value={entry.note} maxLength={200} autoComplete="off" onChange={(e) => set({ note: e.target.value })}
          className="h-12 rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-brand" />
      </div>

      <button type="button" onClick={save} disabled={!day} className="h-[52px] rounded-2xl bg-brand text-base font-bold text-on-brand disabled:opacity-40">
        {saved ? "Update today" : "Save today"}
      </button>
      <p aria-live="polite" className="-mt-3 min-h-5 text-sm text-green">{flash}</p>

      <section>
        <h2 className="text-base font-bold text-ink">Last 14 days</h2>
        <div className="mt-2 grid grid-cols-7 gap-1.5 sm:grid-cols-14" role="list">
          {strip.map((s, i) => s ? (
            <span key={s.k} role="listitem" aria-label={`${s.k}${s.logged ? ", logged" : ", not logged"}`}
              className={`flex h-9 items-center justify-center rounded-lg text-xs font-semibold ${s.logged ? "bg-green-fill text-on-brand" : "border border-line bg-surface text-muted"}`}>{s.n}</span>
          ) : <span key={i} className="h-9" />)}
        </div>
        {all.length === 0 && <p className="mt-2 text-sm text-muted">No check-ins yet. The log starts empty.</p>}
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={download} disabled={all.length === 0} className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink disabled:opacity-40">Download CSV</button>
        <button type="button" disabled={all.length === 0} onClick={() => { if (window.confirm("Erase every check-in saved in this browser?")) { eraseCheckIns(); setDraft(null); setFlash("Erased."); } }}
          className="min-h-11 rounded-xl border border-red/40 bg-surface px-4 text-sm font-semibold text-red disabled:opacity-40">Erase</button>
      </div>
      <p className="text-xs leading-relaxed text-muted">Check-ins stay in this browser. Nothing is sent or saved anywhere unless you ask for a visit summary.</p>
    </div>
  );
}
