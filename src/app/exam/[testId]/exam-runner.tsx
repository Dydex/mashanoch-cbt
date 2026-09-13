"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Question = {
  id: string;
  text: string;
  imageUrl: string | null;
  options: { id: string; option_text: string }[];
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function ExamRunner({
  submissionId,
  deadline,
  test,
  questions,
  initialAnswers,
}: {
  submissionId: string;
  deadline: number;
  studentName: string;
  test: { title: string; subject: string; marksPerQuestion: number };
  questions: Question[];
  initialAnswers: Record<string, string>;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, deadline - Date.now()),
  );

  // Total span is fixed on mount so the ring measures against a stable whole.
  const [totalDuration] = useState(() => Math.max(1, deadline - Date.now()));
  const submittedRef = useRef(false);

  const question = questions[index];
  const answeredCount = Object.keys(answers).length;

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_test", {
      p_submission_id: submissionId,
    });
    if (error) {
      submittedRef.current = false;
      setSubmitting(false);
      setError(error.message);
      return;
    }
    router.refresh();
  }, [router, submissionId, supabase]);

  /* ---------- countdown, auto-submits at zero ---------- */
  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left === 0) void submit();
    }, 1000);
    return () => clearInterval(id);
  }, [deadline, submit]);

  /* ---------- answer autosave ---------- */
  async function choose(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    setSaving(true);
    setError(null);

    // Goes through save_answer() rather than writing the table directly: a
    // PostgREST upsert would need UPDATE on every column, which would undo the
    // grant that stops a student moving an answer onto another submission.
    // The function also checks the option really belongs to this question.
    // is_correct is never sent — grading happens in submit_test().
    const { error } = await supabase.rpc("save_answer", {
      p_submission_id: submissionId,
      p_question_id: questionId,
      p_option_id: optionId,
    });

    setSaving(false);
    if (error) setError("Could not save that answer. Check your connection.");
  }

  function toggleFlag(id: string) {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const clock = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const fraction = Math.max(0, Math.min(1, remaining / totalDuration));
  const low = remaining < 5 * 60_000;

  if (!question) {
    return (
      <p className="py-20 text-center text-sm text-[var(--text-muted)]">
        This test has no questions yet.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* ---------------- header ---------------- */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {test.subject}: {test.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {questions.length} questions · {test.marksPerQuestion} marks each ·{" "}
            <span className={saving ? "text-[var(--warning)]" : undefined}>
              {saving ? "Saving…" : "All answers saved"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-muted)]">Time remaining</span>
          <CountdownRing clock={clock} fraction={fraction} low={low} />
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-[var(--danger-soft)] px-4 py-2.5 text-sm text-[var(--danger)]"
        >
          {error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* ---------------- question ---------------- */}
        <section>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-8">
            <h2 className="text-base font-semibold">Question {index + 1}</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed">
              {question.text}
            </p>
            {question.imageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={question.imageUrl}
                alt=""
                className="mt-4 max-h-72 rounded-lg border border-[var(--border)]"
              />
            )}
          </div>

          <ul className="mt-4 space-y-2.5">
            {question.options.map((o, i) => {
              const picked = answers[question.id] === o.id;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => choose(question.id, o.id)}
                    aria-pressed={picked}
                    className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left
                                text-sm transition ${
                                  picked
                                    ? "border-[var(--primary)] bg-[var(--primary-soft)] font-semibold"
                                    : "border-[var(--border)] bg-[var(--surface)] hover:-translate-y-0.5 hover:border-[var(--primary)] hover:shadow-md"
                                }`}
                  >
                    <span
                      aria-hidden
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full
                                  text-xs font-semibold ${
                                    picked
                                      ? "bg-[var(--primary)] text-[var(--primary-fg)]"
                                      : "border border-[var(--border-strong)] text-[var(--text-muted)]"
                                  }`}
                    >
                      {LETTERS[i] ?? i + 1}
                    </span>
                    {o.option_text}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium
                         transition hover:border-[var(--border-strong)] disabled:opacity-40"
            >
              ← Previous
            </button>

            <button
              type="button"
              onClick={() =>
                setIndex((i) => Math.min(questions.length - 1, i + 1))
              }
              disabled={index === questions.length - 1}
              className="rounded-lg bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold
                         text-[var(--primary-fg)] transition hover:bg-[var(--primary-hover)]
                         disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </section>

        {/* ---------------- navigator ---------------- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">
                Question {index + 1}/{questions.length}
              </h2>
              <span className="text-xs text-[var(--text-subtle)]">
                {answeredCount} answered
              </span>
            </div>

            <ol className="mt-4 grid grid-cols-5 gap-2">
              {questions.map((q, i) => {
                const isCurrent = i === index;
                const isAnswered = Boolean(answers[q.id]);
                const isFlagged = flagged.has(q.id);
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-current={isCurrent ? "true" : undefined}
                      aria-label={`Question ${i + 1}${
                        isAnswered ? ", answered" : ""
                      }${isFlagged ? ", flagged" : ""}`}
                      className={`relative grid h-9 w-full place-items-center rounded-full text-xs
                                  font-semibold transition ${
                                    isAnswered
                                      ? "bg-[var(--success)] text-[var(--primary-fg)]"
                                      : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]"
                                  } ${
                                    isCurrent
                                      ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)]"
                                      : ""
                                  }`}
                    >
                      {i + 1}
                      {isFlagged && (
                        <span
                          aria-hidden
                          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--warning)]"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>

            <button
              type="button"
              onClick={() => toggleFlag(question.id)}
              className="mt-5 flex w-full items-center gap-2 rounded-lg border border-[var(--border)]
                         px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition
                         hover:border-[var(--border-strong)] hover:text-[var(--text)]"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill={flagged.has(question.id) ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 21V4h13l-2.5 4L18 12H5" />
              </svg>
              {flagged.has(question.id) ? "Unflag question" : "Flag question"}
            </button>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="mt-3 w-full rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold
                       text-[var(--primary-fg)] shadow-[var(--shadow)] transition
                       hover:bg-[var(--primary-hover)] disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit test"}
          </button>

          <p className="mt-2 text-center text-[11px] text-[var(--text-subtle)]">
            {answeredCount === questions.length
              ? "All questions answered."
              : `${questions.length - answeredCount} still unanswered.`}
          </p>
        </aside>
      </div>
    </div>
  );
}

function CountdownRing({
  clock,
  fraction,
  low,
}: {
  clock: string;
  fraction: number;
  low: boolean;
}) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const stroke = low ? "var(--danger)" : "var(--success)";

  return (
    <span className="relative grid h-16 w-16 place-items-center">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth="5"
        />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span
        className={`absolute text-xs font-semibold tabular-nums ${
          low ? "text-[var(--danger)]" : ""
        }`}
        role="timer"
        aria-live="off"
      >
        {clock}
      </span>
    </span>
  );
}
