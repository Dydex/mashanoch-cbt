import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { Card } from "@/components/ui";
import { AddSubjectForm, SubjectRow } from "./subject-forms";

export default async function SubjectsPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: subjects } = await admin
    .from("subjects")
    .select("id, name, test(count)")
    .order("name");

  const list = (subjects ?? []) as unknown as {
    id: string;
    name: string;
    test: { count: number }[];
  }[];

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Subjects</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          What teachers can choose when they create a test. A subject in use
          can be renamed, but not removed.
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
        <ul className="space-y-2">
          {list.map((s) => (
            <li key={s.id}>
              <SubjectRow
                id={s.id}
                name={s.name}
                tests={s.test[0]?.count ?? 0}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
