/**
 * Turns the agent's tool calls into plain-language work steps ("Reading his medication list") and source chips
 * that link to the matching page. The data is already streaming while the agent works, so the trace is live.
 */
export type Lookup = { type: string; toolName?: string; state?: string; input?: unknown; output?: unknown };

export const isLookup = (p: { type: string }): p is Lookup => p.type.startsWith("tool-") || p.type === "dynamic-tool";
export const isDone = (p: Lookup) => p.state === "output-available" || p.state === "output-error";
export const toolName = (l: Lookup) => (l.type === "dynamic-tool" ? l.toolName ?? "" : l.type.slice(5));

const TYPE_STEP: Record<string, string> = {
  medication: "Reading his medication list",
  careRoutine: "Reading his family routine",
  dietRule: "Reading his diet plan",
  foodItem: "Reading his diet plan",
  dietHistoryEntry: "Reading his diet history",
  vetVisit: "Reading his visits",
  flareEpisode: "Searching his past flares",
  imagingStudy: "Reading his scans",
  labResult: "Reading his lab results",
  labTest: "Reading his lab results",
  weightEntry: "Reading his weights",
  recordGap: "Checking for gaps in his records",
  vetQuestion: "Collecting open vet questions",
  guidance: "Checking the guide",
  condition: "Reading his conditions",
  dog: "Reading his profile",
  historySummary: "Reading his story",
  historyChapter: "Reading his story",
  historyPattern: "Reading his story",
};

/** Where each kind of record is shown on the site. */
const TYPE_CHIP: Record<string, { label: string; href: string }> = {
  medication: { label: "Medication list", href: "/meds" },
  careRoutine: { label: "Family routine", href: "/today" },
  dietRule: { label: "Diet plan", href: "/food" },
  foodItem: { label: "Diet plan", href: "/food" },
  dietHistoryEntry: { label: "Diet history", href: "/diet-history" },
  vetVisit: { label: "Visits and timeline", href: "/timeline" },
  flareEpisode: { label: "Visits and timeline", href: "/timeline" },
  imagingStudy: { label: "Visits and timeline", href: "/timeline" },
  labResult: { label: "Labs", href: "/labs" },
  labTest: { label: "Labs", href: "/labs" },
  weightEntry: { label: "His history", href: "/history" },
  condition: { label: "His history", href: "/history" },
  historySummary: { label: "His history", href: "/history" },
  historyChapter: { label: "His history", href: "/history" },
  historyPattern: { label: "His history", href: "/history" },
  recordGap: { label: "Visit prep", href: "/visit-prep" },
  vetQuestion: { label: "Visit prep", href: "/visit-prep" },
  guidance: { label: "The guide", href: "/guide" },
};

/** The text of a lookup's query or input, whatever shape the tool used. */
export function queryText(input: unknown): string {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    const o = input as Record<string, unknown>;
    const q = o.query ?? o.groq ?? o.question ?? o.q;
    return typeof q === "string" ? q : JSON.stringify(input);
  }
  return "";
}

/** Record types a GROQ query names, for example `_type == "medication"` or `_type in ["dietRule","foodItem"]`. */
export function typesInQuery(q: string): string[] {
  const found = new Set<string>();
  for (const m of q.matchAll(/_type\s*(?:==|in)\s*(\[[^\]]*\]|"[^"]+")/g)) for (const t of m[1].matchAll(/"([A-Za-z]+)"/g)) found.add(t[1]);
  return [...found].filter((t) => t in TYPE_STEP);
}

/** Plain-language steps for the lookups so far, in order and without repeats. */
export function traceSteps(lookups: Lookup[]): { text: string; done: boolean }[] {
  const steps: { text: string; done: boolean }[] = [];
  const add = (text: string, done: boolean) => {
    const existing = steps.find((s) => s.text === text);
    if (existing) existing.done = existing.done && done;
    else steps.push({ text, done });
  };
  for (const l of lookups) {
    const done = isDone(l);
    const name = toolName(l);
    if (name === "knowledge_base_search" || name === "knowledge_base_read") add("Checking the guide", done);
    else if (name === "schema_explorer") add("Checking how his records are organized", done);
    else if (name === "array_field_reader") add("Reading a record in detail", done);
    else {
      const types = typesInQuery(queryText(l.input)).slice(0, 3);
      if (types.length) types.forEach((t) => add(TYPE_STEP[t], done));
      else add("Looking in his records", done);
    }
  }
  return steps;
}

/** Walks a tool result (JSON, or JSON inside MCP text content) and counts the records by type. */
export function recordTypes(output: unknown): Map<string, number> {
  const counts = new Map<string, number>();
  let budget = 800;
  const walk = (node: unknown, depth: number) => {
    if (budget-- <= 0 || depth > 8 || node == null) return;
    if (typeof node === "string") {
      const t = node.trim();
      if ((t.startsWith("{") || t.startsWith("[")) && t.length < 200_000) {
        try { walk(JSON.parse(t), depth + 1); } catch { /* plain text */ }
      }
      return;
    }
    if (Array.isArray(node)) { node.forEach((n) => walk(n, depth + 1)); return; }
    if (typeof node === "object") {
      const o = node as Record<string, unknown>;
      if (typeof o._type === "string" && o._type in TYPE_CHIP) counts.set(o._type, (counts.get(o._type) ?? 0) + 1);
      Object.values(o).forEach((v) => walk(v, depth + 1));
    }
  };
  walk(output, 0);
  return counts;
}

/** One chip per page the answer drew on, linking to that page. */
export function sourceChips(lookups: Lookup[], usedCheckIns: boolean): { label: string; href: string }[] {
  const seen = new Map<string, { label: string; href: string }>();
  for (const l of lookups) {
    const name = toolName(l);
    if (name.startsWith("knowledge_base")) seen.set("/guide", TYPE_CHIP.guidance);
    for (const t of recordTypes(l.output).keys()) seen.set(TYPE_CHIP[t].href, TYPE_CHIP[t]);
  }
  if (usedCheckIns) seen.set("/check-in", { label: "Your check-ins", href: "/check-in" });
  return [...seen.values()];
}
