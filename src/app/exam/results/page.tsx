import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";
import { Card, IconDoc } from "@/components/ui";
import { SCHOOL_TIME_ZONE } from "@/lib/time";

type ResultRow = {
  id: string;
  score: number | null;
  total_questions: number | null;
  submitted_at: string | null;
  test: {
    title: string;
    marks_per_question: number;
    subjects: { name: string } | { name: string }[] | null;
  } | null;
};

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  timeZone: SCHOOL_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function StudentResults() {
  const profile = await requireStudent();
  const supabase = await createClient();

  // RLS scopes this to the signed-in student's own submissions.
  const { data } = await supabase
    .from("submissions")
    .select(
      "id, score, total_questions, submitted_at," +
        " test(title, marks_per_question, subjects(name))",
    )
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false });

  const results = (data ?? []) as unknown as ResultRow[];

  const totalScored = results.reduce((n, r) => n + (r.score ?? 0), 0);
  const totalPossible = results.reduce(
    (n, r) => n + (r.total_questions ?? 0) * (r.test?.marks_per_question ?? 0),
    0,
  );

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight">My results</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {profile.class} ·{" "}
          {results.length
            ? `${results.length} test${results.length === 1 ? "" : "s"} completed · ${totalScored} of ${totalPossible} marks overall`
            : "Nothing completed yet."}
        </p>
      </header>

      {results.length === 0 ? (
        <Card className="px-6 py-14 text-center">
          <span
            aria-hidden
            className="mx-auto grid h-12 w-12 place-items-center rounded-xl
                       bg-[var(--primary-soft)] text-[var(--primary)]"
          >
            <IconDoc />
          </span>
          <h2 className="mt-4 text-sm font-semibold">No results yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--text-muted)]">
            Once you finish a test, your score appears here.
          </p>
          <Link
            href="/exam"
            className="mt-5 inline-block rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm
                       font-semibold text-[var(--primary-fg)] transition hover:bg-[var(--primary-hover)]"
          >
            See my tests
          </Link>
        </Card>
      ) : (
        <ul className="space-y-3">
          {results.map((r) => {
            const subject = Array.isArray(r.test?.subjects)
              ? r.test?.subjects[0]?.name
              : r.test?.subjects?.name;
            const max =
              (r.total_questions ?? 0) * (r.test?.marks_per_question ?? 0);
            const score = r.score ?? 0;
            const pct = max ? Math.round((score / max) * 100) : 0;
            const tone =
              pct >= 70
                ? "var(--success)"
                : pct >= 40
                  ? "var(--warning)"
                  : "var(--danger)";

            return (
              <li
                key={r.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)]
                           p-5 shadow-[var(--shadow)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">
                      {r.test?.title ?? "Test"}
                    </h2>
                    <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                      {subject} · {r.total_questions} question
                      {r.total_questions === 1 ? "" : "s"}
                    </p>
                    {r.submitted_at && (
                      <p className="mt-0.5 text-xs text-[var(--text-subtle)]">
                        Submitted {dateFmt.format(new Date(r.submitted_at))}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xl font-semibold">
                      {score}
                      <span className="text-sm text-[var(--text-subtle)]">
                        /{max}
                      </span>
                    </p>
                    <p
                      className="text-xs font-semibold"
                      style={{ color: tone }}
                    >
                      {pct}%
                    </p>
                  </div>
                </div>

                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: tone }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
