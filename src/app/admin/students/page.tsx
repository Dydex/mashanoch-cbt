import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { Card } from "@/components/ui";
import {
  CLASSES,
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  isSenior,
} from "@/lib/constants";
import EditStudent from "./edit-student";
import ImportStudents from "./import-students";
import PromoteClass from "./promote-class";
import RemoveStudent from "./remove-student";
import { AddStudentForm } from "../account-forms";

const printLink =
  "rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium " +
  "text-[var(--text-muted)] transition hover:border-[var(--primary)] hover:text-[var(--text)]";

type Student = {
  id: string;
  username: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  class: string | null;
  department: string | null;
};

function sectionsOf(klass: string, members: Student[]) {
  if (!isSenior(klass))
    return [{ key: "all", title: null, missing: false, members }];
  return [
    ...DEPARTMENTS.map((d) => ({
      key: d,
      title: DEPARTMENT_LABELS[d],
      missing: false,
      members: members.filter((m) => m.department === d),
    })),
    {
      key: "none",
      title: "No department yet",
      missing: true,
      members: members.filter((m) => !m.department),
    },
  ].filter((s) => s.members.length > 0);
}

function StudentRow({ student, klass }: { student: Student; klass: string }) {
  return (
    <li
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border
                 border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{student.full_name}</p>
        <p className="truncate text-xs text-[var(--text-muted)]">
          Admission no. <span className="font-mono">{student.username}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <EditStudent
          id={student.id}
          firstName={student.first_name ?? ""}
          lastName={student.last_name ?? ""}
          admissionNo={student.username}
          klass={student.class ?? klass}
          department={student.department ?? ""}
        />
        <RemoveStudent id={student.id} name={student.full_name} />
      </div>
    </li>
  );
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; q?: string }>;
}) {
  const { class: klass = "", q = "" } = await searchParams;
  await requireAdmin();
  const admin = createAdminClient();
  const term = q.trim();
  const safeTerm = term.replace(/[,()]/g, "");

  let query = admin
    .from("profiles")
    .select("id, username, full_name, first_name, last_name, class, department")
    .eq("role", "student");
  if (klass) query = query.eq("class", klass);
  if (safeTerm)
    query = query.or(`full_name.ilike.%${safeTerm}%,username.ilike.%${safeTerm}%`);
  const { data } = await query.order("class").order("full_name");
  const students = (data ?? []) as Student[];

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

                <div className="space-y-5">
                  {sectionsOf(group.name, group.members).map((section) => (
                    <div key={section.key}>
                      {section.title && (
                        <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
                          <h3
                            className={`text-sm font-semibold ${
                              section.missing ? "text-[var(--warning)]" : ""
                            }`}
                          >
                            {section.title}{" "}
                            <span className="font-normal text-[var(--text-subtle)]">
                              {section.members.length}
                            </span>
                          </h3>
                          {section.missing && (
                            <p className="text-xs text-[var(--text-muted)]">
                              These students only see general subjects. Set a
                              department with Edit.
                            </p>
                          )}
                        </div>
                      )}
                      <ul className="space-y-2">
                        {section.members.map((p) => (
                          <StudentRow key={p.id} student={p} klass={group.name} />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      )}
    </div>
  );
}
