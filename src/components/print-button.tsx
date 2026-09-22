"use client";

/** Opens the browser's print dialogue. Hidden on the printed page itself. */
export default function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white
                 transition hover:bg-[var(--primary-hover)]"
    >
      {label}
    </button>
  );
}
