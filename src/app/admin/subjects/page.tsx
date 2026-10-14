import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { Card } from "@/components/ui";
import { DEPARTMENTS, DEPARTMENT_LABELS, type Department } from "@/lib/constants";
import { AddSubjectForm, SubjectRow } from "./subject-forms";

type SubjectItem = {
  id: string;
  name: string;
  department: Department | null;
  test: { count: number }[];
};

export default async function SubjectsPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: subjects } = await admin
    .from("subjects")
    .select("id, name, department, test(count)")
    .order("name");

  const list = (subjects ?? []) as unknown as SubjectItem[];

  const sections: { title: string; hint: string; items: SubjectItem[] }[] = [
    {
      title: "General",
      hint: "Open to the whole class",
      items: list.filter((s) => !s.department),
    },
    ...DEPARTMENTS.map((d) => ({
      title: DEPARTMENT_LABELS[d],
      hint: `Only ${DEPARTMENT_LABELS[d]} students in SS1 and SS2`,
      items: list.filter((s) => s.department === d),
    })),
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Subjects</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          What teachers can choose when they create a test. A department
          subject is only open to that department in SS1 and SS2; everything
          else is open to the whole class. A subject in use can be edited, but
          not removed.
        </p>
      </header>

      <div className="mb-6">
        <AddSubjectForm />
      </div>

      {list.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-[var(--text-muted)]">
          No subjects yet. Add the first one above.
        </Card>
      ) : (
        <div className="space-y-7">
          {sections.map((section) =>
            section.items.length === 0 ? null : (
              <section key={section.title}>
                <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4">
                  <h2 className="text-base font-semibold">
                    {section.title}{" "}
                    <span className="text-sm font-normal text-[var(--text-subtle)]">
                      {section.items.length}
                    </span>
                  </h2>
                  <p className="text-xs text-[var(--text-subtle)]">{section.hint}</p>
                </div>
                <ul className="space-y-2">
                  {section.items.map((s) => (
                    <li key={s.id}>
                      <SubjectRow
                        id={s.id}
                        name={s.name}
                        department={s.department}
                        tests={s.test[0]?.count ?? 0}
                      />
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
