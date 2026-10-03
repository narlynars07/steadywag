"use client";

import { useState } from "react";

export function CopySummary({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button
        onClick={async () => {
          try {
            // The prepared date is stamped here, in the browser, so it matches the person's own calendar day.
            const day = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
            const [title, ...rest] = text.split("\n");
            await navigator.clipboard.writeText([title, `Prepared ${day}.`, ...rest].join("\n"));
            setState("copied");
          } catch {
            setState("failed");
          }
          setTimeout(() => setState("idle"), 2500);
        }}
        className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-on-brand"
      >
        Copy summary
      </button>
      <button onClick={() => window.print()} className="rounded-full border border-line bg-surface px-4 py-2 text-sm hover:bg-brand-soft">
        Print
      </button>
      <span role="status" className="text-sm text-muted">
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Couldn't copy. Select the text below instead." : ""}
      </span>
    </div>
  );
}
