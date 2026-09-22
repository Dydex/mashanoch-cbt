import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/login/actions";
import { Avatar } from "@/components/ui";
import { MobileNavLink } from "@/components/nav-link";
import { Sidebar } from "@/components/sidebar";
import { BrandMark } from "@/components/brand-mark";
import { SIDEBAR_COOKIE } from "@/lib/constants";
import { cookies } from "next/headers";

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number | string;
  /** Exact path match by default; false keeps it lit on nested routes. */
  exact?: boolean;
};

/**
 * Sidebar + topbar shell shared by the staff and student areas.
 * Server component — the only interactive part is the sign-out form.
 */
export async function AppShell({
  profile,
  nav,
  sections,
  children,
}: {
  profile: { full_name: string; role: string; username: string };
  nav: NavItem[];
  sections?: { title: string; items: NavItem[] }[];
  children: ReactNode;
}) {
  const collapsed =
    (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <div className="min-h-screen bg-[var(--bg)] lg:flex">
      <Sidebar
        nav={nav}
        sections={sections}
        logout={logout}
        initialCollapsed={collapsed}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ---------------- Topbar ---------------- */}
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur-xl print:hidden">
          <div className="flex h-[68px] items-center justify-between gap-4 px-5 lg:px-8">
            <Link href="/" className="flex items-center gap-2.5 lg:hidden">
              <BrandMark size="sm" />
              <span className="font-serif text-sm font-semibold">Mashanoch</span>
            </Link>

            <div className="hidden items-center gap-3 lg:flex">
              <span className="h-5 w-0.5 rounded-full bg-[var(--primary)]" />
              <span className="text-sm font-semibold">Workspace</span>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-right leading-tight sm:block">
                <span className="block text-sm font-semibold">
                  {profile.full_name}
                </span>
                <span className="block text-[11px] capitalize text-[var(--text-subtle)]">
                  {profile.role}
                </span>
              </span>
              <div
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-sm"
                title="Profile"
                aria-label="Profile"
              >
                <Avatar name={profile.full_name} size="md" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-5 py-7 pb-24 lg:px-8 lg:pb-10">{children}</main>

        <nav className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-2xl border border-white/10 bg-[var(--ink)]/95 p-2 shadow-2xl backdrop-blur-xl lg:hidden print:hidden">
          {nav.map((item) => (
            <MobileNavLink key={item.href} {...item} />
          ))}
          <form action={logout}>
            <button className="flex min-w-18 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-medium text-white/55">
              <IconLogout /><span>Log out</span>
            </button>
          </form>
        </nav>
      </div>
    </div>
  );
}

const s = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const IconHome = () => (
  <svg {...s} aria-hidden>
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1Z" />
  </svg>
);

export const IconLogout = () => (
  <svg {...s} aria-hidden>
    <path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3M15 16l4-4-4-4M19 12H9" />
  </svg>
);

export const IconBook = () => (
  <svg {...s} aria-hidden>
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5Z" />
    <path d="M5 19.5A1.5 1.5 0 0 1 6.5 18H19v3H6.5A1.5 1.5 0 0 1 5 19.5Z" />
  </svg>
);

export const IconResults = () => (
  <svg {...s} aria-hidden>
    <path d="M4 19V5M4 19h16" />
    <path d="M8 16V11M12.5 16V7M17 16v-3" />
  </svg>
);

export const IconStaff = () => (
  <svg {...s} aria-hidden>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" />
  </svg>
);

export const IconStudents = () => (
  <svg {...s} aria-hidden>
    <path d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5Z" />
    <path d="M7 11.6V16c0 1.4 2.2 2.6 5 2.6s5-1.2 5-2.6v-4.4" />
  </svg>
);

export const IconChart = () => (
  <svg {...s} aria-hidden>
    <path d="M4 19V5M4 19h16" />
    <rect x="7.5" y="11" width="3" height="5" rx="1" />
    <rect x="13.5" y="7" width="3" height="9" rx="1" />
  </svg>
);

export const IconApprove = () => (
  <svg {...s} aria-hidden>
    <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
    <path d="M8 5H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2" />
    <path d="m9 13 2 2 4-4" />
  </svg>
);
