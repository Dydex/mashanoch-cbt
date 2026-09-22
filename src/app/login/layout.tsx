import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export default function StudentAuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthShell
      label="Student Portal"
      sublabel="Computer-Based Testing"
      footer={
        // Dark text on the light panel, and a bordered strip rather than a
        // line of small print: staff sign in here too, and they were hunting
        // for it.
        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-center text-sm shadow-[var(--shadow)]">
          <span className="text-[var(--text-muted)]">
            Teacher or administrator?{" "}
          </span>
          <Link
            href="/staff/login"
            className="font-semibold text-[var(--primary)] underline underline-offset-2
                       hover:text-[var(--primary-hover)]"
          >
            Sign in here
          </Link>
        </div>
      }
    >
      {children}
    </AuthShell>
  );
}
