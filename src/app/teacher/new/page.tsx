import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTeacher } from "@/lib/auth";
import { createTest } from "../actions";
import TestForm from "../test-form";

export default async function NewTestPage() {
  await requireTeacher();
  const supabase = await createClient();

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name")
    .order("name");

  return (
    <>
      <Link href="/teacher" className="text-sm text-[var(--text-muted)] hover:underline">
        ← Back to tests
      </Link>
      <h1 className="mt-2 mb-2 text-2xl font-semibold tracking-tight">Create a new test</h1>
      <p className="mb-6 text-sm text-[var(--text-muted)]">
        Set the basics first. You can add questions immediately after, then
        submit the test for an admin to approve.
      </p>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-8">
        <TestForm
          subjects={subjects ?? []}
          action={createTest}
          submitLabel="Create test"
          pendingLabel="Creating…"
        />
      </div>
    </>
  );
}
