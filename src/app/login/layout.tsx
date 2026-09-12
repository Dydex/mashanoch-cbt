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
        // A text link, not a button: almost everyone here is a student, and a
        // second full-width button would compete with the actual sign-in.
        <p className="mt-5 text-center text-sm text-white/50">
          Teacher or administrator?{" "}
          <Link
            href="/staff/login"
            className="font-medium text-white/85 underline underline-offset-2 hover:text-white"
          >
            Sign in here
          </Link>
        </p>
      }
    >
      {children}
    </AuthShell>
  );
}
