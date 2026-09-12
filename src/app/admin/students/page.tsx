import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { Card } from "@/components/ui";
import { CLASSES } from "@/lib/constants";
import ResetPin from "../reset-pin";
import BulkReset from "./bulk-reset";
import { AddStudentForm } from "../account-forms";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; q?: string }>;
}) {
  const { class: klass = "", q = "" } = await searchParams;
  await requireAdmin();
  const admin = createAdminClient();

  const term = q.trim();

  let query = admin
    .from("profiles")
    .select("id, username, full_name, class")
    .eq("role", "student");

  if (klass) query = query.eq("class", klass);
  if (term) query = query.or(`full_name.ilike.%${term}%,username.ilike.%${term}%`);

  const { data } = await query.order("class").order("full_name");
  const students = data ?? [];

  // Grouped by class so a whole form can be found at a glance.
  const byClass = CLASSES.map((c) => ({
    name: c,
    members: students.filter((s) => s.class === c),
  })).filter((g) => (klass ? g.name === klass : true));

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {students.length} student{students.length === 1 ? "" : "s"}
          {klass ? ` in ${klass}` : ""}
          {term ? ` matching “${term}”` : ""}.
        </p>
      </header>

      <div className="print:hidden">
        <div className="mb-6 max-w-md">
          <AddStudentForm />
        </div>

        <form method="get" className="mb-5 flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={term}
            placeholder="Search by name or ID…"
            aria-label="Search students"
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)]
                       px-3 py-2.5 text-sm outline-none transition focus:border-[var(--primary)]
                       focus:ring-2 focus:ring-[var(--ring)]"
          />
          <select
            name="class"
            defaultValue={klass}
            aria-label="Filter by class"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5
                       text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="">All classes</option>
            {CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold
                             text-[var(--primary-fg)] transition hover:bg-[var(--primary-hover)]">
            Search
          </button>
          {(term || klass) && (
            <Link href="/admin/students"
              className="self-center text-xs text-[var(--text-muted)] hover:underline">
              Clear
            </Link>
          )}
        </form>
      </div>

      {students.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-[var(--text-muted)]">
          No students found. Add one with the form above.
        </Card>
      ) : (
        <div className="space-y-7">
          {byClass.map((group) =>
            group.members.length === 0 ? null : (
              <section key={group.name}>
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">
                    {group.name}{" "}
                    <span className="text-sm font-normal text-[var(--text-subtle)]">
                      · {group.members.length} student
                      {group.members.length === 1 ? "" : "s"}
                    </span>
                  </h2>
                  <div className="print:hidden">
                    <BulkReset klass={group.name} count={group.members.length} />
                  </div>
                </div>

                <ul className="space-y-2 print:hidden">
                  {group.members.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-4 rounded-xl border
                                 border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{p.full_name}</p>
                        <p className="truncate text-xs text-[var(--text-muted)]">
                          ID <span className="font-mono tracking-widest">{p.username}</span>
                        </p>
                      </div>
                      <ResetPin id={p.id} />
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}
    </div>
  );
}
