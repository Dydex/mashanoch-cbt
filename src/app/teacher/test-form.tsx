"use client";

import { useActionState } from "react";
import type { ActionState } from "./actions";
import { CLASSES, TERMS, currentSession } from "@/lib/constants";
import { SCHOOL_TIME_LABEL } from "@/lib/time";

/** An existing test's details, as the edit form needs them. */
export type TestFormValues = {
  id: string;
  title: string;
  description: string | null;
  subject_id: string;
  class: string;
  term: string;
  session: string;
  duration_minutes: number;
  /** datetime-local values, e.g. "2026-09-14T09:00". */
  start: string;
  end: string;
};

const initial: ActionState = {};
const field =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]";

/** A test's details. Given `test` it edits that test; without it, creates one. */
export default function TestForm({
  subjects,
  action,
  test,
  submitLabel,
  pendingLabel,
}: {
  subjects: { id: string; name: string }[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  test?: TestFormValues;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="space-y-5">
      {test && <input type="hidden" name="test_id" value={test.id} />}

      <div>
        <label htmlFor="title" className="text-sm font-medium">Title</label>
        <input id="title" name="title" required defaultValue={test?.title}
          className={field} placeholder="First Term Examination" />
      </div>

      <div>
        <label htmlFor="description" className="text-sm font-medium">
          Description <span className="text-[var(--text-muted)]">(optional)</span>
        </label>
        <textarea id="description" name="description" rows={2}
          defaultValue={test?.description ?? ""} className={field} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="subject_id" className="text-sm font-medium">Subject</label>
          <select id="subject_id" name="subject_id" required
            defaultValue={test?.subject_id ?? ""} className={field}>
            <option value="" disabled>Choose…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="class" className="text-sm font-medium">Class</label>
          <select id="class" name="class" required
            defaultValue={test?.class ?? ""} className={field}>
            <option value="" disabled>Choose…</option>
            {CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="term" className="text-sm font-medium">Term</label>
          <select id="term" name="term" required
            defaultValue={test?.term ?? "First"} className={field}>
            {TERMS.map((t) => (
              <option key={t} value={t}>{t} Term</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="session" className="text-sm font-medium">Session</label>
          <input id="session" name="session" required
            defaultValue={test?.session ?? currentSession()} pattern="\d{4}/\d{4}"
            placeholder="2026/2027" className={field} />
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            The academic session, e.g. 2026/2027.
          </p>
        </div>

        <div>
          <label htmlFor="duration_minutes" className="text-sm font-medium">
            Duration (minutes)
          </label>
          <input id="duration_minutes" name="duration_minutes" type="text"
            inputMode="numeric" pattern="[0-9]*"
            defaultValue={String(test?.duration_minutes ?? 30)} required
            className={field} />
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Each student gets this long from the moment they start. Every
            question is worth 2 marks.
          </p>
        </div>

        <div>
          <label htmlFor="start_time" className="text-sm font-medium">Opens</label>
          <input id="start_time" name="start_time" type="datetime-local" required
            defaultValue={test?.start} className={field} />
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Both times are {SCHOOL_TIME_LABEL}.
          </p>
        </div>

        <div>
          <label htmlFor="end_time" className="text-sm font-medium">Closes</label>
          <input id="end_time" name="end_time" type="datetime-local" required
            defaultValue={test?.end} className={field} />
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Nobody can open or submit the test outside this window.
          </p>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-[var(--danger)]">{state.error}</p>
      )}
      {state.notice && (
        <p role="status" className="text-sm text-[var(--success)]">{state.notice}</p>
      )}

      <button type="submit" disabled={pending}
        className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-fg)] shadow-[var(--shadow)] transition hover:bg-[var(--primary-hover)] disabled:opacity-60">
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
