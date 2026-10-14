import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import {
  CLASSES,
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  isSenior,
  type Department,
} from "@/lib/constants";
import PrintButton from "@/components/print-button";

export const metadata = { title: "Student login list" };

export default async function PrintStudentList({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  await requireAdmin();
  const { class: klass = "" } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from("profiles")
    .select("id, username, full_name, first_name, last_name, class, department")
    .eq("role", "student");
  if (klass) query = query.eq("class", klass);
  const { data } = await query;
  const students = data ?? [];
  const known: readonly string[] = CLASSES;
  const classes = [
    ...CLASSES,
    ...new Set(
      students.map((s) => s.class ?? "").filter((c) => !known.includes(c)),
    ),
  ];
  const surname = (s: (typeof students)[number]) => s.last_name ?? s.full_name;
  const rank = (s: (typeof students)[number]) => {
    const i = DEPARTMENTS.indexOf(s.department as Department);
    return i < 0 ? DEPARTMENTS.length : i;
  };
  const groups = classes
    .map((c) => ({
      klass: c,
      members: students
        .filter((s) => (s.class ?? "") === c)
        .sort(
          (a, b) =>
            (isSenior(c) ? rank(a) - rank(b) : 0) ||
            surname(a).localeCompare(surname(b)) ||
            (a.first_name ?? "").localeCompare(b.first_name ?? ""),
        ),
    }))
    .filter((g) => g.members.length > 0);

  return (
    <main className="min-h-screen bg-white px-6 py-8 text-neutral-900 print:p-0">
      <div className="mx-auto max-w-3xl print:max-w-none">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <p className="text-sm text-neutral-600">
            {students.length} student{students.length === 1 ? "" : "s"}
            {klass ? ` in ${klass}` : ""}.
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/students"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium
                         text-neutral-700 transition hover:border-neutral-500"
            >
              Back to students
            </Link>
            <PrintButton />
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="text-sm text-neutral-600">No students to print.</p>
        ) : (
          groups.map((g, i) => (
            <section
              key={g.klass}
              className={`mb-10 ${i > 0 ? "print:break-before-page" : ""}`}
            >
              <h1 className="text-lg font-semibold">
                Mashanoch CBT · {g.klass || "No class"} · Student login list
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Sign in with your admission number. Your password is your
                surname.
              </p>

              <table className="mt-4 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-neutral-800 text-left">
                    <th className="w-10 py-2 pr-3 font-semibold">#</th>
                    <th className="py-2 pr-3 font-semibold">First name</th>
                    <th className="py-2 pr-3 font-semibold">Surname</th>
                    <th className="py-2 pr-3 font-semibold">Admission no.</th>
                    {isSenior(g.klass) && (
                      <th className="py-2 font-semibold">Department</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {g.members.map((s, n) => (
                    <tr key={s.id} className="border-b border-neutral-300 break-inside-avoid">
                      <td className="py-2 pr-3 text-neutral-500">{n + 1}</td>
                      <td className="py-2 pr-3">{s.first_name ?? "—"}</td>
                      <td className="py-2 pr-3 font-semibold">
                        {s.last_name ?? s.full_name}
                      </td>
                      <td className="py-2 pr-3 font-mono">{s.username}</td>
                      {isSenior(g.klass) && (
                        <td className="py-2">
                          {s.department
                            ? DEPARTMENT_LABELS[s.department as Department]
                            : "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
