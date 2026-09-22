import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { isLive, type ApprovalStatus } from "@/lib/test-status";
import { dateFmt, greeting } from "@/lib/time";
import {
  Avatar,
  Badge,
  Card,
  PageHeader,
  StatCard,
  IconUsers,
  IconDoc,
  IconLive,
  IconChevron,
} from "@/components/ui";

export default async function AdminDashboard() {
  const me = await requireAdmin();
  const admin = createAdminClient();

  const { data: staffRows } = await admin
    .from("profiles")
    .select("id, username, full_name, role")
    .neq("role", "student")
    .order("role")
    .order("full_name");

  const { count: studentCount } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "student");

  const { data: classRows } = await admin
    .from("profiles")
    .select("class")
    .eq("role", "student");

  const { data: testRows } = await admin
    .from("test")
    .select("start_time, end_time, approval_status");

  const tests = (testRows ?? []) as {
    start_time: string;
    end_time: string;
    approval_status: ApprovalStatus;
  }[];
  const liveCount = tests.filter(isLive).length;
  const pendingCount = tests.filter((t) => t.approval_status === "pending").length;

  const classCount = new Set(
    (classRows ?? []).map((r) => r.class).filter(Boolean),
  ).size;

  const staff = staffRows ?? [];
  const teacherCount = staff.filter((p) => p.role === "teacher").length;
  const adminCount = staff.filter((p) => p.role === "admin").length;
  const firstName = me.full_name.split(/\s+/).slice(-1)[0];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle={dateFmt.format(new Date())}
      />

      {pendingCount > 0 && (
        <Link
          href="/admin/reviews"
          className="group mb-7 flex items-center gap-4 rounded-2xl border border-[var(--warning)]/30
                     bg-[var(--warning-soft)] p-5 transition hover:border-[var(--warning)]"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--warning)]">
              {pendingCount} test{pendingCount === 1 ? " is" : "s are"} waiting
              for your approval
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Students can&apos;t sit {pendingCount === 1 ? "it" : "them"} until
              an admin approves {pendingCount === 1 ? "it" : "them"}.
            </p>
          </div>
          <span className="shrink-0 text-[var(--warning)]">
            <IconChevron />
          </span>
        </Link>
      )}

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Staff"
          value={staff.length}
          hint={`${teacherCount} teacher${teacherCount === 1 ? "" : "s"} · ${adminCount} admin${adminCount === 1 ? "" : "s"}`}
          icon={<IconUsers />}
        />
        <StatCard
          label="Students"
          value={studentCount ?? 0}
          hint={
            classCount
              ? `Across ${classCount} class${classCount === 1 ? "" : "es"}`
              : "None enrolled yet"
          }
          icon={<IconUsers />}
        />
        <StatCard
          label="Tests"
          value={tests.length}
          hint="Created so far"
          icon={<IconDoc />}
        />
        <StatCard
          label="Live now"
          value={liveCount}
          hint={liveCount ? "Open to students" : "Nothing open"}
          icon={<IconLive />}
        />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Staff</h2>
        {staff.length === 0 ? (
          <Card className="px-6 py-8 text-center text-sm text-[var(--text-muted)]">
            No staff accounts yet.
          </Card>
        ) : (
          <ul className="space-y-2">
            {staff.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 rounded-xl border
                           border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={p.full_name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {p.full_name}
                    </p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {p.username}
                    </p>
                  </div>
                </div>
                <Badge tone={p.role === "admin" ? "primary" : "neutral"}>
                  {p.role}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
