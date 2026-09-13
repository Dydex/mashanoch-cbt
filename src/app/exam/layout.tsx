import { requireStudent } from "@/lib/auth";
import { AppShell, IconBook, IconResults } from "@/components/shell";

export default async function ExamLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireStudent();

  return (
    <AppShell
      profile={profile}
      nav={[
        { href: "/exam", label: "My tests", icon: <IconBook /> },
        { href: "/exam/results", label: "My results", icon: <IconResults /> },
      ]}
    >
      {children}
    </AppShell>
  );
}
