import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/shell";
import { staffNav } from "@/components/nav-config";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireAdmin();
  const { nav, sections } = await staffNav(profile.role);

  return (
    <AppShell profile={profile} nav={nav} sections={sections}>
      {children}
    </AppShell>
  );
}
