"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "steadywag.install.later";
const WAIT_DAYS = 30;

function readEnvironment(): "installed" | "ios" | "phone" | "other" {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  if (!window.matchMedia("(max-width: 767px)").matches) return "other"; // phones only: on a computer the browser has its own install icon
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : "phone";
}
const noSubscribe = () => () => {};

function snoozed(): boolean {
  try { const t = Number(localStorage.getItem(KEY)); return !!t && Date.now() - t < WAIT_DAYS * 86_400_000; } catch { return false; }
}

/**
 * A small, one-time card that explains how to add Steadywag to the home screen. It shows on phones only, never once the app is
 * installed, and not on the first screen: it waits for a second page or 20 seconds. "Not now" hides it for 30 days.
 */
export function InstallBanner() {
  const env = useSyncExternalStore(noSubscribe, readEnvironment, () => "other" as const);
  const pathname = usePathname();
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvent(e as InstallEvent); };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  // Count pages seen this visit, and also start a 20 second timer.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const n = Number(sessionStorage.getItem("steadywag.pages") ?? "0") + 1;
      sessionStorage.setItem("steadywag.pages", String(n));
      if (n >= 2) timer = setTimeout(() => setReady(true), 400);
    } catch { /* storage blocked: fall back to the timer below */ }
    const later = setTimeout(() => setReady(true), 20_000);
    return () => { clearTimeout(later); if (timer) clearTimeout(timer); };
  }, [pathname]);

  const canShow = !hidden && ready && !snoozed() && (env === "ios" || (env === "phone" && !!event));
  if (!canShow) return null;

  const later = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } setHidden(true); };
  return (
    <div role="dialog" aria-label="Add Steadywag to your home screen" className="install-banner no-print fixed inset-x-3 bottom-[5rem] z-[55] rounded-2xl bg-brand p-4 text-on-brand shadow-[0_0_0_2px_rgba(255,255,255,0.35),0_12px_40px_rgba(0,0,0,0.45)] md:hidden">
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded-xl bg-white p-1"><Image src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 rounded-lg" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold leading-tight tracking-tight text-on-brand">Keep Steadywag on your home screen</p>
          {env === "ios" ? (
            <ol className="mt-1.5 space-y-1 text-sm leading-snug text-on-brand">
              <li><strong className="font-bold underline decoration-current/50 underline-offset-2">1.</strong> Tap <strong className="font-bold underline decoration-current/50 underline-offset-2">Share</strong> <span aria-hidden="true">(the square with an arrow)</span> in Safari.</li>
              <li><strong className="font-bold underline decoration-current/50 underline-offset-2">2.</strong> Choose <strong className="font-bold underline decoration-current/50 underline-offset-2">Add to Home Screen</strong>.</li>
            </ol>
          ) : (
            <p className="mt-1 text-sm leading-snug text-on-brand">One tap opens it full screen, and your check-ins and appointments work even without a signal.</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {env === "phone" && event && (
          <button type="button" onClick={async () => { await event.prompt(); const r = await event.userChoice; setEvent(null); if (r.outcome !== "accepted") later(); else setHidden(true); }}
            className="min-h-11 flex-1 rounded-xl bg-on-brand px-4 text-sm font-bold text-brand">Install</button>
        )}
        <button type="button" onClick={later} className={`min-h-11 rounded-xl border border-on-brand/60 px-4 text-sm font-semibold text-on-brand ${env === "ios" ? "flex-1" : ""}`}>Not now</button>
      </div>
    </div>
  );
}
