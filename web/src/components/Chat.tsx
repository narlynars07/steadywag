"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// The server tags each answer with how it read the chart: through Sanity Context, or by the direct-query fallback.
type AgentMode = "context-mcp" | "direct";
type ChatMessage = UIMessage<{ agentMode?: AgentMode }>;

const SUGGESTIONS = [
  "Are his freeze-dried treats allowed?",
  "What did he eat before his diagnosis?",
  "Is anything on his medication list not actually being given?",
  "Is his ALT trend moving the right way?",
  "What should we ask at his next recheck?",
];

function inline(text: string): ReactNode[] {
  // **bold** and [label](https://link). Anything else is plain text, so model output can never inject HTML.
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
    else {
      const [, label, url] = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/.exec(tok)!;
      parts.push(<a key={i++} href={url} target="_blank" rel="noreferrer" className="text-brand underline">{label}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function Rich({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return <ul key={i} className="my-1 list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*]\s+/, ""))}</li>)}</ul>;
        }
        return <p key={i} className="my-1">{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>;
      })}
    </>
  );
}

function friendly(err: Error): string {
  try {
    const parsed = JSON.parse(err.message);
    if (parsed?.error) return String(parsed.error);
  } catch { /* not JSON */ }
  return "Something went wrong reaching the assistant. Please try again.";
}

// ---- Sources: what the answer was actually built from ----
type Lookup = { type: string; toolName?: string; state?: string; input?: unknown; output?: unknown };
const isLookup = (p: { type: string }): p is Lookup => p.type.startsWith("tool-") || p.type === "dynamic-tool";
const isDone = (p: Lookup) => p.state === "output-available" || p.state === "output-error";

const TYPE_LABEL: Record<string, string> = {
  medication: "Medication", labResult: "Lab result", labTest: "Lab test", vetVisit: "Visit", recordGap: "Record gap", guidance: "Guidance",
  dietRule: "Diet rule", foodItem: "Food", vetQuestion: "Vet question", flareEpisode: "Flare", imagingStudy: "Imaging", condition: "Condition",
  weightEntry: "Weight", dog: "Dog",
};

function queryOf(input: unknown): string | undefined {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    const o = input as Record<string, unknown>;
    const q = o.query ?? o.groq ?? o.question ?? o.q;
    return typeof q === "string" ? q : JSON.stringify(input);
  }
  return undefined;
}

/** Walks a tool result (which may be JSON, or JSON inside MCP text content) and names the records in it. */
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

function Sources({ lookups, mode }: { lookups: Lookup[]; mode?: AgentMode }) {
  const via = mode === "context-mcp" ? "Sanity Context" : mode === "direct" ? "Sanity dataset, direct query" : "Sanity";
  return (
    <details className="mt-3 border-t border-line pt-2 text-sm">
      <summary className="cursor-pointer text-brand2">
        ✓ Sources: {lookups.length} {lookups.length === 1 ? "lookup" : "lookups"} through {via}
      </summary>
      <ul className="mt-2 space-y-3">
        {lookups.map((l, i) => {
          const q = queryOf(l.input);
          const records = recordsOf(l.output);
          return (
            <li key={i}>
              <p className="text-xs font-medium text-muted">Lookup {i + 1}{l.type === "dynamic-tool" ? (l.toolName ? ` · ${l.toolName}` : "") : ` · ${l.type.slice(5)}`}</p>
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

export function Chat({ initialQuestion }: { initialQuestion?: string }) {
  const transport = useMemo(() => new DefaultChatTransport<ChatMessage>({ api: "/api/chat" }), []);
  const { messages, sendMessage, status, error, stop } = useChat<ChatMessage>({ transport });
  // A question passed in the link is prefilled, not auto-sent: the person reviews it and presses Ask.
  const [input, setInput] = useState(initialQuestion ?? "");
  const bottom = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, status]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    void sendMessage({ text: t });
    setInput("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite" className="min-h-[40vh] space-y-4">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line p-5">
            <p className="font-medium">Ask about Theodore&apos;s chart.</p>
            <p className="mt-1 text-sm text-muted">I look things up in his records and the cited guidance, and I show what each answer came from. I can&apos;t diagnose or change doses.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-sm hover:bg-brand-soft">{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, mi) => {
          const lookups = m.parts.filter(isLookup);
          const allDone = lookups.length > 0 && lookups.every(isDone);
          const streaming = busy && mi === messages.length - 1;
          return (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-brand text-on-brand" : "border border-line bg-surface"}`}>
                {m.role !== "user" && m.metadata?.agentMode === "direct" && (
                  <p role="note" className="mb-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">
                    <strong className="font-semibold">Direct query, not Sanity Context.</strong> Sanity Context was unavailable for this answer, so it was
                    read straight from the same public dataset. The Knowledge Base was not used.
                  </p>
                )}
                {m.role !== "user" && lookups.length > 0 && !allDone && <p className="mb-1 text-xs text-muted">Looking in his records…</p>}
                {m.parts.map((p, i) => {
                  if (p.type === "text") return m.role === "user" ? <p key={i}>{p.text}</p> : <Rich key={i} text={p.text} />;
                  return null;
                })}
                {m.role !== "user" && allDone && !streaming && <Sources lookups={lookups} mode={m.metadata?.agentMode} />}
              </div>
            </div>
          );
        })}

        {status === "submitted" && <p className="text-sm text-muted">Thinking…</p>}
        {error && <p role="alert" className="rounded-xl bg-red-soft px-4 py-3 text-sm text-red">{friendly(error)}</p>}
        <div ref={bottom} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="sticky bottom-3 flex gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm">
        <label htmlFor="ask" className="sr-only">Your question</label>
        <input id="ask" value={input} onChange={(e) => setInput(e.target.value)} maxLength={1500} placeholder="Ask about his labs, meds, food, or visits…" className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none" autoComplete="off" autoFocus={Boolean(initialQuestion)} />
        {busy ? (
          <button type="button" onClick={() => stop()} className="rounded-xl border border-line px-4 py-2 text-sm">Stop</button>
        ) : (
          <button type="submit" disabled={!input.trim()} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-40">Ask</button>
        )}
      </form>
    </div>
  );
}
