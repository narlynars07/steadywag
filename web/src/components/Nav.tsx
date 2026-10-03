"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Two jobs, so the nav says which is which: Theo's case (his records), and what any family can use for their own dog.
const GROUPS: { label?: string; links: { href: string; label: string }[] }[] = [
  {
    label: "Theo's case",
    links: [
      { href: "/", label: "Overview" },
      { href: "/timeline", label: "Timeline" },
      { href: "/labs", label: "Labs" },
      { href: "/meds", label: "Medications" },
      { href: "/food", label: "Food" },
    ],
  },
  { links: [{ href: "/ask", label: "Ask the records" }] },
  { links: [{ href: "/visit-prep", label: "Visit prep" }] },
  {
    label: "For your dog",
    links: [
      { href: "/diet-history", label: "Diet history" },
      { href: "/guide", label: "Guide" },
    ],
  },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto w-full max-w-5xl px-4 pb-2 pt-3 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 font-serif text-xl font-semibold text-ink">
          <Image src="/logo.png" alt="" width={30} height={30} priority className="rounded-[9px]" />
          Steadywag
        </Link>
        <nav aria-label="Main" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {GROUPS.map((g, gi) => (
            <div
              key={gi}
              role="group"
              aria-label={g.label}
              className={`flex max-w-full flex-wrap items-center gap-x-1 gap-y-1 ${gi > 0 ? "border-l border-line pl-3" : ""}`}
            >
              {g.label && <span className="mr-1 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-brand2">{g.label}</span>}
              {g.links.map((l) => {
                const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${
                      active ? "bg-brand text-on-brand" : "text-muted hover:bg-brand-soft hover:text-ink"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
    </header>
  );
}
