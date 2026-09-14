import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";
import { Badge, Card, IconDoc, IconChevron } from "@/components/ui";
import { timeFmt } from "@/lib/time";

type OpenTest = {
  id: string;
  title: string;
  description: string | null;
  class: string;
  term: string;
  session: string;
  duration_minutes: number;
  marks_per_question: number;
  start_time: string;
  end_time: string;
  subjects: { name: string } | { name: string }[] | null;
  questions: { count: number }[];
};

export default async function ExamHome() {
  const profile = await requireStudent();
  const supabase = await createClient();

  // RLS returns only tests for this student's class whose window is open.
  const { data: testRows } = await supabase
    .from("test")
    .select(
      "id, title, description, class, term, session, duration_minutes, marks_per_question," +
        " start_time, end_time, subjects(name), questions(count)",
    )
    .order("end_time");

  const tests = (testRows ?? []) as unknown as OpenTest[];

  // Status only: students are not shown their scores.
  const { data: submissions } = await supabase
    .from("submissions")
    .select("test_id, status");

  const byTest = new Map(
    (submissions ?? []).map((s) => [s.test_id as string, s]),
  );

  const firstName = profile.full_name.split(/\s+/)[0];

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-7 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6 dark:border-indigo-950 dark:from-indigo-950/40 dark:to-[var(--surface)]">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {firstName}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {profile.class} · These are the tests open to you right now.
        </p>
      </header>

      {!tests.length ? (
        <Card className="px-6 py-14 text-center">
          <span
            aria-hidden
            className="mx-auto grid h-12 w-12 place-items-center rounded-xl
                       bg-[var(--primary-soft)] text-[var(--primary)]"
          >
            <IconDoc />
          </span>
          <h2 className="mt-4 text-sm font-semibold">No tests open</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--text-muted)]">
            When your teacher opens a test for {profile.class}, it will appear
            here. Nothing to do until then.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {tests.map((t) => {
            const subject = Array.isArray(t.subjects)
              ? t.subjects[0]?.name
              : t.subjects?.name;
            const count = t.questions[0]?.count ?? 0;
            const sub = byTest.get(t.id);
            const done = sub?.status === "submitted";

            return (
              <li key={t.id}>
                <Link
                  href={`/exam/${t.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-[var(--border)]
                             bg-[var(--surface)] p-5 shadow-[var(--shadow)] transition
                             hover:-translate-y-0.5 hover:border-[var(--primary)] hover:shadow-lg"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-semibold">{t.title}</h2>
                      {done ? (
                        <Badge tone="neutral">Submitted</Badge>
                      ) : sub ? (
                        <Badge tone="warning" dot>
                          In progress
                        </Badge>
                      ) : (
                        <Badge tone="success" dot>
                          Open
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {subject} · {t.term} Term · {count} question
                      {count === 1 ? "" : "s"} ·{" "}
                      {count * t.marks_per_question} marks ·{" "}
                      {t.duration_minutes} minutes
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-subtle)]">
                      Closes {timeFmt.format(new Date(t.end_time))}
                    </p>
                  </div>

                  <span className="shrink-0 text-[var(--text-subtle)] transition group-hover:text-[var(--text)]">
                    <IconChevron />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
