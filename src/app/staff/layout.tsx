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
        <p className="mt-5 text-center text-sm text-white/50">
          Student?{" "}
          <Link
            href="/login"
            className="font-medium text-white/85 underline underline-offset-2 hover:text-white"
          >
            Sign in with your ID and PIN
          </Link>
        </p>
      }
    >
      {children}
    </AuthShell>
  );
}
