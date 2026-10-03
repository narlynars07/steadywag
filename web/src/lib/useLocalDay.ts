import { useSyncExternalStore } from "react";

/**
 * The viewer's own calendar day ("2026-10-02"), read in the browser so it follows their clock and time zone instead of
 * the server's. Returns "" until the browser has reported it, so server-rendered text never guesses.
 */
const subscribe = () => () => {};

function localIsoDay(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function useLocalDay(): string {
  return useSyncExternalStore(subscribe, localIsoDay, () => "");
}
