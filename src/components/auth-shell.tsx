import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

/**
 * Split-screen shell for the two sign-in surfaces. Students and staff get the
 * same frame and differ only in the label on the hero panel and the link
 * beneath the card, so neither page can drift away from the other.
 */
export function AuthShell({
  label,
  sublabel,
  children,
  footer,
}: {
  label: string;
  sublabel: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[var(--ink)]">
      <aside
        className="relative hidden w-[45%] shrink-0 flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{
          // The crest's charcoal over the photo, deepening towards the foot of
          // the panel so the label below stays readable.
          backgroundImage:
            "linear-gradient(to bottom, rgba(28,31,38,0.72) 0%, rgba(28,31,38,0.78) 45%, rgba(14,16,20,0.95) 100%), " +
            "linear-gradient(115deg, rgba(176,18,26,0.35) 0%, rgba(176,18,26,0) 55%), " +
            "url(/login-hero.jpg)",
          backgroundSize: "cover, cover, cover",
          backgroundPosition: "center, center, center 40%",
        }}
      >
        <div className="relative flex flex-1 flex-col items-center justify-center text-center">
          <BrandMark size="lg" className="mb-7" fallback="none" />
          <h1 className="font-serif text-5xl font-bold tracking-tight text-white drop-shadow-lg">
            Mashanoch
          </h1>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.34em] text-white/75">
            Private Schools
          </p>
          <span className="mt-6 h-px w-16 bg-[var(--primary)]" />
          <p className="mt-6 max-w-xs text-sm italic text-white/60">
            Raising disciplined leaders
          </p>
        </div>

        <div className="relative text-center">
          <p className="inline-flex rounded-full bg-[var(--primary)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white">
            {label}
          </p>
          <p className="mt-2.5 text-sm text-white/65">{sublabel}</p>
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-[var(--bg)] p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <BrandMark size="md" />
            <span className="leading-tight">
              <span className="block font-serif text-lg font-semibold text-[var(--text)]">
                Mashanoch
              </span>
              <span className="block text-[10px] uppercase tracking-[0.18em] text-[var(--text-subtle)]">
                Private Schools
              </span>
            </span>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-white p-8 shadow-[var(--shadow-lg)] sm:p-10">
            {children}
          </div>
          {footer}
        </div>
      </main>
    </div>
  );
}
