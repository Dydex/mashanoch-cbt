"use client";

import { useState } from "react";
import { NavLink } from "@/components/nav-link";
import type { NavItem } from "@/components/shell";
import { SIDEBAR_COOKIE } from "@/lib/constants";
import { BrandMark } from "@/components/brand-mark";

/**
 * Desktop sidebar with a collapse toggle.
 *
 * The choice is kept in a cookie rather than localStorage so the server
 * already knows it and renders the right width first time — no flash of an
 * expanded sidebar collapsing after hydration.
 */
export function Sidebar({
  nav,
  sections,
  logout,
  initialCollapsed = false,
}: {
  nav: NavItem[];
  sections?: { title: string; items: NavItem[] }[];
  logout: () => Promise<void>;
  initialCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    // A year, path-wide, lax: it is a display preference, nothing sensitive.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={`hidden shrink-0 flex-col bg-[var(--ink)] text-white transition-[width]
                  duration-200 ease-out lg:sticky lg:top-0 lg:flex lg:h-screen print:hidden ${
                    collapsed ? "w-[76px]" : "w-[272px]"
                  }`}
    >
      {/* brand + toggle */}
      <div
        className={`flex items-center border-b border-white/10 py-6 ${
          collapsed ? "flex-col gap-4 px-3" : "gap-3 px-6"
        }`}
      >
        <BrandMark size="md" />

        {!collapsed && (
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate font-serif text-base font-semibold">
              Mashanoch
            </span>
            <span className="block truncate text-[11px] uppercase tracking-[0.16em] text-white/45">
              Private Schools
            </span>
          </span>
        )}

        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/50
                     transition hover:bg-white/10 hover:text-white"
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
      </div>

      <nav className={`flex-1 overflow-y-auto py-5 ${collapsed ? "px-3" : "px-4"}`}>
        <ul className="space-y-1">
          {nav.map((item) => (
            <li key={item.href}>
              <NavLink {...item} collapsed={collapsed} />
            </li>
          ))}
        </ul>

        {sections?.map((section) => (
          <div key={section.title} className="mt-7">
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-8 bg-white/10" />
            ) : (
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[.18em] text-white/35">
                {section.title}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.href + item.label}>
                  <NavLink {...item} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={`border-t border-white/10 ${collapsed ? "p-3" : "p-4"}`}>
        <form action={logout}>
          <button
            title={collapsed ? "Log out" : undefined}
            className={`flex w-full items-center rounded-lg py-2.5 text-sm text-white/60
                        transition hover:bg-white/10 hover:text-white ${
                          collapsed ? "justify-center px-0" : "gap-3 px-3"
                        }`}
          >
            <LogoutIcon />
            <span className={collapsed ? "sr-only" : undefined}>Log out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d={collapsed ? "m13 9 3 3-3 3" : "m17 9-3 3 3 3"} />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3M15 16l4-4-4-4M19 12H9" />
    </svg>
  );
}
