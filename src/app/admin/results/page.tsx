import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { CLASSES } from "@/lib/constants";
import { isLive, testStatus, type ApprovalStatus } from "@/lib/test-status";
import { timeFmt } from "@/lib/time";
import {
  Badge,
  Card,
  StatCard,
  IconDoc,
  IconUsers,
  IconLive,
  IconChevron,
} from "@/components/ui";

type TestRow = {
  id: string;
  title: string;
  class: string;
  term: string;
  session: string;
  marks_per_question: number;
  start_time: string;
  end_time: string;
  approval_status: ApprovalStatus;
  subjects: { name: string } | { name: string }[] | null;
  questions: { count: number }[];
};

type Tally = { done: number[]; open: number };

export default async function AdminResults() {
  await requireAdmin();

  // Service role: scores are not readable by `authenticated`, by design.
  const admin = createAdminClient();

  const { data: testRows } = await admin
    .from("test")
    .select(
      "id, title, class, term, session, marks_per_question, start_time, end_time," +
        " approval_status, subjects(name), questions(count)",
    )
    .order("start_time", { ascending: false });

  const tests = (testRows ?? []) as unknown as TestRow[];

  const { data: subs } = await admin
    .from("submissions")
    .select("test_id, score, status");

  const byTest = new Map<string, Tally>();
  for (const s of subs ?? []) {
    const cur = byTest.get(s.test_id) ?? { done: [], open: 0 };
    if (s.status === "submitted") cur.done.push(s.score ?? 0);
    else cur.open += 1;
    byTest.set(s.test_id, cur);
  }

  const allScores = (subs ?? [])
    .filter((s) => s.status === "submitted")
    .map((s) => s.score ?? 0);
  const overallAvg = allScores.length
    ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
    : 0;
  const liveCount = tests.filter(isLive).length;

  // One section per class, in school order, newest test first within each.
  // A class with no tests is left out; any class not in CLASSES goes last.
  const known: readonly string[] = CLASSES;
  const classes = [
    ...CLASSES,
    ...new Set(tests.map((t) => t.class).filter((c) => !known.includes(c))),
  ];
  const groups = classes
    .map((klass) => {
      const list = tests.filter((t) => t.class === klass);
      const handedIn = list.reduce(
        (n, t) => n + (byTest.get(t.id)?.done.length ?? 0),
        0,
      );
      return { klass, tests: list, handedIn };
    })
    .filter((g) => g.tests.length > 0);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Every test in the school, by class. Open one to see each
          student&apos;s score and how the class handled each question.
        </p>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tests" value={tests.length} hint="Created so far" icon={<IconDoc />} />
        <StatCard
          label="Submissions"
          value={allScores.length}
          hint="Papers handed in"
          icon={<IconUsers />}
        />
        <StatCard
          label="Average mark"
          value={allScores.length ? overallAvg : "—"}
          hint={allScores.length ? "Across all tests" : "Nothing submitted yet"}
          icon={<IconDoc />}
        />
        <StatCard
          label="Live now"
          value={liveCount}
          hint={liveCount ? "Being sat" : "Nothing open"}
          icon={<IconLive />}
        />
      </section>

      {groups.length === 0 ? (
        <Card className="px-6 py-14 text-center text-sm text-[var(--text-muted)]">
          No tests have been created yet.
        </Card>
      ) : (
        <>
          {groups.length > 1 && (
            <nav aria-label="Jump to a class" className="mb-6 flex flex-wrap gap-2">
              {groups.map((g) => (
                <a
                  key={g.klass}
                  href={`#class-${g.klass}`}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5
                             text-xs font-semibold text-[var(--text-muted)] transition
                             hover:border-[var(--primary)] hover:text-[var(--text)]"
                >
                  {g.klass}{" "}
                  <span className="font-normal text-[var(--text-subtle)]">
                    {g.tests.length}
                  </span>
                </a>
              ))}
            </nav>
          )}

          {groups.map((g) => (
            <section
              key={g.klass}
              id={`class-${g.klass}`}
              className="mb-8 scroll-mt-24"
            >
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4">
                <h2 className="text-base font-semibold">{g.klass}</h2>
                <p className="text-xs text-[var(--text-subtle)]">
                  {g.tests.length} test{g.tests.length === 1 ? "" : "s"} ·{" "}
                  {g.handedIn} paper{g.handedIn === 1 ? "" : "s"} handed in
                </p>
              </div>
              <ul className="space-y-2.5">
                {g.tests.map((t) => (
                  <ResultItem
                    key={t.id}
                    test={t}
                    tally={byTest.get(t.id) ?? { done: [], open: 0 }}
                  />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function ResultItem({ test: t, tally: s }: { test: TestRow; tally: Tally }) {
  const subject = Array.isArray(t.subjects)
    ? t.subjects[0]?.name
    : t.subjects?.name;
  const qCount = t.questions[0]?.count ?? 0;
  const max = qCount * t.marks_per_question;
  const avg = s.done.length
    ? Math.round((s.done.reduce((a, b) => a + b, 0) / s.done.length) * 10) / 10
    : null;
  const status = testStatus(t);

  return (
    <li>
      <Link
        href={`/teacher/${t.id}/results`}
        className="group flex items-center gap-4 rounded-xl border border-[var(--border)]
                   bg-[var(--surface)] p-4 shadow-[var(--shadow)] transition
                   hover:border-[var(--primary)]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{t.title}</h3>
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
          </div>
          <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
            {subject} · {t.term} Term {t.session} · {qCount} question
            {qCount === 1 ? "" : "s"} · {max} marks
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--text-subtle)]">
            {timeFmt.format(new Date(t.start_time))} —{" "}
            {timeFmt.format(new Date(t.end_time))}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold">
            {s.done.length}
            <span className="text-[var(--text-subtle)]"> sat</span>
          </p>
          <p className="text-[11px] text-[var(--text-subtle)]">
            {avg === null
              ? s.open
                ? `${s.open} in progress`
                : "no results"
              : `avg ${avg}/${max}`}
          </p>
        </div>

        <span className="shrink-0 text-[var(--text-subtle)] transition group-hover:text-[var(--text)]">
          <IconChevron />
        </span>
      </Link>
    </li>
  );
}
