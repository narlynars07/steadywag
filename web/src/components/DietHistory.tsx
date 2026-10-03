"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Card, Chip } from "./ui";
import { useLocalDay } from "@/lib/useLocalDay";

/** A stored answer meaning "I don't remember". Distinct from an empty answer, which means "not answered yet". */
export const UNKNOWN = "__unknown__";
/**
 * A prefilled marker for Theo's example: his medical records say nothing on this question. Distinct from "I don't remember"
 * (someone tried and could not recall) and from blank (not answered yet). Family-recalled answers replace it later.
 */
export const NOT_IN_RECORDS = "__not_in_records__";

type Row = Record<string, string>;
type ListKey = "adult" | "treats" | "supps";
export interface Form {
  a: Record<string, string>;
  rows: Record<ListKey, Row[]>;
}

type Choices = readonly (readonly [string, string])[];
const YES_NO: Choices = [["yes", "Yes"], ["no", "No"]];

// One place for every question's wording, so the form, the preview and the exports always agree.
const F: Record<string, { label: string; choices?: Choices }> = {
  dogName: { label: "Dog's name" },
  ownerName: { label: "Your name" },
  ageAtBiopsy: { label: "Dog's age on the biopsy date" },
  acquiredYear: { label: "Year you got your dog" },
  ageAtAcq: { label: "Dog's age when you got them" },
  acquiredFrom: { label: "Where your dog came from", choices: [["breeder", "Breeder"], ["pound", "Pound"], ["rescue", "Rescue"], ["other", "Other"]] },
  state: { label: "State where your dog has lived for the last 6 years" },
  county: { label: "County" },
  puppyDiet: { label: "Food fed as a puppy" },
  puppyMonths: { label: "How many months was puppy food fed?" },
  transitionAge: { label: "Age when you switched to adult food" },
  biopsyPrompt: { label: "What led to the liver biopsy?", choices: [["illness", "Illness"], ["enzymes", "Raised liver enzymes"], ["jaundice", "Jaundice"], ["incidental", "Biopsy taken during another procedure"]] },
  symptomatic: { label: "If liver enzymes were raised, did your dog have symptoms?" },
  surprise: { label: "Was the raised liver enzyme result a surprise?", choices: YES_NO },
  medHistory: { label: "Medical history before the biopsy" },
  copperPipes: { label: "Are there copper pipes in your home?", choices: YES_NO },
  waterSource: { label: "Where does your drinking water come from?", choices: [["municipal", "Municipal"], ["well", "Well"]] },
  waterPlace: { label: "If municipal: city, county and state" },
  waterAnalysis: { label: "Have you had a water analysis done?", choices: YES_NO },
  filter: { label: "Do you have a water filter system?", choices: YES_NO },
  filterType: { label: "Filter type", choices: [["ro", "Reverse osmosis"], ["counter", "Counter-top"], ["carbon", "Activated carbon"], ["particulate", "Particulate"], ["distillation", "Distillation"], ["fridge", "Refrigerator"]] },
  scent: { label: "Electronic scent dispensers at dog level in your home?", choices: YES_NO },
  chelation: { label: "If copper was 600 ppm or higher: has your dog had copper-binding (chelation) treatment and a change to a lifelong copper-restricted diet?", choices: YES_NO },
  prevHeartworm: { label: "Heartworm prevention (product, and for how long)" },
  prevParasite: { label: "Flea, tick and parasite prevention (product, and for how long)" },
  otherMeds: { label: "Other medications" },
};

const CHEWS = [
  ["meat", "Desiccated meat or tendon products"],
  ["liver", "Desiccated liver used as a training reward"],
  ["bully", "Bully sticks"],
  ["hooves", "Hooves"],
  ["rawhide", "Rawhides"],
] as const;

for (const [id, label] of CHEWS) {
  F[`chew.${id}`] = { label: `Has your dog been fed: ${label.toLowerCase()}?`, choices: YES_NO };
  F[`chew.${id}.often`] = { label: `${label}: how often?` };
  F[`chew.${id}.product`] = { label: `${label}: name of product` };
  F[`chew.${id}.bought`] = { label: `${label}: where purchased?` };
  F[`chew.${id}.made`] = { label: `${label}: where manufactured?` };
}

const COLS: Record<ListKey, { k: string; label: string }[]> = {
  adult: [
    { k: "type", label: "Type (dry, canned, home-cooked, raw)" },
    { k: "brand", label: "Brand and product name" },
    { k: "flavor", label: "Formula or flavor" },
    { k: "from", label: "Started (month and year, or age)" },
    { k: "to", label: "Stopped, or how long fed" },
  ],
  treats: [
    { k: "name", label: "Treat (brand and name)" },
    { k: "often", label: "How often" },
    { k: "notes", label: "Notes" },
  ],
  supps: [
    { k: "name", label: "Supplement or remedy" },
    { k: "duration", label: "For how long" },
    { k: "source", label: "Where you get it" },
  ],
};

// ---- Browser-only storage. Answers never leave this device. ----
const STORE_KEY = "steadywag.dietHistory.v1";
const listeners = new Set<() => void>();
let memory: string | undefined; // keeps the form working when the browser blocks storage

function snapshot(): string {
  if (memory !== undefined) return memory;
  try { return localStorage.getItem(STORE_KEY) ?? ""; } catch { return ""; }
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
}
function save(value: string) {
  memory = value;
  try { if (value) localStorage.setItem(STORE_KEY, value); else localStorage.removeItem(STORE_KEY); } catch { /* storage blocked: memory still holds it for this visit */ }
  listeners.forEach((l) => l());
}

function merge(defaults: Form, raw: string): Form {
  if (!raw) return defaults;
  try {
    const s = JSON.parse(raw) as Partial<Form>;
    if (!s || typeof s !== "object") return defaults;
    return {
      a: { ...defaults.a, ...(s.a ?? {}) },
      rows: {
        adult: s.rows?.adult ?? defaults.rows.adult,
        treats: s.rows?.treats ?? defaults.rows.treats,
        supps: s.rows?.supps ?? defaults.rows.supps,
      },
    };
  } catch {
    return defaults;
  }
}

// ---- Turning answers into a document (preview, copy, CSV and print all use this) ----
type Section = { title: string; items: { q: string; a: string }[] };

function fmt(form: Form, key: string): string {
  const v = (form.a[key] ?? "").trim();
  if (v === UNKNOWN) return "Don't remember";
  if (v === NOT_IN_RECORDS) return "Not in his records";
  if (!v) return "Not answered";
  const choice = F[key]?.choices?.find(([c]) => c === v);
  return choice ? choice[1] : v;
}
function fmtRows(form: Form, list: ListKey, noneKey: string): string {
  if (form.a[noneKey] === "1") return "Don't remember";
  const lines = form.rows[list]
    .map((r) => COLS[list].map((c) => (r[c.k] ?? "").trim()).filter(Boolean).join(" · "))
    .filter(Boolean)
    .map((l, i) => `${i + 1}. ${l}`);
  return lines.length ? lines.join("\n") : "Not answered";
}
function fmtChew(form: Form, id: string): string {
  const given = fmt(form, `chew.${id}`);
  if ((form.a[`chew.${id}`] ?? "") !== "yes") return given;
  const part = (key: string, label: string) => `${label}: ${fmt(form, `chew.${id}.${key}`).toLowerCase()}`;
  return `Yes. ${[part("often", "How often"), part("product", "Product"), part("bought", "Bought at"), part("made", "Made in")].join(". ")}.`;
}

function buildDoc(form: Form): Section[] {
  const simple = (keys: string[]) => keys.map((k) => ({ q: F[k].label, a: fmt(form, k) }));
  return [
    { title: "About the dog", items: simple(["dogName", "ownerName", "ageAtBiopsy", "acquiredYear", "ageAtAcq", "acquiredFrom", "state", "county"]) },
    { title: "Puppy diet", items: simple(["puppyDiet", "puppyMonths", "transitionAge"]) },
    { title: "Adult diets, in order", items: [{ q: "Each diet, with brand, formula and how long it was fed", a: fmtRows(form, "adult", "adult.none") }] },
    { title: "Treats", items: [{ q: "Specific treats", a: fmtRows(form, "treats", "treats.none") }] },
    { title: "Chews and specific products", items: CHEWS.map(([id, label]) => ({ q: label, a: fmtChew(form, id) })) },
    { title: "Before the biopsy", items: simple(["biopsyPrompt", "symptomatic", "surprise", "medHistory"]) },
    { title: "Water and home", items: simple(["copperPipes", "waterSource", "waterPlace", "waterAnalysis", "filter", "filterType", "scent"]) },
    {
      title: "Medications and supplements",
      items: [
        ...simple(["chelation", "prevHeartworm", "prevParasite", "otherMeds"]),
        { q: "Dietary, vitamin, joint or herbal supplements, and holistic remedies", a: fmtRows(form, "supps", "supps.none") },
      ],
    },
  ];
}

function toText(form: Form, prepared: string): string {
  const head = `Diet and environment history: ${fmt(form, "dogName")}${prepared ? `\nPrepared ${prepared}.` : ""}`;
  const body = buildDoc(form).map((s) => `${s.title.toUpperCase()}\n${s.items.map((i) => `${i.q}: ${i.a.includes("\n") ? `\n${i.a}` : i.a}`).join("\n")}`);
  return [head, ...body].join("\n\n");
}

function toCsv(form: Form): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [["Section", "Question", "Answer"].map(esc).join(",")];
  for (const s of buildDoc(form)) for (const i of s.items) lines.push([s.title, i.q, i.a].map(esc).join(","));
  return lines.join("\r\n");
}

function progress(form: Form) {
  // The chew questions are counted once each (given or not); their follow-ups are details, not separate questions.
  const keys = [...Object.keys(F).filter((k) => k !== "ownerName" && k !== "filterType" && !k.startsWith("chew.")), ...CHEWS.map(([id]) => `chew.${id}`)];
  let answered = 0, unknown = 0, blank = 0, notInRecords = 0;
  for (const k of keys) {
    const v = (form.a[k] ?? "").trim();
    if (v === UNKNOWN) unknown++; else if (v === NOT_IN_RECORDS) notInRecords++; else if (v) answered++; else blank++;
  }
  for (const [list, none] of [["adult", "adult.none"], ["treats", "treats.none"], ["supps", "supps.none"]] as const) {
    const filled = form.rows[list].some((r) => Object.values(r).some((x) => x.trim()));
    if (form.a[none] === "1") unknown++; else if (filled) answered++; else blank++;
  }
  return { answered, unknown, blank, notInRecords, total: answered + unknown + blank + notInRecords };
}

// ---- Form pieces ----
interface Ctx {
  form: Form;
  set: (key: string, value: string) => void;
  fromRecords: (key: string) => boolean;
}

const INPUT = "w-full rounded-xl border border-line bg-paper px-3 py-2 text-base outline-none focus:border-brand disabled:opacity-50";

function Label({ id, text, from, missing }: { id: string; text: string; from: boolean; missing?: boolean }) {
  return (
    <label htmlFor={id} className="flex flex-wrap items-center gap-2 font-medium text-ink">
      {text}
      {from && <Chip tone="brand" title="Filled in from his medical records. Edit it if it's wrong.">From his records</Chip>}
      {missing && <Chip title="His medical records say nothing about this. The family's recollection can fill it in.">Not in his records</Chip>}
    </label>
  );
}

function Unknown({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex shrink-0 items-center gap-2 text-sm text-muted">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--color-brand)]" />
      I don&apos;t remember
    </label>
  );
}

function Text({ f, k, hint, area, placeholder }: { f: Ctx; k: string; hint?: string; area?: boolean; placeholder?: string }) {
  const v = f.form.a[k] ?? "";
  const unk = v === UNKNOWN;
  const missing = v === NOT_IN_RECORDS;
  const shown = unk || missing ? "" : v;
  const off = unk || missing;
  const hold = missing ? "Not in his records" : placeholder;
  return (
    <div>
      <Label id={k} text={F[k].label} from={f.fromRecords(k)} missing={missing} />
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-1.5 flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-[14rem] flex-1">
          {area ? (
            <textarea id={k} rows={4} className={INPUT} value={shown} disabled={off} placeholder={hold} onChange={(e) => f.set(k, e.target.value)} />
          ) : (
            <input id={k} className={INPUT} value={shown} disabled={off} placeholder={hold} onChange={(e) => f.set(k, e.target.value)} />
          )}
        </div>
        {missing ? (
          <button type="button" onClick={() => f.set(k, "")} className="text-sm text-muted underline">Enter an answer</button>
        ) : (
          <Unknown checked={unk} onChange={(c) => f.set(k, c ? UNKNOWN : "")} />
        )}
      </div>
    </div>
  );
}

function Pick({ f, k, hint }: { f: Ctx; k: string; hint?: string }) {
  const v = f.form.a[k] ?? "";
  const options: Choices = [...(F[k].choices ?? YES_NO), [UNKNOWN, "I don't remember"]];
  return (
    <fieldset>
      <legend className="flex flex-wrap items-center gap-2 font-medium text-ink">
        {F[k].label}
        {f.fromRecords(k) && <Chip tone="brand" title="Filled in from his medical records. Edit it if it's wrong.">From his records</Chip>}
        {v === NOT_IN_RECORDS && <Chip title="His medical records say nothing about this. The family's recollection can fill it in.">Not in his records</Chip>}
      </legend>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {options.map(([val, label]) => (
          <label key={val} className="flex items-center gap-2">
            <input type="radio" name={k} checked={v === val} onChange={() => f.set(k, val)} className="size-4 accent-[var(--color-brand)]" />
            {label}
          </label>
        ))}
        {v && <button type="button" onClick={() => f.set(k, "")} className="text-sm text-muted underline">Clear</button>}
      </div>
    </fieldset>
  );
}

function Rows({
  f, list, none, hint, addLabel, onChange,
}: {
  f: Ctx; list: ListKey; none: string; hint?: string; addLabel: string;
  onChange: (rows: Row[]) => void;
}) {
  const rows = f.form.rows[list];
  const unk = f.form.a[none] === "1";
  const cols = COLS[list];
  return (
    <div>
      {hint && <p className="mb-2 text-sm text-muted">{hint}</p>}
      {!unk && (
        <ul className="space-y-3">
          {rows.map((r, i) => (
            <li key={i} className="rounded-xl border border-line bg-paper p-3">
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))" }}>
                {cols.map((c) => (
                  <input
                    key={c.k}
                    aria-label={`${c.label}, entry ${i + 1}`}
                    placeholder={c.label}
                    className={INPUT}
                    value={r[c.k] ?? ""}
                    onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, [c.k]: e.target.value } : x)))}
                  />
                ))}
              </div>
              <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="mt-2 text-sm text-muted underline">
                Remove entry {i + 1}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {!unk && (
          <button type="button" onClick={() => onChange([...rows, {}])} className="rounded-full border border-line bg-surface px-4 py-2 text-sm hover:bg-brand-soft">
            + {addLabel}
          </button>
        )}
        <Unknown checked={unk} onChange={(c) => f.set(none, c ? "1" : "")} />
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <Card title={`${n}. ${title}`}>
      <div className="space-y-5">{children}</div>
    </Card>
  );
}

export function DietHistory({ defaults, ageHint, provenance, example = false }: { defaults: Form; ageHint?: string; provenance?: string[]; example?: boolean }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  // Every prefilled key set to empty, so nothing of Theo's remains for someone using the form for their own dog.
  const blank = useMemo<Form>(() => ({
    a: Object.fromEntries(Object.keys(defaults.a).map((k) => [k, ""])),
    rows: { adult: [], treats: [], supps: [] },
  }), [defaults]);
  // The form starts blank. Theo's answers load only from "See Theo's example", and that copy lives in memory:
  // it never touches the family's saved answers and is never saved.
  const [exampleForm, setExampleForm] = useState<Form>(defaults);
  const stored = useMemo(() => merge(blank, raw), [blank, raw]);
  const form = example ? exampleForm : stored;
  const day = useLocalDay();
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const commit = (next: Form) => (example ? setExampleForm(next) : save(JSON.stringify(next)));
  const isExample = example;
  const f: Ctx = {
    form,
    set: (key, value) => commit({ ...form, a: { ...form.a, [key]: value } }),
    fromRecords: (key) => !!defaults.a[key] && defaults.a[key] !== NOT_IN_RECORDS && form.a[key] === defaults.a[key],
  };
  const setRows = (list: ListKey) => (rows: Row[]) => commit({ ...form, rows: { ...form.rows, [list]: rows } });

  const doc = buildDoc(form);
  const p = progress(form);
  const prepared = day ? new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toText(form, prepared));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard blocked: the preview below can be selected by hand */ }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(form)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "diet-and-environment-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const chewYes = (id: string) => (form.a[`chew.${id}`] ?? "") === "yes";

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        <Card tone="lavender">
          <p className="text-ink">
            <strong className="font-semibold">Everything you type stays in this browser.</strong> Nothing is sent to a server or saved in the cloud, so
            on a shared computer, use <em>Erase my answers</em> when you finish. Skip any question you can&apos;t answer, or tick{" "}
            <em>I don&apos;t remember</em>. The export keeps those two apart, because &quot;not answered yet&quot; and &quot;couldn&apos;t recall&quot; mean different things.
          </p>
          {isExample && (
            <div className="mt-4 rounded-xl bg-surface px-4 py-3">
              <p className="text-ink">
                <strong className="font-semibold">This is Theo&apos;s example, not your dog&apos;s history.</strong> His answers are filled in and nothing here is saved. The ones from his records are marked{" "}
                <em>From his records</em>, and the questions his records can&apos;t answer say <em>Not in his records</em>. Using this for your own dog? Start with a blank form.
              </p>
              <Link href="/diet-history" className="mt-2 inline-flex min-h-11 items-center rounded-full bg-brand px-4 text-sm font-medium text-on-brand">
                Start a blank history for my dog
              </Link>
            </div>
          )}
          <p role="status" className="mt-3 text-sm text-brand2">
            {p.answered} answered · {p.unknown} marked don&apos;t remember{p.notInRecords > 0 ? ` · ${p.notInRecords} not in his records` : ""} · {p.blank} still blank (of {p.total})
          </p>
        </Card>

        {p.answered + p.unknown > 0 && (
          <div className="flex flex-wrap items-center gap-2" aria-label="Export">
            <button onClick={download} className="min-h-11 rounded-full bg-brand px-4 text-sm font-medium text-on-brand">Download CSV</button>
            <button onClick={() => window.print()} className="min-h-11 rounded-full border border-line bg-surface px-4 text-sm hover:bg-brand-soft">Print or save as PDF</button>
            <button onClick={copy} className="min-h-11 rounded-full border border-line bg-surface px-4 text-sm hover:bg-brand-soft">{copied ? "Copied" : "Copy as text"}</button>
          </div>
        )}

        <Step n={1} title="About the dog">
          <div className="grid gap-5 sm:grid-cols-2">
            <Text f={f} k="dogName" />
            <Text f={f} k="ownerName" hint="Optional. It stays on this device." />
            <Text f={f} k="ageAtBiopsy" hint={isExample ? ageHint : undefined} />
            <Text f={f} k="acquiredYear" />
            <Text f={f} k="ageAtAcq" />
            <Pick f={f} k="acquiredFrom" />
            <Text f={f} k="state" />
            <Text f={f} k="county" />
          </div>
        </Step>

        <Step n={2} title="Puppy diet">
          <Text f={f} k="puppyDiet" area hint="Brand, exact product name and flavor (beef, chicken, salmon and rice), and the type: canned, kibble, freeze-dried or raw." />
          <div className="grid gap-5 sm:grid-cols-2">
            <Text f={f} k="puppyMonths" />
            <Text f={f} k="transitionAge" hint="In months or years." />
          </div>
        </Step>

        <Step n={3} title="Adult diets, in order">
          <Rows
            f={f} list="adult" none="adult.none" addLabel="Add a diet" onChange={setRows("adult")}
            hint="One row per diet, oldest first. Medical records usually start at diagnosis, so earlier diets need your memory, an online order history, or photos of old bags and cans."
          />
          {isExample && provenance && provenance.length > 0 && (
            <div className="mt-3 rounded-xl bg-paper px-4 py-3 text-sm text-ink2">
              <p className="font-medium text-ink">Where Theo&apos;s rows come from</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {provenance.map((p) => <li key={p}>{p}</li>)}
              </ul>
              <p className="mt-1 text-muted">His puppy diet and anything before June 2021 are not recorded anywhere.</p>
            </div>
          )}
        </Step>

        <Step n={4} title="Treats">
          <Rows
            f={f} list="treats" none="treats.none" addLabel="Add a treat" onChange={setRows("treats")}
            hint="Brand and product name if you can. If you can't recall one, look in your pet-store order history, or photograph the package."
          />
        </Step>

        <Step n={5} title="Chews and specific products">
          {CHEWS.map(([id]) => (
            <div key={id} className="space-y-3">
              <Pick f={f} k={`chew.${id}`} />
              {chewYes(id) && (
                <div className="grid gap-4 border-l-2 border-brand-soft pl-4 sm:grid-cols-2">
                  {(["often", "product", "bought", "made"] as const).map((sub) => (
                    <Text key={sub} f={f} k={`chew.${id}.${sub}`} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </Step>

        <Step n={6} title="Before the biopsy">
          <Pick f={f} k="biopsyPrompt" />
          <Text f={f} k="symptomatic" />
          <Pick f={f} k="surprise" hint="For example, found at a routine check, or before anesthesia for dental work or a spay or neuter." />
          <Text f={f} k="medHistory" area hint="A short summary is fine." />
        </Step>

        <Step n={7} title="Water and home">
          <div className="grid gap-5 sm:grid-cols-2">
            <Pick f={f} k="copperPipes" />
            <Pick f={f} k="waterSource" />
          </div>
          <Text f={f} k="waterPlace" hint="Researchers can look up local groundwater analyses with this." />
          <div className="grid gap-5 sm:grid-cols-2">
            <Pick f={f} k="waterAnalysis" />
            <Pick f={f} k="filter" />
          </div>
          {f.form.a.filter === "yes" && <Pick f={f} k="filterType" />}
          <Pick f={f} k="scent" />
        </Step>

        <Step n={8} title="Medications and supplements">
          <Pick f={f} k="chelation" />
          <Text f={f} k="prevHeartworm" />
          <Text f={f} k="prevParasite" />
          <Text f={f} k="otherMeds" area />
          <Rows
            f={f} list="supps" none="supps.none" addLabel="Add a supplement" onChange={setRows("supps")}
            hint="Dietary, vitamin, joint and herbal supplements, and holistic remedies. Include what, for how long, and where you get it."
          />
        </Step>
      </div>

      <Card
        title={`Your history${form.a.dogName && form.a.dogName !== UNKNOWN ? `: ${form.a.dogName}` : ""}`}
        aside={prepared && `Prepared ${prepared}`}
      >
        <div className="no-print mb-5 flex flex-wrap items-center gap-2">
          <button onClick={copy} className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-on-brand">Copy as text</button>
          <button onClick={download} className="rounded-full border border-line bg-surface px-4 py-2 text-sm hover:bg-brand-soft">Download CSV</button>
          <button onClick={() => window.print()} className="rounded-full border border-line bg-surface px-4 py-2 text-sm hover:bg-brand-soft">Print or save as PDF</button>
          <button
            onClick={() => {
              if (!confirmReset) { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 4000); return; }
              if (example) setExampleForm(defaults); else save("");
              setConfirmReset(false);
            }}
            className="rounded-full border border-line bg-surface px-4 py-2 text-sm text-red hover:bg-red-soft"
          >
            {confirmReset ? "Click again to erase your answers" : "Erase my answers and reset"}
          </button>
          <span role="status" className="text-sm text-muted">{copied ? "Copied to clipboard" : ""}</span>
        </div>
        <div className="space-y-5">
          {doc.map((s) => (
            <section key={s.title} className="print-card">
              <h3 className="font-serif text-lg font-bold text-ink">{s.title}</h3>
              <dl className="mt-1 divide-y divide-line">
                {s.items.map((i) => (
                  <div key={i.q} className="grid gap-1 py-2 sm:grid-cols-[2fr_3fr] sm:gap-4">
                    <dt className="text-sm text-muted">{i.q}</dt>
                    <dd className={`whitespace-pre-line ${i.a === "Not answered" ? "text-muted" : i.a === "Don't remember" ? "italic text-ink2" : "text-ink"}`}>{i.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </Card>
    </div>
  );
}
