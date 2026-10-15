"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NavLink } from "@/components/nav-link";
import type { NavItem } from "@/components/shell";
import { BrandMark } from "@/components/brand-mark";

export function MobileMenu({
  nav,
  sections,
  logout,
}: {
  nav: NavItem[];
  sections?: { title: string; items: NavItem[] }[];
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const close = () => setOpenOn(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenOn(null);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const pending = sections
    ?.flatMap((s) => s.items)
    .reduce((n, i) => n + (typeof i.badge === "number" ? i.badge : 0), 0);

  return (
    <div className="lg:hidden print:hidden">
      <button
        type="button"
        onClick={() => setOpenOn(pathname)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
      >
        <svg
          width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" aria-hidden
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        {!!pending && (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[var(--primary)] px-1 text-center text-[10px] font-semibold leading-4 text-white">
            {pending}
          </span>
        )}
      </button>

      <div
        id="mobile-menu"
        inert={!open}
        className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close menu"
          onClick={close}
          className={`absolute inset-0 bg-[var(--ink)]/50 transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />

        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className={`absolute inset-y-0 left-0 flex w-[82%] max-w-80 flex-col bg-[var(--ink)] text-white shadow-2xl transition-transform duration-200 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
            <BrandMark size="md" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate font-serif text-base font-semibold">
                Mashanoch
              </span>
              <span className="block truncate text-[11px] uppercase tracking-[0.16em] text-white/45">
                Private Schools
              </span>
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Close menu"
              className="grid h-9 w-9 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" aria-hidden
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-5">
            <ul className="space-y-1">
              {nav.map((item) => (
                <li key={item.href}>
                  <NavLink {...item} />
                </li>
              ))}
            </ul>

            {sections?.map((section) => (
              <div key={section.title} className="mt-7">
                <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[.18em] text-white/35">
                  {section.title}
                </p>
                <ul className="space-y-1">
                  {section.items.map((item) => (
                    <li key={item.href + item.label}>
                      <NavLink {...item} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <form action={logout}>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/60 transition hover:bg-white/10 hover:text-white">
                <svg
                  width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden
                >
                  <path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3M15 16l4-4-4-4M19 12H9" />
                </svg>
                Log out
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
