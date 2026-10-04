"use client";

import { useEffect } from "react";

/** Registers the service worker in production, so Steadywag can be installed and reopened offline. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => { navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => { /* not available here: the site works without it */ }); };
    if (document.readyState === "complete") register(); else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
