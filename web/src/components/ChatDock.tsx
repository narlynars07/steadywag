"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AskApp, type AskContext, type AskProfile } from "./AskApp";

/** What the window offers on each page: its name and questions that fit what you are looking at. */
const CONTEXTS: { match: (p: string) => boolean; label: string; title: string; suggestions: string[] }[] = [
  { match: (p) => p.startsWith("/today"), label: "Ask about today", title: "Ask about today", suggestions: ["Is anything on his list not being given?", "When is penicillamine due?", "What should I watch for tonight?"] },
  { match: (p) => p.startsWith("/appointments"), label: "Ask about visits", title: "Ask about his visits", suggestions: ["What should we ask at his next recheck?", "What records are missing?", "Does his recheck need fasting?"] },
  { match: (p) => p.startsWith("/meds"), label: "Ask about his meds", title: "Ask about his medications", suggestions: ["Is anything on his list not being given?", "Which Cerenia schedule is current?", "How often does he take Atopica?"] },
  { match: (p) => p.startsWith("/labs"), label: "Ask about his labs", title: "Ask about his labs", suggestions: ["Is his ALT trend moving the right way?", "What was his liver copper level?", "What is ALKP and why does it matter?"] },
  { match: (p) => p.startsWith("/history") || p.startsWith("/timeline"), label: "Ask about his history", title: "Ask about his history", suggestions: ["How did his liver problem start?", "What has been recommended and not done?", "What happened in 2024?"] },
  { match: (p) => p.startsWith("/check-in"), label: "Ask about check-ins", title: "Ask about his check-ins", suggestions: ["What do the stool scores mean?", "When should I call the vet?"] },
  { match: (p) => p.startsWith("/food"), label: "Ask about his food", title: "Ask about his food", suggestions: ["Are his freeze-dried treats allowed?", "Can he have blueberries?", "What did he eat before his diagnosis?"] },
  { match: (p) => p.startsWith("/visit-prep"), label: "Ask about his visit", title: "Ask about his next visit", suggestions: ["What should we ask at his next recheck?", "What records are missing?"] },
  { match: (p) => p.startsWith("/guide") || p.startsWith("/diet-history") || p.startsWith("/your-dog"), label: "Ask a question", title: "Ask a question", suggestions: ["What does the guide say about copper in food?", "What did he eat before his diagnosis?"] },
];

/**
 * A floating chat window on every page except Ask itself. It is the same agent, tasks and sources as the Ask page, and it
 * keeps its conversation while you move between pages. On a phone it opens as a full-height sheet.
 */
export function ChatDock({ profile }: { profile: AskProfile }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false); // mount the chat on first open, then keep it so the answer survives closing
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setTimeout(() => openerRef.current?.focus(), 0); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname === "/") return null;
  const ctx = CONTEXTS.find((x) => x.match(pathname));
  const context: AskContext = { title: ctx?.title ?? "Ask about Theo", suggestions: ctx?.suggestions ?? ["Is his ALT trend moving the right way?", "Are his freeze-dried treats allowed?", "What has been recommended and not done?"] };
  const label = ctx?.label ?? "Ask about Theo";

  return (
    <div className="no-print">
      {!open && (
        <button
          ref={openerRef} type="button" onClick={() => { setOpen(true); setUsed(true); }} aria-label={`Open the chat: ${label}`} aria-haspopup="dialog"
          className="chat-fab fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-bold text-on-brand shadow-[0_8px_24px_rgba(23,19,42,0.25)] md:bottom-6 md:right-6 md:w-auto md:px-5"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
          <span className="hidden md:inline">{label}</span>
        </button>
      )}
      {used && (
        <div
          role="dialog" aria-label={label} aria-modal="false" hidden={!open}
          className={`fixed inset-x-2 bottom-[4.75rem] top-16 z-50 flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_12px_40px_rgba(23,19,42,0.3)] md:inset-x-auto md:bottom-6 md:right-6 md:top-auto md:h-[min(680px,calc(100vh-7rem))] md:w-[420px] md:rounded-2xl ${open ? "flex" : "hidden"}`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2">
            <p className="text-[15px] font-extrabold tracking-tight text-ink">{label}</p>
            <button ref={closeRef} type="button" onClick={() => { setOpen(false); setTimeout(() => openerRef.current?.focus(), 0); }} aria-label="Close the chat" className="flex h-11 w-11 items-center justify-center rounded-full text-ink2 hover:bg-brand-soft">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <div data-chat-scroll className="flex-1 overflow-y-auto p-4 pb-6">
            <AskApp profile={profile} compact context={context} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
