"use client";

import { useSyncExternalStore } from "react";
import { getTheme, setTheme, subscribeTheme, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "Auto", icon: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></> },
  { value: "light", label: "Light", icon: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></> },
  { value: "dark", label: "Dark", icon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /> },
];

/** Auto / Light / Dark. "compact" is icons only, for the top bar; "full" shows labels, for the phone menu. */
export function ThemeToggle({ variant = "compact" }: { variant?: "compact" | "full" | "cycle" }) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "system" as Theme);
  if (variant === "cycle") {
    // One small button for the top bar: it shows the current choice, and each press moves to the next (Auto, Light, Dark).
    const i = OPTIONS.findIndex((o) => o.value === theme);
    const next = OPTIONS[(i + 1) % OPTIONS.length];
    return (
      <button
        type="button" onClick={() => setTheme(next.value)} aria-label={`Color theme: ${OPTIONS[i].label}. Switch to ${next.label}.`} title={`Theme: ${OPTIONS[i].label}. Click for ${next.label}.`}
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-brand-soft hover:text-ink"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{OPTIONS[i].icon}</svg>
      </button>
    );
  }
  return (
    <div role="radiogroup" aria-label="Color theme" className={`inline-flex rounded-full border border-line bg-paper p-0.5 ${variant === "full" ? "w-full" : ""}`}>
      {OPTIONS.map((o) => {
        const on = theme === o.value;
        return (
          <button
            key={o.value} type="button" role="radio" aria-checked={on} aria-label={`${o.label} theme`} title={`${o.label} theme`} onClick={() => setTheme(o.value)}
            className={`flex items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors ${variant === "full" ? "min-h-11 flex-1 px-3 text-sm" : "h-8 w-8"} ${on ? "bg-brand text-on-brand" : "text-muted hover:text-ink"}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{o.icon}</svg>
            {variant === "full" && <span>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
