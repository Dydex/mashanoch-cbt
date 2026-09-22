import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTestViewer } from "@/lib/auth";
import { timeFmt } from "@/lib/time";
import PrintButton from "@/components/print-button";

export const metadata = { title: "Test results" };

type Row = {
  id: string;
  score: number | null;
  status: string;
  submitted_at: string | null;
  profiles: { full_name: string; username: string } | null;
};

/**
 * A printable results sheet for one test: every student, their score and
 * their percentage, with the class summary underneath.
 *
 * Outside /admin and /teacher on purpose, so it is not wrapped in the app
 * shell and prints as plain black on white. Open to the test's teacher and to
 * admins, the same as the results page it is printed from.
 */
export default async function PrintResults({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  await requireTestViewer(testId);
  const admin = createAdminClient();

  const { data: test } = await admin
    .from("test")
    .select(
      "title, class, term, session, marks_per_question, start_time, subjects(name), questions(count)",
    )
    .eq("id", testId)
    .single();

  if (!test) notFound();

  const { data } = await admin
    .from("submissions")
    .select("id, score, status, submitted_at, profiles(full_name, username)")
    .eq("test_id", testId)
    .order("score", { ascending: false, nullsFirst: false });

  const rows = (data ?? []) as unknown as Row[];
  const done = rows.filter((r) => r.status === "submitted");
  const subject = Array.isArray(test.subjects)
    ? test.subjects[0]?.name
    : (test.subjects as { name: string } | null)?.name;

  const maxMarks =
    ((test.questions as { count: number }[])[0]?.count ?? 0) *
    test.marks_per_question;
  const scores = done.map((r) => r.score ?? 0);
  const average = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : 0;
  const passed = scores.filter((s) => s >= maxMarks / 2).length;

  return (
    <main className="min-h-screen bg-white px-6 py-8 text-neutral-900 print:p-0">
      <div className="mx-auto max-w-3xl print:max-w-none">
        <div className="mb-6 flex flex-wrap items-center justify-end gap-2 print:hidden">
          <Link
            href={`/teacher/${testId}/results`}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium
                       text-neutral-700 transition hover:border-neutral-500"
          >
            Back to results
          </Link>
          <PrintButton />
        </div>

        <h1 className="text-lg font-semibold">
          Mashanoch CBT · {test.title} · results
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          {subject} · {test.class} · {test.term} Term {test.session} ·{" "}
          {maxMarks} marks · sat {timeFmt.format(new Date(test.start_time))}
        </p>

        {rows.length === 0 ? (
          <p className="mt-6 text-sm text-neutral-600">
            Nobody has sat this test yet.
          </p>
        ) : (
          <>
            <table className="mt-5 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-neutral-800 text-left">
                  <th className="w-10 py-2 pr-3 font-semibold">#</th>
                  <th className="py-2 pr-3 font-semibold">Student</th>
                  <th className="py-2 pr-3 font-semibold">Admission no.</th>
                  <th className="w-20 py-2 pr-3 text-right font-semibold">Score</th>
                  <th className="w-16 py-2 text-right font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, n) => {
                  const finished = r.status === "submitted";
                  const score = r.score ?? 0;
                  return (
                    <tr key={r.id} className="break-inside-avoid border-b border-neutral-300">
                      <td className="py-2 pr-3 text-neutral-500">{n + 1}</td>
                      <td className="py-2 pr-3">
                        {r.profiles?.full_name ?? "Unknown student"}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {r.profiles?.username}
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold">
                        {finished ? `${score}/${maxMarks}` : "—"}
                      </td>
                      <td className="py-2 text-right">
                        {finished && maxMarks
                          ? `${Math.round((score / maxMarks) * 100)}%`
                          : "in progress"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <p className="mt-4 text-sm text-neutral-700">
              {done.length} sat · average {done.length ? average : "—"}/{maxMarks} ·{" "}
              {passed} at or above half marks
              {rows.length - done.length > 0
                ? ` · ${rows.length - done.length} still in progress`
                : ""}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
