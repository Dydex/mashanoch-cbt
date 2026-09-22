import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export default function StaffAuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthShell
      label="Staff Portal"
      sublabel="Teachers & administrators"
      footer={
        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-center text-sm shadow-[var(--shadow)]">
          <span className="text-[var(--text-muted)]">Student? </span>
          <Link
            href="/login"
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
