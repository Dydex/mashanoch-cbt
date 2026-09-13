import Link from "next/link";
import type { ReactNode } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { Badge, Card, IconChevron } from "@/components/ui";
import { hasStarted, testStatus, type ApprovalStatus } from "@/lib/test-status";
import { timeFmt } from "@/lib/time";

type Row = {
  id: string;
  title: string;
  class: string;
  term: string;
  session: string;
  start_time: string;
  end_time: string;
  approval_status: ApprovalStatus;
  created_by: string;
  subjects: { name: string } | { name: string }[] | null;
  questions: { count: number }[];
};

export default async function Approvals() {
  await requireAdmin();
  const admin = createAdminClient();

  // Everything not yet approved, soonest to open first: those are the ones a
  // slow decision can make late.
  const { data } = await admin
    .from("test")
    .select(
      "id, title, class, term, session, start_time, end_time, approval_status, created_by," +
        " subjects(name), questions(count)",
    )
    .neq("approval_status", "approved")
    .order("start_time");

  const tests = (data ?? []) as unknown as Row[];
  const pending = tests.filter((t) => t.approval_status === "pending");
  const sentBack = tests.filter((t) => t.approval_status === "changes_requested");
  const drafts = tests.filter((t) => t.approval_status === "draft");

  const teacherIds = [...new Set(tests.map((t) => t.created_by))];
  const { data: teachers } = teacherIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", teacherIds)
    : { data: [] as { id: string; full_name: string }[] };
  const teacherName = new Map((teachers ?? []).map((p) => [p.id, p.full_name]));

  const { data: submissions } = pending.length
    ? await admin
        .from("test_reviews")
        .select("test_id, body, created_at")
        .eq("kind", "submitted")
        .in("test_id", pending.map((t) => t.id))
        .order("created_at", { ascending: false })
    : { data: [] as { test_id: string; body: string | null; created_at: string }[] };

  // Newest first, so the first one seen for each test is its latest.
  const lastSubmission = new Map<string, { body: string | null; created_at: string }>();
  for (const s of submissions ?? [])
    if (!lastSubmission.has(s.test_id)) lastSubmission.set(s.test_id, s);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Students only see a test once an admin approves it. Open one to read
          its questions, then approve it or send it back with a note.
        </p>
      </header>

      <Section title="Waiting for approval" count={pending.length}>
        {pending.length === 0 ? (
          <Card className="px-6 py-10 text-center text-sm text-[var(--text-muted)]">
            Nothing is waiting for approval.
          </Card>
        ) : (
          <ul className="space-y-2.5">
            {pending.map((t) => {
              const sub = lastSubmission.get(t.id);
              return (
                <TestItem key={t.id} test={t} teacher={teacherName.get(t.created_by)}>
                  {sub && (
                    <p className="mt-0.5 truncate text-xs text-[var(--text-subtle)]">
                      Submitted {timeFmt.format(new Date(sub.created_at))}
                      {sub.body ? ` — “${sub.body}”` : ""}
                    </p>
                  )}
                  {hasStarted(t) && (
                    <p className="mt-1 text-xs font-medium text-[var(--warning)]">
                      Its start time has passed, so approving opens it to
                      students straight away.
                    </p>
                  )}
                </TestItem>
              );
            })}
          </ul>
        )}
      </Section>

      {sentBack.length > 0 && (
        <Section
          title="Sent back"
          count={sentBack.length}
          hint="Waiting on the teacher. They return above once resubmitted."
        >
          <ul className="space-y-2.5">
            {sentBack.map((t) => (
              <TestItem key={t.id} test={t} teacher={teacherName.get(t.created_by)} />
            ))}
          </ul>
        </Section>
      )}

      {drafts.length > 0 && (
        <Section
          title="Drafts"
          count={drafts.length}
          hint="Still being written. They appear above once submitted."
        >
          <ul className="space-y-2.5">
            {drafts.map((t) => (
              <TestItem key={t.id} test={t} teacher={teacherName.get(t.created_by)} />
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  hint,
  children,
}: {
  title: string;
  count: number;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="text-base font-semibold">
          {title}{" "}
          <span className="font-normal text-[var(--text-subtle)]">{count}</span>
        </h2>
        {hint && <p className="text-xs text-[var(--text-subtle)]">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function TestItem({
  test,
  teacher,
  children,
}: {
  test: Row;
  teacher?: string;
  children?: ReactNode;
}) {
  const subject = Array.isArray(test.subjects)
    ? test.subjects[0]?.name
    : test.subjects?.name;
  const qCount = test.questions[0]?.count ?? 0;
  const status = testStatus(test);

  return (
    <li>
      <Link
        href={`/teacher/${test.id}`}
        className="group flex items-center gap-4 rounded-xl border border-[var(--border)]
                   bg-[var(--surface)] p-4 shadow-[var(--shadow)] transition
                   hover:border-[var(--primary)]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{test.title}</h3>
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
          </div>
          <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
            {teacher ?? "Unknown teacher"} · {subject} · {test.class} ·{" "}
            {test.term} Term {test.session} · {qCount} question
            {qCount === 1 ? "" : "s"}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--text-subtle)]">
            {timeFmt.format(new Date(test.start_time))} —{" "}
            {timeFmt.format(new Date(test.end_time))}
          </p>
          {children}
        </div>

        <span className="shrink-0 text-[var(--text-subtle)] transition group-hover:text-[var(--text)]">
          <IconChevron />
        </span>
      </Link>
    </li>
  );
}
