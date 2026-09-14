import { requireStudent } from "@/lib/auth";
import { AppShell, IconBook } from "@/components/shell";

export default async function ExamLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireStudent();

  // No results link: students are not shown their scores.
  return (
    <AppShell
      profile={profile}
      nav={[{ href: "/exam", label: "My tests", icon: <IconBook /> }]}
    >
      {children}
    </AppShell>
  );
}
