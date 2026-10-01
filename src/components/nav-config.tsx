import type { NavItem } from "@/components/shell";
import {
  IconHome,
  IconStaff,
  IconStudents,
  IconBook,
  IconResults,
  IconChart,
  IconApprove,
} from "@/components/shell";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/constants";

export type NavConfig = {
  nav: NavItem[];
  sections?: { title: string; items: NavItem[] }[];
};

export async function staffNav(role: Role): Promise<NavConfig> {
  if (role === "admin") {
    const { count } = await createAdminClient()
      .from("test")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "pending");

    return {
      nav: [
        { href: "/admin", label: "Dashboard", icon: <IconHome /> },
        { href: "/admin/staff", label: "Staff", icon: <IconStaff /> },
        { href: "/admin/students", label: "Students", icon: <IconStudents /> },
        { href: "/admin/results", label: "Results", icon: <IconChart /> },
      ],
      sections: [
        {
          title: "Manage",
          items: [
            {
              href: "/admin/reviews",
              label: "Approvals",
              icon: <IconApprove />,
              badge: count || undefined,
            },
            { href: "/teacher", label: "Tests", icon: <IconBook /> },
            { href: "/admin/subjects", label: "Subjects", icon: <IconResults /> },
          ],
        },
      ],
    };
  }

  return {
    nav: [
      { href: "/teacher", label: "Tests", icon: <IconBook /> },
      { href: "/teacher/new", label: "Create test", icon: <IconResults /> },
    ],
  };
}
