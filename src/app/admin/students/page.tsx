import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { Card } from "@/components/ui";
import { CLASSES } from "@/lib/constants";
import EditStudent from "./edit-student";
import ImportStudents from "./import-students";
import PromoteClass from "./promote-class";
import RemoveStudent from "./remove-student";
import { AddStudentForm } from "../account-forms";

const printLink =
  "rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium " +
  "text-[var(--text-muted)] transition hover:border-[var(--primary)] hover:text-[var(--text)]";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; q?: string }>;
}) {
  const { class: klass = "", q = "" } = await searchParams;
  await requireAdmin();
  const admin = createAdminClient();

  const term = q.trim();
  // Commas and brackets are syntax inside a PostgREST or() filter; a search
  // term containing them would break the query rather than match anything.
  const safeTerm = term.replace(/[,()]/g, "");

  let query = admin
    .from("profiles")
    .select("id, username, full_name, first_name, last_name, class")
    .eq("role", "student");

  if (klass) query = query.eq("class", klass);
  if (safeTerm)
    query = query.or(`full_name.ilike.%${safeTerm}%,username.ilike.%${safeTerm}%`);

  const { data } = await query.order("class").order("full_name");
  const students = data ?? [];

  // Grouped by class so a whole form can be found at a glance. `next` is the
  // class each one is promoted into at the end of the session.
  const byClass = CLASSES.map((c, i) => ({
    name: c,
    next: CLASSES[i + 1] ?? null,
    members: students.filter((s) => s.class === c),
  })).filter((g) => (klass ? g.name === klass : true));

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {students.length} student{students.length === 1 ? "" : "s"}
            {klass ? ` in ${klass}` : ""}
            {term ? ` matching “${term}”` : ""}. Each signs in with their
            admission number, and their last name as the password.
          </p>
        </div>
        <Link href="/print/students" target="_blank" className={printLink}>
          Print all students
        </Link>
      </header>

      <div className="mb-6 grid items-start gap-4 lg:grid-cols-2">
        <AddStudentForm />
        <ImportStudents />
      </div>

      <form method="get" className="mb-5 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={term}
          placeholder="Search by name or admission number…"
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
                  <div className="flex flex-wrap items-center gap-2">
                    <PromoteClass
                      klass={group.name}
                      next={group.next}
                      count={group.members.length}
                    />
                    <Link
                      href={`/print/students?class=${encodeURIComponent(group.name)}`}
                      target="_blank"
                      className={printLink}
                    >
                      Print {group.name} list
                    </Link>
                  </div>
                </div>

                <ul className="space-y-2">
                  {group.members.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border
                                 border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{p.full_name}</p>
                        <p className="truncate text-xs text-[var(--text-muted)]">
                          Admission no. <span className="font-mono">{p.username}</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <EditStudent
                          id={p.id}
                          firstName={p.first_name ?? ""}
                          lastName={p.last_name ?? ""}
                          admissionNo={p.username}
                          klass={p.class ?? group.name}
                        />
                        <RemoveStudent id={p.id} name={p.full_name} />
                      </div>
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
