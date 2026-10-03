import { isLookup, queryText, toolName, type Lookup } from "@/lib/trace";

export type AgentMode = "context-mcp" | "direct";
export { isLookup };

const TYPE_LABEL: Record<string, string> = {
  medication: "Medication", labResult: "Lab result", labTest: "Lab test", vetVisit: "Visit", recordGap: "Record gap", guidance: "Guidance",
  dietRule: "Diet rule", foodItem: "Food", vetQuestion: "Vet question", flareEpisode: "Flare", imagingStudy: "Imaging", condition: "Condition",
  weightEntry: "Weight", dog: "Dog", careRoutine: "Family routine", dietHistoryEntry: "Diet history",
};

/** Walks a tool result (JSON, or JSON inside MCP text content) and names the records in it. */
function recordsOf(output: unknown): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
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
      if (typeof o._type === "string" && TYPE_LABEL[o._type]) {
        const name = [o.title, o.name, o.question, o.code].find((v) => typeof v === "string") as string | undefined;
        const when = [o.date, o.startDate].find((v) => typeof v === "string") as string | undefined;
        const label = [TYPE_LABEL[o._type], name ? name.slice(0, 80) : "", when ?? ""].filter(Boolean).join(" · ");
        if (!seen.has(label)) { seen.add(label); found.push(label); }
      }
      Object.values(o).forEach((v) => walk(v, depth + 1));
    }
  };
  walk(output, 0);
  return found;
}

/** The full detail behind an answer: each lookup, its query, and the records it returned. */
export function SourcesPanel({ lookups, mode }: { lookups: Lookup[]; mode?: AgentMode }) {
  const via = mode === "context-mcp" ? "Sanity Context" : mode === "direct" ? "Sanity dataset, direct query" : "Sanity";
  return (
    <details className="mt-3 border-t border-line pt-2 text-sm">
      <summary className="flex min-h-11 cursor-pointer items-center text-brand2">
        ✓ Sources: {lookups.length} {lookups.length === 1 ? "lookup" : "lookups"} through {via}
      </summary>
      <ul className="mt-2 space-y-3">
        {lookups.map((l, i) => {
          const q = queryText(l.input);
          const records = recordsOf(l.output);
          return (
            <li key={i}>
              <p className="text-xs font-medium text-muted">Lookup {i + 1} · {toolName(l)}</p>
              {q && <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-paper px-3 py-2 font-mono text-xs text-ink2">{q}</pre>}
              {records.length > 0 ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink2">
                  {records.slice(0, 8).map((r) => <li key={r}>{r}</li>)}
                  {records.length > 8 && <li className="list-none text-muted">and {records.length - 8} more</li>}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-muted">{l.state === "output-error" ? "This lookup returned an error." : "No individual records to list for this lookup."}</p>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
