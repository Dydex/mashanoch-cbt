import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";
import { Card } from "@/components/ui";
import ExamRunner from "./exam-runner";

export default async function ExamPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const profile = await requireStudent();
  const supabase = await createClient();

  // RLS only returns this row if the student's class matches and the window
  // is open, so an out-of-window test can never be loaded here.
  const { data: test } = await supabase
    .from("test")
    .select(
      "id, title, duration_minutes, marks_per_question, end_time, subjects(name)",
    )
    .eq("id", testId)
    .maybeSingle();

  if (!test) redirect("/exam");

  // Opens the submission, or returns the existing one. Enforces class,
  // role and window server-side a second time.
  const { data: submissionId, error: startError } = await supabase.rpc(
    "start_test",
    { p_test_id: testId },
  );
  if (startError || !submissionId) redirect("/exam");

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, started_at, status, score, total_questions")
    .eq("id", submissionId)
    .single();

  const subject = Array.isArray(test.subjects)
    ? test.subjects[0]?.name
    : (test.subjects as { name: string } | null)?.name;

  /* ---------- already handed in ---------- */
  if (submission?.status === "submitted") {
    const total = (submission.total_questions ?? 0) * test.marks_per_question;
    return (
      <div className="mx-auto max-w-lg pt-10">
        <Card className="p-8 text-center">
          <span
            aria-hidden
            className="mx-auto grid h-14 w-14 place-items-center rounded-full
                       bg-[var(--success-soft)] text-[var(--success)]"
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 13 4 4L19 7" />
            </svg>
          </span>
          <h1 className="mt-5 text-xl font-semibold">Test submitted</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {test.title} · {subject}
          </p>

          <div className="mt-6 rounded-xl bg-[var(--surface-2)] p-5">
            <p className="text-3xl font-semibold tracking-tight">
              {submission.score ?? 0}
              <span className="text-lg text-[var(--text-subtle)]"> / {total}</span>
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {submission.total_questions ?? 0} questions ·{" "}
              {test.marks_per_question} marks each
            </p>
          </div>

          <Link
            href="/exam"
            className="mt-6 inline-block rounded-lg bg-[var(--primary)] px-5 py-2.5
                       text-sm font-semibold text-[var(--primary-fg)]
                       transition hover:bg-[var(--primary-hover)]"
          >
            Back to my tests
          </Link>
        </Card>
      </div>
    );
  }

  /* ---------- sit the test ---------- */
  const { data: questions } = await supabase
    .from("questions")
    .select("id, question_text, image_url, order_index")
    .eq("test_id", testId)
    .order("order_index");

  const ids = (questions ?? []).map((q) => q.id);

  // exam_options is the view without is_correct — the answer key is never
  // sent to the browser.
  const { data: options } = await supabase
    .from("exam_options")
    .select("id, question_id, option_text")
    .in("question_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  const { data: answers } = await supabase
    .from("answers")
    .select("question_id, selected_option_id")
    .eq("submission_id", submissionId);

  const byQuestion = new Map<string, { id: string; option_text: string }[]>();
  for (const o of options ?? []) {
    const list = byQuestion.get(o.question_id) ?? [];
    list.push({ id: o.id, option_text: o.option_text });
    byQuestion.set(o.question_id, list);
  }

  const startedAt = new Date(submission!.started_at).getTime();
  const personalDeadline = startedAt + test.duration_minutes * 60_000;
  const windowClose = new Date(test.end_time).getTime();
  // Whichever comes first: the student's own clock, or the exam closing.
  const deadline = Math.min(personalDeadline, windowClose);

  return (
    <ExamRunner
      submissionId={submissionId as string}
      deadline={deadline}
      studentName={profile.full_name}
      test={{
        title: test.title,
        subject: subject ?? "",
        marksPerQuestion: test.marks_per_question,
      }}
      questions={(questions ?? []).map((q) => ({
        id: q.id,
        text: q.question_text,
        imageUrl: q.image_url,
        options: byQuestion.get(q.id) ?? [],
      }))}
      initialAnswers={Object.fromEntries(
        (answers ?? [])
          .filter((a) => a.selected_option_id)
          .map((a) => [a.question_id, a.selected_option_id as string]),
      )}
    />
  );
}
