import { useSyncExternalStore } from "react";

/**
 * The viewer's own clock, to the minute, read in the browser so "now" follows their time zone and not the server's.
 * Returns null until the browser has reported it, so server-rendered text never guesses the time of day.
 */
const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 30_000);
  return () => clearInterval(id);
};
const snapshot = () => Math.floor(Date.now() / 60_000);
const server = () => 0;

export function useNow(): { minutes: number; label: string } | null {
  const epochMinute = useSyncExternalStore(subscribe, snapshot, server);
  if (!epochMinute) return null;
  const d = new Date(epochMinute * 60_000);
  return { minutes: d.getHours() * 60 + d.getMinutes(), label: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) };
}
