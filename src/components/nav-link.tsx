"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({
  href,
  label,
  icon,
  badge,
  exact = true,
  collapsed = false,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number | string;
  exact?: boolean;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}

      title={collapsed ? label : undefined}
      className={`flex items-center rounded-lg py-2.5 text-sm transition ${
        collapsed ? "justify-center px-0" : "gap-3 px-3"
      } ${
        active
          ? "bg-[var(--primary)] font-semibold text-white shadow-[0_8px_20px_rgba(176,18,26,.35)]"
          : "text-white/60 hover:bg-white/[.07] hover:text-white"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className={collapsed ? "sr-only" : "min-w-0 flex-1 truncate"}>
        {label}
      </span>
      {badge !== undefined && !collapsed && (
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            active ? "bg-white/20 text-white" : "bg-[var(--primary)] text-white"
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

export function MobileNavLink({
  href,
  label,
  icon,
  exact = true,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-w-18 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-medium transition ${
        active ? "bg-[var(--primary)] text-white" : "text-white/55"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
