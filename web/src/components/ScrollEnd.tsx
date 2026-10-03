"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** A horizontally scrolling area that opens at its right edge, so the most recent dates show first. */
export function ScrollEnd({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);
  return (
    <div ref={ref} className="overflow-x-auto pb-2" tabIndex={0} role="group" aria-label={label}>
      {children}
    </div>
  );
}
