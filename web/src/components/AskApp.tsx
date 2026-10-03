"use client";

import { Chat, useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Rich } from "./Rich";
import { SourcesPanel, type AgentMode } from "./SourcesPanel";
import { checkInsSince, parse, snapshot } from "@/lib/checkins";
import { isDone, isLookup, sourceChips, traceSteps } from "@/lib/trace";
import { taskQuestion, type Task } from "@/lib/tasks";
import { useLocalDay } from "@/lib/useLocalDay";

// The server tags each answer with how it read the chart: through Sanity Context, or by the direct-query fallback.
type ChatMessage = UIMessage<{ agentMode?: AgentMode }>;

export interface AskProfile {
  name: string;
  line: string; // "8-year-old Shih Tzu mix · 10 kg"
  status: string; // "Doing very well at his Aug 25 visit"
  alert?: string; // the not-given medication, if there is one
  lastVisitDate: string | null;
}

/**
 * One conversation for the whole visit, shared by the Ask page and the floating window, so it follows you between pages.
 * It lives only in this browser tab's memory: closing the tab ends it, and nothing is saved anywhere.
 * Earlier answers are sent back as text only (no lookup results), which keeps follow-up questions fast and cheap.
 */
let sharedChat: Chat<ChatMessage> | null = null;
function getChat(): Chat<ChatMessage> {
  sharedChat ??= new Chat<ChatMessage>({
    transport: new DefaultChatTransport<ChatMessage>({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages, body }) => ({
        body: {
          ...body,
          messages: messages.map((m) => (m.role === "assistant" ? { ...m, parts: m.parts.filter((p) => p.type === "text") } : m)),
        },
      }),
    }),
  });
  return sharedChat;
}
const session: { task: Task | null; checkins: unknown[] | undefined; usedCheckIns: boolean } = { task: null, checkins: undefined, usedCheckIns: false };
/** What the current conversation started with (its task and any check-ins it sends). Shared like the chat itself. */
function setSession(next: Partial<typeof session>) { Object.assign(session, next); }

const ICON = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const TASK_CARDS: { task: Task; title: string; sub: string; icon: ReactNode }[] = [
  { task: "changed", title: "Something changed", sub: "Check it against his history", icon: <svg {...ICON}><path d="M3 12h4l3-7 4 14 3-7h4" /></svg> },
  { task: "eat", title: "Can he eat this?", sub: "Check a food against his plan", icon: <svg {...ICON}><path d="M12 7c-3-3-8-1-7 4 1 4 4 9 7 9s6-5 7-9c1-5-4-7-7-4z" /><path d="M12 7c0-2 1-3 3-4" /></svg> },
  { task: "sitter", title: "I'm watching Theo", sub: "A brief for a sitter", icon: <svg {...ICON}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 11l2 2 4-4" /></svg> },
  { task: "visit", title: "Prep my vet visit", sub: "Questions and what's missing", icon: <svg {...ICON}><path d="M9 4h6v3H9z" /><path d="M7 5H5v15h14V5h-2" /><path d="M9 12h6M9 16h4" /></svg> },
];

const URGENT =
  "If he stops eating for a day, vomits more than once, has blood or black stool, yellow gums, or seems very unwell, contact his vet or an emergency vet now.";
const SUGGESTED = ["Is his ALT trend moving the right way?", "Are his freeze-dried treats allowed?", "What did he eat before his diagnosis?", "What has been recommended and not done?"];

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true" className="animate-spin">
      <circle cx="12" cy="12" r="7" strokeDasharray="30 14" />
    </svg>
  );
}
function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

export interface AskContext { title: string; suggestions: string[] }

export function AskApp({ profile, initialQuestion, autorun, compact = false, onNavigate, context }: { profile: AskProfile; initialQuestion?: string; autorun?: boolean; compact?: boolean; onNavigate?: () => void; context?: AskContext }) {
  const { messages, setMessages, sendMessage, status, error, stop, clearError } = useChat<ChatMessage>({ chat: getChat() });
  const router = useRouter();
  const day = useLocalDay();
  const busy = status === "submitted" || status === "streaming";

  const [pending, setPending] = useState<"changed" | "eat" | null>(null); // the small form before a task starts
  const [changedText, setChangedText] = useState("He skipped dinner and seems tired");
  const [eatText, setEatText] = useState("Blueberries");
  const [freeText, setFreeText] = useState(initialQuestion ?? "");
  const freeRef = useRef<HTMLInputElement>(null);
  const lastUserRef = useRef<HTMLDivElement>(null);
  const threadStarted = messages.length > 0;

  const bodyFor = (t: Task) => ({ today: { date: day || new Date().toISOString().slice(0, 10) }, task: t, ...(session.checkins?.length ? { checkins: session.checkins } : {}) });

  /** Starts a new conversation with a task or a first question. */
  const run = (t: Task, text = "") => {
    if ((t === "changed" || t === "eat" || t === "free") && !text.trim()) return;
    if (busy) stop();
    clearError();
    setMessages([]);
    setPending(null);
    let checkins: unknown[] | undefined;
    if (t === "visit") {
      const list = checkInsSince(parse(snapshot()), profile.lastVisitDate);
      checkins = list.length ? list.map(({ date: d, appetite, energy, stool, vomit, meds, note }) => ({ date: d, appetite, energy, stool, vomit, meds, note })) : undefined;
    }
    setSession({ task: t, checkins, usedCheckIns: !!checkins });
    void sendMessage({ text: taskQuestion(t, text) }, { body: { ...bodyFor(t), ...(checkins ? { checkins } : {}) } });
  };

  /** Sends what is typed: a follow-up in the same conversation, or a first question if there isn't one yet. */
  const send = (text: string) => {
    const v = text.trim();
    if (!v || busy) return;
    setFreeText("");
    if (!threadStarted) { run("free", v); return; }
    clearError();
    void sendMessage({ text: v }, { body: bodyFor("free") });
  };

  const back = () => { if (busy) stop(); clearError(); setMessages([]); setPending(null); setSession({ task: null, checkins: undefined, usedCheckIns: false }); };
  const goToday = () => { router.push("/today"); onNavigate?.(); };

  // "Ask about this chapter" links arrive with ?q=...&go=1 and ask straight away. A plain ?q= only fills the box.
  const started = useRef(false);
  useEffect(() => {
    if (!initialQuestion) return;
    if (autorun && !started.current) { started.current = true; run("free", initialQuestion); return; }
    freeRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, autorun]);

  // When a new question is sent, bring it to the top of the view so its answer streams in underneath it.
  const userCount = messages.filter((m) => m.role === "user").length;
  useEffect(() => { if (userCount > 0) lastUserRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, [userCount]);

  const backCls = compact ? "" : "lg:hidden";

  // ---- The conversation ----
  const renderAssistant = (m: ChatMessage, isLast: boolean) => {
    const lookups = m.parts.filter(isLookup);
    // Only the text after the last lookup is the answer. Anything written before or between lookups is the agent thinking aloud.
    const lastLookup = m.parts.map((p) => isLookup(p)).lastIndexOf(true);
    const text = m.parts.slice(lastLookup + 1).map((p) => (p.type === "text" ? p.text : "")).join("");
    const steps = traceSteps(lookups);
    const live = isLast && busy;
    const rows = [...steps];
    if (live && rows.length === 0) rows.push({ text: "Getting started", done: false });
    if (live && rows.length > 0 && lookups.every(isDone)) rows.push({ text: text ? "Writing the answer" : "Putting the answer together", done: false });
    const finished = !live && text.length > 0;
    const chips = finished ? sourceChips(lookups, isLast && session.usedCheckIns) : [];
    return (
      <div key={m.id} className="flex flex-col gap-3.5">
        {m.metadata?.agentMode === "direct" && (
          <p role="note" className="rounded-xl bg-amber-soft px-3.5 py-2.5 text-sm text-amber">
            <strong className="font-semibold">Direct query, not Sanity Context.</strong> Sanity Context was unavailable for this answer, so it was read straight from the same public dataset. The Knowledge Base was not used.
          </p>
        )}
        {(live || steps.length > 0) && (
          <section aria-live="polite" className="rounded-2xl border border-line bg-surface px-3.5 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{finished ? "What I checked" : "Working…"}</p>
            <ul className="mt-2 space-y-2">
              {(finished ? steps : rows).map((s) => (
                <li key={s.text} className="flex items-center gap-2 text-sm text-ink2">
                  {s.done || finished ? <Check /> : <Spinner />}
                  <span>{s.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {text && (
          <div className="rounded-2xl border border-line bg-surface p-4 text-[15px] leading-relaxed text-ink">
            <Rich text={text} />
            {finished && chips.length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Sources</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {chips.map((c) =>
                    c.href.startsWith("http") ? (
                      <a key={c.href} href={c.href} target="_blank" rel="noreferrer" className="flex min-h-9 items-center rounded-full bg-brand-soft px-3 text-xs font-semibold text-brand2 hover:underline">{c.label} ↗</a>
                    ) : (
                      <Link key={c.href} href={c.href} className="flex min-h-9 items-center rounded-full bg-brand-soft px-3 text-xs font-semibold text-brand2 hover:underline">{c.label}</Link>
                    ),
                  )}
                </div>
              </div>
            )}
            {finished && lookups.length > 0 && <SourcesPanel lookups={lookups} mode={m.metadata?.agentMode} />}
          </div>
        )}
      </div>
    );
  };

  const composer = (hideOnDesktop: boolean) => (
    <form
      onSubmit={(e) => { e.preventDefault(); send(freeText); }}
      className={`sticky z-10 flex gap-2 rounded-2xl border border-line bg-surface p-2 shadow-[0_4px_16px_rgba(23,19,42,0.12)] ${compact ? "bottom-0" : "bottom-[4.75rem] md:bottom-4"} ${hideOnDesktop && !compact ? "lg:hidden" : ""}`}
    >
      <label htmlFor="follow-up" className="sr-only">Ask a follow-up question</label>
      <input id="follow-up" value={freeText} onChange={(e) => setFreeText(e.target.value)} maxLength={1500} autoComplete="off" placeholder="Ask a follow-up…"
        className="h-11 min-w-0 flex-1 rounded-xl bg-paper px-3.5 text-[15px] text-ink outline-none focus:ring-2 focus:ring-brand" />
      {busy ? (
        <button type="button" onClick={stop} className="h-11 rounded-xl border border-line px-4 text-sm font-bold text-ink2">Stop</button>
      ) : (
        <button type="submit" disabled={!freeText.trim()} className="h-11 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand disabled:opacity-40">Send</button>
      )}
    </form>
  );

  const renderThread = () => (
    <div className="flex flex-col gap-3.5">
      <button type="button" onClick={back} className={`flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-brand2 ${backCls}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        New question
      </button>
      {session.task === "changed" && (
        <div role="note" className="rounded-2xl border border-red/30 bg-red-soft px-3.5 py-3 text-sm leading-snug text-red"><strong className="font-semibold">Check first.</strong> {URGENT}</div>
      )}
      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={m.id} ref={i === messages.findLastIndex((x) => x.role === "user") ? lastUserRef : undefined} className="max-w-[85%] scroll-mt-4 self-end rounded-2xl rounded-br-sm bg-brand px-3.5 py-2.5 text-[15px] leading-snug text-on-brand">
            {m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")}
          </div>
        ) : (
          renderAssistant(m, i === messages.length - 1)
        ),
      )}
      {busy && messages.at(-1)?.role === "user" && (
        <section aria-live="polite" className="rounded-2xl border border-line bg-surface px-3.5 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Working…</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-ink2"><Spinner /> Getting started</p>
        </section>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-soft px-4 py-3 text-sm text-red">{friendly(error)}</p>}
      <p className="text-xs leading-relaxed text-muted">Steadywag tracks and prepares. It never diagnoses, doses, or replaces his vet.</p>
      {composer(true)}
    </div>
  );

  // ---- The small form before "Something changed" or "Can he eat this?" ----
  const renderInput = () => {
    const isEat = pending === "eat";
    const value = isEat ? eatText : changedText;
    return (
      <div className="flex flex-col gap-4">
        <button type="button" onClick={back} className={`flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-brand2 ${backCls}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          All tasks
        </button>
        <h2 className="text-2xl font-extrabold tracking-tight text-ink">{isEat ? "Can he eat this?" : "Something changed"}</h2>
        <p className="text-[15px] leading-relaxed text-ink2">
          {isEat ? "I'll check it against his diet plan and flag anything his records disagree on." : "Tell me what you noticed. I'll check it against his history and help you talk to his vet. I won't diagnose."}
        </p>
        <form onSubmit={(e) => { e.preventDefault(); run(pending as Task, value); }} className="flex flex-col gap-3">
          <label htmlFor="sheet-input" className="text-[13px] font-semibold text-ink2">{isEat ? "Food or treat" : "What changed?"}</label>
          <input
            id="sheet-input" value={value} maxLength={400} autoComplete="off"
            onChange={(e) => (isEat ? setEatText(e.target.value) : setChangedText(e.target.value))}
            className="h-[52px] rounded-xl border border-line bg-surface px-3.5 text-base text-ink outline-none focus:border-brand"
          />
          <button type="submit" disabled={!value.trim()} className="h-[52px] rounded-2xl bg-brand text-base font-bold text-on-brand disabled:opacity-40">Check his records</button>
        </form>
      </div>
    );
  };

  // ---- Home ----
  // The question box comes first, so it is always clear where to ask. Tasks are shortcuts underneath it.
  const chips = context?.suggestions ?? SUGGESTED.slice(0, 3);
  const rowCls = compact ? "min-h-16 flex-row items-center gap-3" : "lg:min-h-16 lg:flex-row lg:items-center lg:gap-3";
  const renderHome = () => (
    <div className="flex flex-col gap-4">
      {!compact && <section className="flex items-center gap-3.5 rounded-[18px] border border-line bg-surface p-3">
        <Link href="/history" aria-label="Theo, his history" className="block h-14 w-14 shrink-0 overflow-hidden rounded-full border-[3px] border-surface shadow-[0_0_0_2px_var(--brand)] lg:h-[72px] lg:w-[72px]">
          <Image src="/theo.jpg" alt="Theo" width={144} height={144} priority className="h-full w-full object-cover object-[50%_30%]" />
        </Link>
        <div className="min-w-0">
          <p className="text-lg font-extrabold tracking-tight text-ink">{profile.name}</p>
          <p className="text-[13px] leading-snug text-ink2">{profile.line}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-green">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-green-fill" />
            {profile.status}
          </p>
        </div>
      </section>}

      <div className={`flex flex-col gap-3 ${compact ? "" : "lg:hidden"}`}>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-brand2">{compact ? "Theo's care companion" : "Theo's care companion · chat"}</p>
          {compact ? <h2 className="text-lg font-extrabold tracking-tight text-ink">{context?.title ?? "Ask about Theo"}</h2> : <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink">Ask anything about Theo</h1>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(freeText); }} className="flex flex-col gap-2">
          <label htmlFor="free-ask" className="sr-only">Ask anything about Theo</label>
          <div className="flex gap-2">
            <input
              id="free-ask" ref={freeRef} value={freeText} onChange={(e) => setFreeText(e.target.value)} maxLength={1500} autoComplete="off"
              placeholder={compact ? "Ask a question…" : "Type a question about Theo…"}
              className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-brand/40 bg-surface px-4 text-base text-ink outline-none focus:border-brand"
            />
            <button type="submit" disabled={!freeText.trim()} className="h-14 rounded-2xl bg-brand px-5 text-base font-bold text-on-brand disabled:opacity-40">Ask</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {chips.map((q) => (
              <button key={q} type="button" onClick={() => send(q)} className="min-h-11 rounded-full border border-line bg-surface px-3.5 text-left text-sm font-semibold text-brand2 hover:bg-brand-soft">{q}</button>
            ))}
          </div>
        </form>
      </div>

      {profile.alert && (
        <div role="note" className="flex items-start gap-2.5 rounded-2xl border border-amber-fill/50 bg-amber-soft px-3.5 py-3 text-sm leading-snug text-amber">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0"><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></svg>
          <p><strong className="font-semibold">{profile.alert} is on his written list, but don&apos;t give it.</strong> A verbal instruction never made it onto the paperwork.</p>
        </div>
      )}

      <p className="-mb-1 text-xs font-bold uppercase tracking-[0.08em] text-muted">Or start with a task</p>

      {/* The plan for the day is on the Today page: faster and easier to scan than an agent answer. */}
      <button type="button" onClick={goToday} className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-brand p-4 text-left text-on-brand">
        <svg {...ICON} width={24} height={24}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>
        <span className="flex flex-col gap-0.5">
          <span className="text-base font-bold">What does he need today?</span>
          <span className="text-[13px] text-on-brand/85">Opens his plan for the day</span>
        </span>
      </button>

      <div className={`grid gap-2.5 ${compact ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-1"}`}>
        {TASK_CARDS.map((c) => (
          <button
            key={c.task} type="button"
            onClick={() => (c.task === "sitter" || c.task === "visit" ? run(c.task) : setPending(c.task as "changed" | "eat"))}
            className={`flex min-h-[104px] flex-col gap-2 rounded-2xl border border-line bg-surface p-3.5 text-left text-brand2 ${rowCls}`}
          >
            {c.icon}
            <span className="flex flex-col gap-2 lg:gap-0.5">
              <span className="text-[15px] font-bold leading-tight text-ink">{c.title}</span>
              <span className="text-xs leading-snug text-muted">{c.sub}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber">
        Not veterinary advice. If your dog isn&apos;t eating, is vomiting repeatedly, has blood or black stool, yellow gums, or seems very unwell, contact your vet or an emergency vet now.
      </div>
      <p className="text-xs leading-relaxed text-muted">Steadywag tracks and prepares. It never diagnoses, doses, or replaces his vet.</p>
    </div>
  );

  // Compact (the floating window) shows one screen at a time. The full page shows the tasks and the chat side by side on desktop.
  const right = threadStarted ? renderThread() : pending ? renderInput() : null;
  if (compact) return right ?? renderHome();
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
      <div className={right ? "hidden lg:block" : ""}>{renderHome()}</div>
      <div className={`${right ? "" : "hidden lg:flex"} flex-col lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] lg:min-h-[520px] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-line lg:bg-surface`}>
        <div className="hidden items-center gap-3 border-b border-line px-4 py-3 lg:flex">
          <Image src="/theo.jpg" alt="" width={72} height={72} loading="eager" className="h-10 w-10 rounded-full object-cover object-[50%_30%] shadow-[0_0_0_2px_var(--brand)]" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold tracking-tight text-ink">Ask about Theo</p>
            <p className="text-xs text-muted">Answers come from his records, with the sources shown</p>
          </div>
          {threadStarted && <button type="button" onClick={back} className="min-h-11 rounded-full px-3 text-sm font-semibold text-brand2 hover:bg-brand-soft">New question</button>}
        </div>
        <div className="lg:flex-1 lg:overflow-y-auto lg:p-5">
          {right ?? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-lg font-extrabold tracking-tight text-ink">Pick a task on the left, or ask anything below.</p>
                <p className="mt-1 text-[15px] leading-relaxed text-ink2">The answer appears here, with what I checked and where each part came from. You can keep asking follow-ups. Try one of these:</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED.map((q) => (
                  <button key={q} type="button" onClick={() => send(q)} className="min-h-11 rounded-full border border-line bg-paper px-4 text-sm font-semibold text-brand2 hover:bg-brand-soft">{q}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(freeText); }} className="hidden gap-2 border-t border-line p-3 lg:flex">
          <label htmlFor="free-ask-lg" className="sr-only">Ask anything about Theo</label>
          <input id="free-ask-lg" value={freeText} onChange={(e) => setFreeText(e.target.value)} maxLength={1500} autoComplete="off" placeholder={threadStarted ? "Ask a follow-up…" : "Ask anything about Theo…"}
            className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-paper px-4 text-[15px] text-ink outline-none focus:border-brand" />
          {busy ? (
            <button type="button" onClick={stop} className="h-12 rounded-xl border border-line px-5 text-[15px] font-bold text-ink2">Stop</button>
          ) : (
            <button type="submit" disabled={!freeText.trim()} className="h-12 rounded-xl bg-brand px-5 text-[15px] font-bold text-on-brand disabled:opacity-40">Ask</button>
          )}
        </form>
      </div>
    </div>
  );
}

function friendly(err: Error): string {
  try {
    const parsed = JSON.parse(err.message);
    if (parsed?.error) return String(parsed.error);
  } catch { /* not JSON */ }
  return "Something went wrong reaching the assistant. Please try again.";
}
