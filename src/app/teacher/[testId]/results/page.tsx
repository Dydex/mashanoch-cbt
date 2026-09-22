import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTestViewer } from "@/lib/auth";
import { Badge, Card, StatCard, IconUsers, IconDoc, IconLive, IconQuestion } from "@/components/ui";
import { timeFmt } from "@/lib/time";

type SubmissionRow = {
  id: string;
  score: number | null;
  total_questions: number | null;
  started_at: string;
  submitted_at: string | null;
  status: string;
  profiles: { full_name: string; username: string; class: string | null } | null;
};

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  await requireTestViewer(testId);

  // Service role: scores and per-question correctness are not readable by
  // `authenticated`, by design. Ownership was checked above.
  const admin = createAdminClient();

  const { data: test } = await admin
    .from("test")
    .select("id, title, class, term, session, marks_per_question, subjects(name)")
    .eq("id", testId)
    .single();

  if (!test) notFound();

  const { data: questions } = await admin
    .from("questions")
    .select("id, question_text, order_index")
    .eq("test_id", testId)
    .order("order_index");

  const { data: rows } = await admin
    .from("submissions")
    .select(
      "id, score, total_questions, started_at, submitted_at, status," +
        " profiles(full_name, username, class)",
    )
    .eq("test_id", testId)
    .order("score", { ascending: false, nullsFirst: false });

  const submissions = (rows ?? []) as unknown as SubmissionRow[];
  const done = submissions.filter((s) => s.status === "submitted");
  const inProgress = submissions.filter((s) => s.status === "in_progress");

  const questionList = questions ?? [];
  const maxMarks = questionList.length * test.marks_per_question;

  const scores = done.map((s) => s.score ?? 0);
  const average = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : 0;
  const highest = scores.length ? Math.max(...scores) : 0;
  const lowest = scores.length ? Math.min(...scores) : 0;
  const passMark = maxMarks / 2;
  const passed = scores.filter((s) => s >= passMark).length;

  // Per-question difficulty: how many who answered it got it right.
  const { data: answers } = await admin
    .from("answers")
    .select("question_id, is_correct")
    .in("submission_id", done.length ? done.map((s) => s.id) : ["00000000-0000-0000-0000-000000000000"]);

  const stats = new Map<string, { right: number; total: number }>();
  for (const a of answers ?? []) {
    const cur = stats.get(a.question_id) ?? { right: 0, total: 0 };
    cur.total += 1;
    if (a.is_correct) cur.right += 1;
    stats.set(a.question_id, cur);
  }

  const subject = Array.isArray(test.subjects)
    ? test.subjects[0]?.name
    : (test.subjects as { name: string } | null)?.name;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/teacher/${testId}`}
        className="text-sm text-[var(--text-muted)] hover:underline"
      >
        ← Back to test
      </Link>

      <header className="mt-3 mb-7">
        <h1 className="text-2xl font-semibold tracking-tight">
          {test.title} — results
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-muted)]">
          {subject} · {test.class} · {test.term} Term {test.session} ·{" "}
          {questionList.length} question
          {questionList.length === 1 ? "" : "s"} · {maxMarks} marks
        </p>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Submitted"
          value={done.length}
          hint={inProgress.length ? `${inProgress.length} still sitting` : "All finished"}
          icon={<IconUsers />}
        />
        <StatCard
          label="Average"
          value={done.length ? `${average}` : "—"}
          hint={done.length ? `out of ${maxMarks}` : "No submissions yet"}
          icon={<IconDoc />}
        />
        <StatCard
          label="Highest"
          value={done.length ? `${highest}` : "—"}
          hint={done.length ? `Lowest ${lowest}` : "—"}
          icon={<IconLive />}
        />
        <StatCard
          label="At or above half"
          value={done.length ? `${passed}/${done.length}` : "—"}
          hint={`Half is ${passMark} marks`}
          icon={<IconQuestion />}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold">Students</h2>
        {submissions.length === 0 ? (
          <Card className="px-6 py-12 text-center text-sm text-[var(--text-muted)]">
            Nobody has started this test yet.
          </Card>
        ) : (
          <ul className="space-y-2">
            {submissions.map((s, i) => {
              const finished = s.status === "submitted";
              const score = s.score ?? 0;
              const pct = maxMarks ? Math.round((score / maxMarks) * 100) : 0;
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-4 rounded-xl border border-[var(--border)]
                             bg-[var(--surface)] p-4 shadow-[var(--shadow)]"
                >
                  <span className="w-6 shrink-0 text-sm text-[var(--text-subtle)]">
                    {finished ? i + 1 : "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {s.profiles?.full_name ?? "Unknown student"}
                    </p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      Admission no. {s.profiles?.username} ·{" "}
                      {finished && s.submitted_at
                        ? `submitted ${timeFmt.format(new Date(s.submitted_at))}`
                        : `started ${timeFmt.format(new Date(s.started_at))}`}
                    </p>
                  </div>
                  {finished ? (
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">
                        {score}
                        <span className="text-[var(--text-subtle)]">/{maxMarks}</span>
                      </p>
                      <p className="text-[11px] text-[var(--text-subtle)]">{pct}%</p>
                    </div>
                  ) : (
                    <Badge tone="warning" dot>
                      In progress
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {done.length > 0 && questionList.length > 0 && (
        <section>
          <h2 className="mb-1 text-base font-semibold">Question breakdown</h2>
          <p className="mb-3 text-sm text-[var(--text-muted)]">
            How many got each question right — a low bar usually means the
            question was unclear, not that the class was weak.
          </p>
          <ul className="space-y-2">
            {questionList.map((q, n) => {
              const st = stats.get(q.id) ?? { right: 0, total: 0 };
              const pct = st.total ? Math.round((st.right / st.total) * 100) : 0;
              const tone =
                pct >= 70 ? "var(--success)" : pct >= 40 ? "var(--warning)" : "var(--danger)";
              return (
                <li
                  key={q.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)]
                             p-4 shadow-[var(--shadow)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="min-w-0 text-sm">
                      <span className="text-[var(--text-subtle)]">{n + 1}.</span>{" "}
                      {q.question_text}
                    </p>
                    <span
                      className="shrink-0 text-sm font-semibold"
                      style={{ color: tone }}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: tone }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--text-subtle)]">
                    {st.right} of {st.total} correct
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
