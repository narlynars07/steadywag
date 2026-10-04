import Link from "next/link";

export const metadata = { title: "Offline · Steadywag" };

/** Shown when a page that has not been opened before is requested without a connection. */
export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">You&apos;re offline</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink2">
        This page hasn&apos;t been opened on this device yet, so it isn&apos;t saved. Pages you&apos;ve already visited still open, and your check-ins and appointments work without a connection.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href="/check-in" className="flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-bold text-on-brand">Daily check-in</Link>
        <Link href="/appointments" className="flex min-h-11 items-center rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-ink">Appointments</Link>
      </div>
      <p className="mt-4 text-sm text-muted">Asking a question needs a connection.</p>
    </div>
  );
}
