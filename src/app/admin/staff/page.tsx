import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { Avatar, Badge, Card } from "@/components/ui";
import { InviteStaffForm } from "../account-forms";
import RemoveStaff from "../remove-staff";

export default async function StaffPage() {
  const me = await requireAdmin();
  const admin = createAdminClient();

  const { data: staffRows } = await admin
    .from("profiles")
    .select("id, username, full_name, role")
    .neq("role", "student")
    .order("role")
    .order("full_name");

  const staff = staffRows ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {staff.length} account{staff.length === 1 ? "" : "s"}. Teachers and
          admins are invited by email and choose their own password.
        </p>
      </header>

      <div className="max-w-md">
        <InviteStaffForm />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold">All staff</h2>
        {staff.length === 0 ? (
          <Card className="px-6 py-8 text-center text-sm text-[var(--text-muted)]">
            No staff accounts yet. Invite someone above.
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
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={p.role === "admin" ? "primary" : "neutral"}>
                    {p.role}
                  </Badge>
                  <RemoveStaff
                    id={p.id}
                    name={p.full_name}
                    isSelf={p.id === me.id}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
