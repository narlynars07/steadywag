"use client";

export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="no-print min-h-11 rounded-xl bg-brand px-5 text-sm font-bold text-on-brand">
      {label}
    </button>
  );
}
