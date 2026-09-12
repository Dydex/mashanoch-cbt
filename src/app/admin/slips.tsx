"use client";

import type { Slip } from "./actions";

/**
 * Printable slips. One card per student — cut and hand out.
 * The PIN is visible here and nowhere else, ever again.
 */
export function Slips({ slips }: { slips: Slip[] }) {
  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between gap-4 print:hidden">
        <p className="text-sm font-semibold text-[var(--danger)]">
          Print or write these down now — they cannot be shown again.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold
                     text-[var(--primary-fg)] transition hover:bg-[var(--primary-hover)]"
        >
          Print slips
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 print:gap-2">
        {slips.map((s) => (
          <div
            key={s.username}
            className="rounded-xl border-2 border-dashed border-[var(--border-strong)]
                       bg-[var(--surface)] p-4 print:break-inside-avoid print:border-black"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
              Mashanoch CBT
            </p>
            <p className="mt-1.5 truncate text-sm font-semibold">{s.fullName}</p>
            <p className="text-xs text-[var(--text-muted)]">{s.class}</p>
            <dl className="mt-3 space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-[11px] text-[var(--text-muted)]">ID</dt>
                <dd className="font-mono text-base font-semibold tracking-widest">
                  {s.username}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-[11px] text-[var(--text-muted)]">PIN</dt>
                <dd className="font-mono text-base font-semibold tracking-widest">
                  {s.pin}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
