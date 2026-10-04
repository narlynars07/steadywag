/**
 * The visitor's color preference: Auto (follow the device), Light or Dark. It is remembered in this browser only, and applied to <html>
 * as data-theme. The layout also applies it before the page paints, so there is no flash of the wrong theme.
 */
export type Theme = "system" | "light" | "dark";
export const THEME_KEY = "steadywag.theme.v1";

let memory: Theme | undefined;
const listeners = new Set<() => void>();

export function getTheme(): Theme {
  if (memory) return memory;
  try { const v = localStorage.getItem(THEME_KEY); return v === "light" || v === "dark" ? v : "system"; } catch { return "system"; }
}

export function subscribeTheme(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
}

export function setTheme(t: Theme) {
  memory = t;
  try { if (t === "system") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, t); } catch { /* storage blocked: the choice still holds for this visit */ }
  const root = document.documentElement;
  if (t === "system") delete root.dataset.theme; else root.dataset.theme = t;
  listeners.forEach((l) => l());
}

/** Runs in <head> before first paint. */
export const THEME_BOOT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
