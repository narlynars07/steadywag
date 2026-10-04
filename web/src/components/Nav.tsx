"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { InstallApp } from "./InstallApp";
import { ThemeToggle } from "./ThemeToggle";
import { resetConversation } from "@/lib/conversation";
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
const TodayIcon = svg(<><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>);
const ApptIcon = svg(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4M9.5 15l2 2 3.5-3.5" /></>);
const MoreIcon = svg(<><circle cx="6" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18" cy="12" r="1.3" /></>);
const CheckInIcon = svg(<><circle cx="12" cy="12" r="8" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>);
const HistoryIcon = svg(<path d="M4 19h16M7 16v-6M12 16V6M17 16v-4" />);
const DogIcon = svg(
  <>
    <circle cx="8" cy="7.5" r="1.8" /><circle cx="16" cy="7.5" r="1.8" /><circle cx="5" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
    <path d="M12 11.5c-2.8 0-5 2.9-5 5.1 0 1.8 1.4 2.7 2.9 2.7.9 0 1.3-.4 2.1-.4s1.2.4 2.1.4c1.5 0 2.9-.9 2.9-2.7 0-2.2-2.2-5.1-5-5.1z" />
  </>,
);

/**
 * The six destinations. The top bar on a larger screen shows all of them. On a phone the bottom bar shows the first four,
 * and History and Your dog open from a "More" sheet so the bar stays roomy. Existing pages keep their URLs.
 */
const TABS: { href: string; label: string; Icon: (p: IconProps) => ReactNode; owns: (path: string) => boolean; phone: boolean }[] = [
  { href: "/", label: "Ask", Icon: AskIcon, owns: (p) => p === "/", phone: true },
  { href: "/today", label: "Today", Icon: TodayIcon, owns: (p) => p.startsWith("/today") || p.startsWith("/food") || p.startsWith("/sitter"), phone: true },
  { href: "/check-in", label: "Check-in", Icon: CheckInIcon, owns: (p) => p.startsWith("/check-in"), phone: true },
  { href: "/appointments", label: "Appointments", Icon: ApptIcon, owns: (p) => p.startsWith("/appointments"), phone: true },
  {
    href: "/history", label: "History", Icon: HistoryIcon, phone: false,
    owns: (p) => ["/history", "/timeline", "/labs", "/meds", "/visit-prep", "/changes", "/dna"].some((r) => p.startsWith(r)),
  },
  { href: "/your-dog", label: "Your dog", Icon: DogIcon, phone: false, owns: (p) => ["/your-dog", "/diet-history", "/guide"].some((r) => p.startsWith(r)) },
];

/** Everything the phone's bottom bar does not show, grouped. */
const MORE: { title: string; links: [string, string][] }[] = [
  { title: "History", links: [["His story", "/history"], ["Timeline", "/timeline"], ["Labs", "/labs"], ["Medications", "/meds"], ["Visit prep", "/visit-prep"], ["His DNA", "/dna"], ["What changed", "/changes"]] },
  { title: "Your dog", links: [["Your dog", "/your-dog"], ["Diet history", "/diet-history"], ["Guide", "/guide"]] },
  { title: "Around today", links: [["Sitter brief", "/sitter"], ["Food", "/food"]] },
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
  // The More sheet remembers the page it was opened on, so it closes by itself as soon as you go somewhere. Escape closes it too.
  const [moreAt, setMoreAt] = useState<string | null>(null);
  const more = moreAt === pathname;
  const setMore = (open: boolean) => setMoreAt(open ? pathname : null);
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreAt(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [more]);
  const moreActive = TABS.some((x) => !x.phone && x.owns(pathname));
  return (
    <>
      <header className="no-print sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" onClick={() => resetConversation()} className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-ink">
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
                  aria-label={t.label}
                  title={t.label}
                  onClick={() => { if (t.href === "/") resetConversation(); }}
                  className={`flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors ${
                    active ? "bg-brand text-on-brand" : "text-muted hover:bg-brand-soft hover:text-ink"
                  }`}
                >
                  <t.Icon className="h-[18px] w-[18px]" />
                  <span className="hidden lg:inline">{t.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <span className="hidden md:block"><ThemeToggle variant="cycle" /></span>
            <span className="text-[13px] text-muted md:hidden">{shortDate(day)}</span>
            <Link href="/history" aria-label="Theo, his history" className="block h-8 w-8 overflow-hidden rounded-full border-2 border-surface shadow-[0_0_0_1.5px_var(--brand)]">
              <Image src="/theo.jpg" alt="Theo" width={64} height={64} className="h-full w-full object-cover object-[50%_30%]" />
            </Link>
          </div>
        </div>
      </header>

      <nav
        aria-label="Main"
        className="mobile-tabbar no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {TABS.filter((x) => x.phone).map((x) => {
          const active = x.owns(pathname);
          return (
            <Link
              key={x.href}
              href={x.href}
              aria-current={active ? "page" : undefined}
              onClick={() => { if (x.href === "/") resetConversation(); }}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] ${
                active ? "bg-brand-soft font-bold text-brand2" : "font-medium text-muted"
              }`}
            >
              <x.Icon />
              <span>{x.label === "Appointments" ? "Appts" : x.label}</span>
            </Link>
          );
        })}
        <button
          type="button" onClick={() => setMore(true)} aria-haspopup="dialog" aria-expanded={more}
          className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] ${moreActive ? "bg-brand-soft font-bold text-brand2" : "font-medium text-muted"}`}
        >
          <MoreIcon />
          <span>More</span>
        </button>
      </nav>

      {more && (
        <div className="no-print fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="More of Steadywag">
          <button type="button" aria-label="Close the menu" onClick={() => setMore(false)} className="absolute inset-0 bg-ink/40" />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_32px_rgba(23,19,42,0.25)]">
            <div className="flex items-center justify-between">
              <p className="text-base font-extrabold tracking-tight text-ink">More</p>
              <button type="button" onClick={() => setMore(false)} aria-label="Close the menu" autoFocus className="flex h-11 w-11 items-center justify-center rounded-full text-ink2 hover:bg-brand-soft">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <section className="mt-3" aria-label="Appearance">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Appearance</p>
              <ThemeToggle variant="full" />
            </section>
            <InstallApp />
            {MORE.map((g) => (
              <section key={g.title} className="mt-3" aria-label={g.title}>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{g.title}</p>
                <ul className="grid grid-cols-2 gap-2">
                  {g.links.map(([label, href]) => {
                    const here = pathname === href || (href !== "/history" && href !== "/your-dog" && pathname.startsWith(href));
                    return (
                      <li key={href}>
                        <Link href={href} aria-current={here ? "page" : undefined}
                          className={`flex min-h-12 items-center rounded-xl border px-3.5 text-sm font-semibold ${here ? "border-brand bg-brand-soft text-brand2" : "border-line bg-paper text-ink"}`}>{label}</Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
