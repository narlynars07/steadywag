"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** What kind of device this is, read once in the browser: already installed, an iPhone or iPad, or anything else. */
function readEnvironment(): "installed" | "ios" | "other" {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : "other";
}
const noSubscribe = () => () => {};

/**
 * "Install Steadywag" for the phone menu. Chrome and Android offer a real install button; iPhone has no such button, so it shows the
 * two taps instead. Nothing shows once the app is already installed.
 */
export function InstallApp() {
  const env = useSyncExternalStore(noSubscribe, readEnvironment, () => "installed" as const);
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvent(e as InstallEvent); };
    const onInstalled = () => { setDone(true); setEvent(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (done || env === "installed" || (!event && env !== "ios")) return null;
  return (
    <section className="mt-3" aria-label="Install Steadywag">
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Install</p>
      {event ? (
        <button type="button" onClick={async () => { await event.prompt(); await event.userChoice; setEvent(null); }}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold text-on-brand">Add Steadywag to your home screen</button>
      ) : (
        <p className="rounded-xl border border-line bg-paper px-3.5 py-3 text-sm leading-snug text-ink2">To add it to your home screen, tap <strong className="font-semibold text-ink">Share</strong> in Safari, then <strong className="font-semibold text-ink">Add to Home Screen</strong>.</p>
      )}
    </section>
  );
}
