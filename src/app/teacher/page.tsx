import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { isLive, testStatus, type ApprovalStatus } from "@/lib/test-status";
import { dateFmt, greeting, timeFmt } from "@/lib/time";
import {
  Badge,
  Card,
  StatCard,
  IconDoc,
  IconLive,
  IconQuestion,
  IconUsers,
  IconPlus,
  IconChevron,
} from "@/components/ui";

type TestRow = {
  id: string;
  title: string;
  class: string;
  term: string;
  session: string;
  duration_minutes: number;
  marks_per_question: number;
  start_time: string;
  end_time: string;
  approval_status: ApprovalStatus;
  subjects: { name: string } | { name: string }[] | null;
  questions: { count: number }[];
  submissions: { count: number }[];
};

export default async function TeacherHome() {
  const profile = await requireStaff();
  // Admins come here to open tests for review. They never create them.
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  // Counts come back with the rows, so the page is a single round trip.
  const { data } = await supabase
    .from("test")
    .select(
      "id, title, class, term, session, duration_minutes, marks_per_question," +
        " start_time, end_time, approval_status," +
        " subjects(name), questions(count), submissions(count)",
    )
    .order("created_at", { ascending: false });

  const tests = (data ?? []) as unknown as TestRow[];

  const totalQuestions = tests.reduce(
    (n, t) => n + (t.questions[0]?.count ?? 0),
    0,
  );
  const totalSubmissions = tests.reduce(
    (n, t) => n + (t.submissions[0]?.count ?? 0),
    0,
  );
  const liveCount = tests.filter(isLive).length;

  const firstName = profile.full_name.split(/\s+/).slice(-1)[0];

  return (
    <>
      {/* ---------- Welcome ---------- */}
      <section className="relative mb-8 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-6 dark:border-indigo-950 dark:from-indigo-950/40 dark:via-[var(--surface)]">
        <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {dateFmt.format(new Date())}
            </p>
        </div>

        {!isAdmin && (
          <Link
            href="/teacher/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5
                       text-sm font-semibold text-[var(--primary-fg)] shadow-[var(--shadow)]
                       transition hover:bg-[var(--primary-hover)]"
          >
            <IconPlus />
            New test
          </Link>
        )}
      </section>

      {/* ---------- Stats ---------- */}
      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Tests"
          value={tests.length}
          hint={tests.length === 1 ? "1 created" : `${tests.length} created`}
          icon={<IconDoc />}
        />
        <StatCard
          label="Live now"
          value={liveCount}
          hint={liveCount ? "Students can sit these" : "Nothing open"}
          icon={<IconLive />}
        />
        <StatCard
          label="Questions"
          value={totalQuestions}
          hint="Across all tests"
          icon={<IconQuestion />}
        />
        <StatCard
          label="Submissions"
          value={totalSubmissions}
          hint="Attempts recorded"
          icon={<IconUsers />}
        />
      </section>

      {/* ---------- Tests ---------- */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold">
            {isAdmin ? "All tests" : "Your tests"}
          </h2>
          {tests.length > 0 && (
            <span className="text-xs text-[var(--text-subtle)]">
              {tests.length} total
            </span>
          )}
        </div>

        {tests.length === 0 ? (
          <Card className="px-6 py-14 text-center">
            <span
              aria-hidden
              className="mx-auto grid h-12 w-12 place-items-center rounded-xl
                         bg-[var(--primary-soft)] text-[var(--primary)]"
            >
              <IconDoc />
            </span>
            <h3 className="mt-4 text-sm font-semibold">No tests yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--text-muted)]">
              {isAdmin
                ? "Tests appear here once teachers create them. Those waiting for your approval are under Approvals."
                : "Create a test, add your questions, then submit it for an admin to approve. Students can sit it once it is approved and its window opens."}
            </p>
            {!isAdmin && (
              <Link
                href="/teacher/new"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--primary)]
                           px-4 py-2.5 text-sm font-semibold text-[var(--primary-fg)]
                           transition hover:bg-[var(--primary-hover)]"
              >
                <IconPlus />
                Create your first test
              </Link>
            )}
          </Card>
        ) : (
          <ul className="space-y-2.5">
            {tests.map((t) => {
              const status = testStatus(t);
              const subject = Array.isArray(t.subjects)
                ? t.subjects[0]?.name
                : t.subjects?.name;
              const questions = t.questions[0]?.count ?? 0;
              const submissions = t.submissions[0]?.count ?? 0;

              return (
                <li key={t.id}>
                  <Link
                    href={`/teacher/${t.id}`}
                    className="group flex items-center gap-4 rounded-xl border border-[var(--border)]
                               bg-[var(--surface)] p-4 shadow-[var(--shadow)] transition
                               hover:-translate-y-0.5 hover:border-[var(--primary)] hover:shadow-lg"
                  >
                    <span
                      aria-hidden
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg
                                 bg-[var(--surface-2)] text-[var(--text-muted)]"
                    >
                      <IconDoc />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold">
                          {t.title}
                        </h3>
                        <Badge tone={status.tone} dot>
                          {status.label}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                        {subject} · {t.class} · {t.term} Term {t.session} ·{" "}
                        {t.duration_minutes} min ·{" "}
                        {questions} question{questions === 1 ? "" : "s"} ·{" "}
                        {questions * t.marks_per_question} marks
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[var(--text-subtle)]">
                        {timeFmt.format(new Date(t.start_time))} —{" "}
                        {timeFmt.format(new Date(t.end_time))}
                      </p>
                    </div>

                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-sm font-semibold">{submissions}</p>
                      <p className="text-[11px] text-[var(--text-subtle)]">
                        submitted
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
      </section>
    </>
  );
}
