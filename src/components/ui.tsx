import type { ReactNode } from "react";

/* Small presentational primitives shared across the staff surfaces.
   Server components — no hooks, no client bundle cost. */

export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const dims = {
    sm: "h-7 w-7 text-[11px]",
    md: "h-9 w-9 text-xs",
    lg: "h-12 w-12 text-sm",
  }[size];

  return (
    <span
      aria-hidden
      className={`${dims} grid shrink-0 place-items-center rounded-full font-semibold
                  bg-[var(--primary-soft)] text-[var(--primary)]
                  ring-1 ring-[var(--border)]`}
    >
      {initials || "?"}
    </span>
  );
}

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-[var(--surface-2)] text-[var(--text-muted)]",
  primary: "bg-[var(--primary-soft)] text-[var(--primary)]",
  success: "bg-[var(--success-soft)] text-[var(--success)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
};

export function Badge({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1
                  text-[11px] font-semibold ${toneClasses[tone]}`}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      )}
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)]
                  shadow-[var(--shadow)] transition-shadow duration-200 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * A page's masthead: the school's charcoal band with a crimson rule, used at
 * the top of every staff surface so they read as one site.
 */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-7 overflow-hidden rounded-2xl bg-[var(--ink)] text-white shadow-[var(--shadow)]">
      <div className="h-1 bg-[var(--primary)]" />
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-6 sm:px-8">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-white/65">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
}) {
  return (
    <Card className="group relative overflow-hidden p-5 hover:shadow-[var(--shadow-lg)]">
      <span className="absolute inset-x-0 top-0 h-0.5 bg-[var(--primary)] opacity-80" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {label}
          </p>
          <p className="mt-1.5 font-serif text-3xl font-semibold tracking-tight">
            {value}
          </p>
          {hint && (
            <p className="mt-0.5 truncate text-xs text-[var(--text-subtle)]">
              {hint}
            </p>
          )}
        </div>
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl
                     bg-[var(--primary-soft)] text-[var(--primary)] transition-transform group-hover:scale-110"
        >
          {icon}
        </span>
      </div>
    </Card>
  );
}

/* ---------------- icons (inline, no dependency) ---------------- */

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

export const IconDoc = () => (
  <svg {...s} aria-hidden>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);

export const IconLive = () => (
  <svg {...s} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const IconQuestion = () => (
  <svg {...s} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.2 9.3a2.8 2.8 0 1 1 3.6 3.1c-.6.2-.9.7-.9 1.3v.4" />
    <path d="M12 17.2h.01" />
  </svg>
);

export const IconUsers = () => (
  <svg {...s} aria-hidden>
    <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
    <circle cx="10" cy="8" r="3.2" />
    <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.4 5.2a3.2 3.2 0 0 1 0 5.6" />
  </svg>
);

export const IconPlus = () => (
  <svg {...s} width={16} height={16} aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconChevron = () => (
  <svg {...s} width={16} height={16} aria-hidden>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
