"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AskApp, type AskProfile } from "./AskApp";

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

  return (
    <div className="no-print">
      {!open && (
        <button
          ref={openerRef} type="button" onClick={() => { setOpen(true); setUsed(true); }} aria-label="Open the Steadywag chat" aria-haspopup="dialog"
          className="fixed bottom-24 right-4 z-40 flex min-h-14 items-center gap-2 rounded-full bg-brand px-5 text-[15px] font-bold text-on-brand shadow-[0_8px_24px_rgba(23,19,42,0.25)] md:bottom-6 md:right-6"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
          Ask about Theo
        </button>
      )}
      {used && (
        <div
          role="dialog" aria-label="Ask about Theo" aria-modal="false" hidden={!open}
          className={`fixed inset-x-0 bottom-0 top-14 z-50 flex-col overflow-hidden rounded-t-2xl border border-line bg-paper shadow-[0_12px_40px_rgba(23,19,42,0.3)] md:inset-x-auto md:bottom-6 md:right-6 md:top-auto md:h-[min(680px,calc(100vh-7rem))] md:w-[420px] md:rounded-2xl ${open ? "flex" : "hidden"}`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2">
            <p className="text-[15px] font-extrabold tracking-tight text-ink">Ask about Theo</p>
            <button ref={closeRef} type="button" onClick={() => { setOpen(false); setTimeout(() => openerRef.current?.focus(), 0); }} aria-label="Close the chat" className="flex h-11 w-11 items-center justify-center rounded-full text-ink2 hover:bg-brand-soft">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <AskApp profile={profile} compact />
          </div>
        </div>
      )}
    </div>
  );
}
