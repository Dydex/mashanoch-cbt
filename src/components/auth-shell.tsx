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
    <div className="flex min-h-screen bg-neutral-900">
      <aside
        className="relative hidden w-[42%] shrink-0 flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(4,7,16,0.62) 0%, rgba(4,7,16,0.58) 40%, rgba(2,4,9,0.92) 100%), " +
            "linear-gradient(rgba(8,12,28,0.42), rgba(8,12,28,0.42)), " +
            "url(/login-hero.jpg), " +
            "radial-gradient(120% 120% at 20% 10%, #16213a 0%, #0b1120 45%, #04060b 100%)",
          backgroundSize: "cover, cover, cover, cover",
          backgroundPosition: "center, center, center 40%, center",
        }}
      >
        <div className="relative flex flex-1 flex-col items-center justify-center text-center">
          <BrandMark size="lg" className="mb-6" fallback="none" />
          <h1 className="text-5xl font-bold tracking-tight text-white drop-shadow-lg">
            Mashanoch
          </h1>
          <p className="mt-3 text-sm font-semibold tracking-[0.32em] text-amber-400 drop-shadow">
            PRIVATE SCHOOLS
          </p>
        </div>

        <div className="relative text-center">
          <p className="text-sm font-semibold tracking-wide text-amber-400 drop-shadow">
            {label}
          </p>
          <p className="mt-1 text-sm text-white/70 drop-shadow">{sublabel}</p>
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="rounded-2xl bg-white p-8 shadow-2xl sm:p-10">
            {children}
          </div>
          {footer}
        </div>
      </main>
    </div>
  );
}
