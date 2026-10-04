/**
 * A one-line, visible reminder that personal logs live in this browser only, with a link to the backup section.
 * It exists so nobody is surprised when the same page on another device is empty.
 */
export function DeviceOnlyNote({ what }: { what: string }) {
  return (
    <p className="no-print flex items-start gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm leading-snug text-ink2">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-brand2">
        <rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" />
      </svg>
      <span>
        <strong className="font-semibold text-ink">Saved on this device only.</strong> {what} stay in this browser, so another phone or computer will look empty. Nothing is stored on a server.{" "}
        <a href="#keep-a-copy" className="font-semibold text-brand2 underline-offset-4 hover:underline">Move them with a backup</a>
      </span>
    </p>
  );
}
