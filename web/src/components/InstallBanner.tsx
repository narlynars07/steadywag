"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "steadywag.install.later";
const WAIT_DAYS = 30;

type Env = "installed" | "ios" | "phone" | "desktop" | "safari-mac";

/** Where Steadywag is open: already installed, an iPhone or iPad, an Android phone, a computer with an install prompt, or Safari on a Mac. */
function readEnvironment(): Env {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, but a Mac has no touch screen.
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (window.matchMedia("(max-width: 767px)").matches) return "phone";
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua)) return "safari-mac";
  return "desktop"; // Chrome and Edge fire an install event; other browsers never show the card
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
  const env = useSyncExternalStore(noSubscribe, readEnvironment, () => "installed" as Env);
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

  const canShow = !hidden && ready && !snoozed() && (env === "ios" || env === "safari-mac" || ((env === "phone" || env === "desktop") && !!event));
  if (!canShow) return null;

  const later = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } setHidden(true); };
  return (
    <div role="dialog" aria-label="Install Steadywag as an app" className="install-banner no-print fixed inset-x-3 bottom-[5rem] z-[55] rounded-2xl md:inset-x-auto md:bottom-6 md:left-6 md:w-[24rem] bg-brand p-4 text-on-brand shadow-[0_0_0_2px_rgba(255,255,255,0.35),0_12px_40px_rgba(0,0,0,0.45)]">
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded-xl bg-white p-1"><Image src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 rounded-lg" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold leading-tight tracking-tight text-on-brand">{env === "desktop" ? "Install Steadywag as an app" : env === "safari-mac" ? "Add Steadywag to your Dock" : "Keep Steadywag on your home screen"}</p>
          {env === "safari-mac" ? (
            <ol className="mt-1.5 space-y-1 text-sm leading-snug text-on-brand">
              <li><strong className="font-bold underline decoration-current/50 underline-offset-2">1.</strong> In the Safari menu bar, choose <strong className="font-bold underline decoration-current/50 underline-offset-2">File</strong>.</li>
              <li><strong className="font-bold underline decoration-current/50 underline-offset-2">2.</strong> Choose <strong className="font-bold underline decoration-current/50 underline-offset-2">Add to Dock</strong>.</li>
            </ol>
          ) : env === "ios" ? (
            <ol className="mt-1.5 space-y-1 text-sm leading-snug text-on-brand">
              <li><strong className="font-bold underline decoration-current/50 underline-offset-2">1.</strong> Tap <strong className="font-bold underline decoration-current/50 underline-offset-2">Share</strong> <span aria-hidden="true">(the square with an arrow)</span> in Safari.</li>
              <li><strong className="font-bold underline decoration-current/50 underline-offset-2">2.</strong> Choose <strong className="font-bold underline decoration-current/50 underline-offset-2">Add to Home Screen</strong>.</li>
            </ol>
          ) : (
            <p className="mt-1 text-sm leading-snug text-on-brand">It opens in its own window, and your check-ins and appointments work even without a signal.</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {(env === "phone" || env === "desktop") && event && (
          <button type="button" onClick={async () => { await event.prompt(); const r = await event.userChoice; setEvent(null); if (r.outcome !== "accepted") later(); else setHidden(true); }}
            className="min-h-11 flex-1 rounded-xl bg-on-brand px-4 text-sm font-bold text-brand">Install</button>
        )}
        <button type="button" onClick={later} className={`min-h-11 rounded-xl border border-on-brand/60 px-4 text-sm font-semibold text-on-brand ${event ? "" : "flex-1"}`}>Not now</button>
      </div>
    </div>
  );
}
