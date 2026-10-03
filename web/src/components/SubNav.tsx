"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HISTORY = [
  { href: "/history", label: "His story" },
  { href: "/timeline", label: "Timeline" },
  { href: "/labs", label: "Labs" },
  { href: "/meds", label: "Medications" },
  { href: "/visit-prep", label: "Visit prep" },
];
const TODAY_GROUP = [
  { href: "/today", label: "Today" },
  { href: "/appointments", label: "Appointments" },
  { href: "/sitter", label: "Sitter brief" },
  { href: "/food", label: "Food" },
];
const YOUR_DOG = [
  { href: "/your-dog", label: "Your dog" },
  { href: "/diet-history", label: "Diet history" },
  { href: "/guide", label: "Guide" },
];

/** The pages inside a destination, shown as chips at the top of each. Chips wrap, so nothing scrolls sideways. */
export function SubNav() {
  const pathname = usePathname();

  const items = TODAY_GROUP.some((i) => pathname.startsWith(i.href)) ? TODAY_GROUP : HISTORY.some((i) => pathname.startsWith(i.href)) ? HISTORY : YOUR_DOG.some((i) => pathname.startsWith(i.href)) ? YOUR_DOG : null;
  if (!items) return null;

  return (
    <nav aria-label="In this section" className="no-print mb-5 flex flex-wrap gap-2">
      {items.map((i) => {
        const active = pathname === i.href || (i.href !== "/history" && i.href !== "/your-dog" && i.href !== "/today" && pathname.startsWith(i.href));
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${
              active ? "border-brand bg-brand-soft text-brand2" : "border-line bg-surface text-ink2 hover:bg-brand-soft"
            }`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
