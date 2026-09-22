import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTestViewer } from "@/lib/auth";
import { Badge, Card, IconChevron } from "@/components/ui";
import {
  isClosed,
  isLocked,
  testStatus,
  type ApprovalStatus,
} from "@/lib/test-status";
import { timeFmt, toSchoolInput } from "@/lib/time";
import { updateTest } from "../actions";
import TestForm from "../test-form";
import AddQuestionForm from "./add-question-form";
import DeleteTest from "./delete-test";
import QuestionCard, { type Option } from "./question-card";
import ApprovalPanel, { type ReviewEntry } from "./approval-panel";
import { ReviewForm, SubmitForm } from "./review-forms";

function LockIcon() {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className="mt-0.5 shrink-0" aria-hidden
    >
      <rect x="4" y="10.5" width="16" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  );
}

export default async function AuthorTestPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params; // params is a Promise in Next 16
  const profile = await requireTestViewer(testId);
  const isAdmin = profile.role === "admin";

  // Service role: the teacher needs to see which option is correct, and
  // `authenticated` has no grant on is_correct. Access checked above.
  const admin = createAdminClient();

  const { data: test } = await admin
    .from("test")
    .select(
      "id, title, description, subject_id, class, term, session, duration_minutes, marks_per_question, start_time, end_time, approval_status, created_by, subjects(name)",
    )
    .eq("id", testId)
    .single();

  if (!test) notFound();

  const [
    { data: questions },
    { count: submissionCount },
    { data: reviews },
    { data: subjects },
  ] = await Promise.all([
    admin
      .from("questions")
      .select(
        "id, question_text, image_url, order_index, question_options(id, option_text, is_correct)",
      )
      .eq("test_id", testId)
      .order("order_index"),
    admin
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("test_id", testId),
    admin
      .from("test_reviews")
      .select("id, kind, body, created_at, author:profiles(full_name)")
      .eq("test_id", testId)
      .order("created_at"),
    admin.from("subjects").select("id, name").order("name"),
  ]);

  const subject = Array.isArray(test.subjects)
    ? test.subjects[0]?.name
    : (test.subjects as { name: string } | null)?.name;

  const list = questions ?? [];
  const sat = submissionCount ?? 0;
  const total = list.length * test.marks_per_question;
  const approval = test.approval_status as ApprovalStatus;
  const status = testStatus(test);
  const own = test.created_by === profile.id;
  const closed = isClosed(test);

  // The paper freezes once a student has started: until then even a live test
  // can still be fixed. Database triggers enforce this for real (0008, 0010,
  // 0015); this only decides what the UI offers.
  const locked = isLocked(test, sat);

  // Admins review papers and never change them (requireTestOwner refuses
  // them on every write).
  const canEdit = !isAdmin && !locked;

  const entries: ReviewEntry[] = (reviews ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    body: r.body,
    created_at: r.created_at,
    author: (Array.isArray(r.author) ? r.author[0] : r.author) ?? null,
  }));

  // The submission an admin's approval refers to. reviewTest refuses it if the
  // teacher has resubmitted since, so nobody approves a paper they haven't seen.
  const latestSubmission =
    entries.filter((e) => e.kind === "submitted").at(-1)?.id ?? "";

  const canApprove =
    approval !== "approved" && (approval === "pending" || own);
  const canSendBack =
    !own && !locked && (approval === "pending" || approval === "approved");

  const reviewHint =
    canApprove && canSendBack
      ? "Approve it and students can sit it once its window opens. Or send it back with a note saying what to fix."
      : canApprove
        ? "Approve it and students can sit it once its window opens."
        : canSendBack
          ? "Already approved. Send it back if something needs fixing before it opens."
          : "Leave a note for the teacher.";

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/teacher"
        className="text-sm text-[var(--text-muted)] hover:underline"
      >
        ← Back to tests
      </Link>

      <header className="mt-3 mb-5 overflow-hidden rounded-2xl bg-[var(--ink)] text-white shadow-[var(--shadow)]">
        <div className="h-1 bg-[var(--primary)]" />
        <div className="p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-serif text-2xl font-semibold tracking-tight">
              {test.title}
            </h1>
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
          </div>
          <p className="mt-1.5 text-sm text-white/70">
            {subject} · {test.class} · {test.term} Term {test.session} ·{" "}
            {test.duration_minutes} min · {list.length}{" "}
            question{list.length === 1 ? "" : "s"} · {total} marks
          </p>
          <p className="mt-0.5 text-sm text-white/50">
            {timeFmt.format(new Date(test.start_time))} —{" "}
            {timeFmt.format(new Date(test.end_time))}
          </p>

          <Link
            href={`/teacher/${testId}/results`}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white
                       px-4 py-2.5 text-sm font-semibold text-[var(--ink)]
                       transition hover:bg-white/90"
          >
            View results
            {sat ? ` (${sat})` : ""}
          </Link>
        </div>
      </header>

      <ApprovalPanel
        status={approval}
        isAdmin={isAdmin}
        own={own}
        locked={locked}
        closed={closed}
        startLabel={timeFmt.format(new Date(test.start_time))}
        entries={entries}
      >
        {!isAdmin && (approval === "draft" || approval === "changes_requested") && (
          <SubmitForm testId={testId} resubmit={latestSubmission !== ""} />
        )}
      </ApprovalPanel>

      {locked && !isAdmin && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--warning-soft)] px-4 py-3.5 text-sm text-[var(--warning)]">
          <LockIcon />
          <p>
            <strong className="font-semibold">Questions are locked.</strong>{" "}
            {sat} student{sat === 1 ? " has" : "s have"} started this test, so
            the paper can no longer be changed. To make changes, create a new
            test.
          </p>
        </div>
      )}

      {canEdit && (
        <details className="group mb-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            Edit test details
            <span className="text-[var(--text-subtle)] transition group-open:rotate-90">
              <IconChevron />
            </span>
          </summary>
          <div className="border-t border-[var(--border)] px-6 py-6 sm:px-8">
            {(approval === "pending" || approval === "approved") && (
              <p className="mb-5 text-sm text-[var(--text-muted)]">
                Saving changes takes this test back to draft, and it will need
                approving again.
              </p>
            )}
            <TestForm
              subjects={subjects ?? []}
              action={updateTest}
              submitLabel="Save details"
              pendingLabel="Saving…"
              test={{
                id: test.id,
                title: test.title,
                description: test.description,
                subject_id: test.subject_id,
                class: test.class,
                term: test.term,
                session: test.session,
                duration_minutes: test.duration_minutes,
                start: toSchoolInput(test.start_time),
                end: toSchoolInput(test.end_time),
              }}
            />
          </div>
        </details>
      )}

      <section>
        <h2 className="mb-3 text-base font-semibold">Questions</h2>

        {list.length === 0 ? (
          <Card className="px-6 py-10 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              {canEdit
                ? "No questions yet. Add the first one below."
                : "No questions yet."}
            </p>
          </Card>
        ) : (
          <ol className="space-y-3">
            {list.map((q, n) => (
              <li key={q.id}>
                <QuestionCard
                  testId={testId}
                  index={n}
                  locked={!canEdit}
                  question={{
                    id: q.id,
                    question_text: q.question_text,
                    image_url: q.image_url ?? null,
                    options: q.question_options as Option[],
                  }}
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      {canEdit && (
        <section className="mt-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-8">
          <h2 className="mb-4 text-base font-semibold">Add a question</h2>
          <AddQuestionForm testId={testId} />
        </section>
      )}

      {isAdmin && (
        <section
          id="review"
          className="mt-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-8"
        >
          <h2 className="text-base font-semibold">Your review</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{reviewHint}</p>
          <ReviewForm
            testId={testId}
            submissionId={latestSubmission}
            canApprove={canApprove}
            canSendBack={canSendBack}
          />
        </section>
      )}

      {!isAdmin && own && sat === 0 && (
        <section className="mt-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
          <h2 className="text-base font-semibold">Delete</h2>
          <p className="mt-1 mb-3 text-sm text-[var(--text-muted)]">
            Nobody has sat this test yet, so it can still be deleted with its
            questions and approval history. Once a student sits it, it stays as
            a record of their results.
          </p>
          <DeleteTest testId={testId} title={test.title} />
        </section>
      )}
    </div>
  );
}
