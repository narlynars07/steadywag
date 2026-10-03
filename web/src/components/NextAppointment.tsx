"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { KIND_LABEL, nextAppointment, parse, snapshot, subscribe } from "@/lib/appointments";
import { useLocalDay } from "@/lib/useLocalDay";
import { whenLabel } from "./AppointmentsView";

/** A one-line "next appointment" card for Today and Visit prep, read from this browser only. */
export function NextAppointment() {
  const today = useLocalDay();
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const next = today ? nextAppointment(parse(raw), today) : null;
  if (!today) return null;
  return (
    <Link href="/appointments" className="no-print flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-brand2">
      <span className="min-w-0">
        <span className="block text-xs font-bold uppercase tracking-wide text-muted">Next appointment</span>
        {next ? (
          <span className="block text-[15px] font-bold text-ink">{KIND_LABEL[next.kind]}{next.title ? ` · ${next.title}` : ""}<span className="block text-sm font-normal text-ink2">{whenLabel(next)}{next.place ? ` · ${next.place}` : ""}</span></span>
        ) : (
          <span className="block text-[15px] font-bold text-ink">None scheduled <span className="font-normal text-brand2">· Add one</span></span>
        )}
      </span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}
