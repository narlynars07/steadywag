"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useLocalDay } from "@/lib/useLocalDay";

type IconProps = { className?: string };
const svg = (children: ReactNode) =>
  function Icon({ className }: IconProps) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
        {children}
      </svg>
    );
  };

const AskIcon = svg(<path d="M4 5h16v11H9l-5 4z" />);
const TodayIcon = svg(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>);
const CheckInIcon = svg(<><circle cx="12" cy="12" r="8" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>);
const HistoryIcon = svg(<path d="M4 19h16M7 16v-6M12 16V6M17 16v-4" />);
const DogIcon = svg(
  <>
    <circle cx="8" cy="7.5" r="1.8" /><circle cx="16" cy="7.5" r="1.8" /><circle cx="5" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
    <path d="M12 11.5c-2.8 0-5 2.9-5 5.1 0 1.8 1.4 2.7 2.9 2.7.9 0 1.3-.4 2.1-.4s1.2.4 2.1.4c1.5 0 2.9-.9 2.9-2.7 0-2.2-2.2-5.1-5-5.1z" />
  </>,
);

/** The five destinations. Existing pages keep their URLs and sit under the destination that links to them. */
const TABS: { href: string; label: string; Icon: (p: IconProps) => ReactNode; owns: (path: string) => boolean }[] = [
  { href: "/", label: "Ask", Icon: AskIcon, owns: (p) => p === "/" },
  { href: "/today", label: "Today", Icon: TodayIcon, owns: (p) => p.startsWith("/today") || p.startsWith("/food") },
  { href: "/check-in", label: "Check-in", Icon: CheckInIcon, owns: (p) => p.startsWith("/check-in") },
  {
    href: "/history", label: "History", Icon: HistoryIcon,
    owns: (p) => ["/history", "/timeline", "/labs", "/meds", "/visit-prep"].some((r) => p.startsWith(r)),
  },
  { href: "/your-dog", label: "Your dog", Icon: DogIcon, owns: (p) => ["/your-dog", "/diet-history", "/guide"].some((r) => p.startsWith(r)) },
];

/** "2026-10-03" -> "Sat, Oct 3", read from the viewer's own clock. Empty until the browser reports it. */
function shortDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function Nav() {
  const pathname = usePathname();
  const day = useLocalDay();
  return (
    <>
      <header className="no-print sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-ink">
            <Image src="/logo.png" alt="" width={32} height={32} priority className="rounded-[9px]" />
            Steadywag
          </Link>

          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
            {TABS.map((t) => {
              const active = t.owns(pathname);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors ${
                    active ? "bg-brand text-on-brand" : "text-muted hover:bg-brand-soft hover:text-ink"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <span className="text-[13px] text-muted">{shortDate(day)}</span>
            <Link href="/history" aria-label="Theo, his history" className="block h-8 w-8 overflow-hidden rounded-full border-2 border-surface shadow-[0_0_0_1.5px_var(--brand)]">
              <Image src="/theo.jpg" alt="Theo" width={64} height={64} className="h-full w-full object-cover object-[50%_30%]" />
            </Link>
          </div>
        </div>
      </header>

      <nav
        aria-label="Main"
        className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {TABS.map((t) => {
          const active = t.owns(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] ${
                active ? "bg-brand-soft font-bold text-brand2" : "font-medium text-muted"
              }`}
            >
              <t.Icon />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
