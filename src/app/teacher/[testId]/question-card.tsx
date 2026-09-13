"use client";

import { useActionState, useEffect, useState } from "react";
import { updateQuestion, deleteQuestion, type ActionState } from "../actions";

export type Option = { id: string; option_text: string; is_correct: boolean };

const initial: ActionState = {};
const LETTERS = ["A", "B", "C", "D"];

const field =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm " +
  "outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]";

export default function QuestionCard({
  testId,
  index,
  question,
  locked = false,
}: {
  testId: string;
  index: number;
  question: { id: string; question_text: string; options: Option[] };
  /** True when the viewer may not change the paper: it is live, or they are an admin reviewing it. */
  locked?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateQuestion, initial);

  // Close the editor once a save comes back clean.
  useEffect(() => {
    // The action state is an external form result; close the local editor after it resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (editing && !pending && state && !state.error) setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pending]);

  // Four fixed slots so a teacher can add or clear an option while editing.
  const slots = Array.from({ length: 4 }, (_, i) => question.options[i]);
  const correctIndex = question.options.findIndex((o) => o.is_correct);

  if (!editing) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
        <div className="flex items-start justify-between gap-4">
          <p className="font-medium">
            <span className="text-[var(--text-subtle)]">{index + 1}.</span>{" "}
            {question.question_text}
          </p>
          {!locked && (
          <div className="flex shrink-0 items-center gap-2 rounded-xl bg-[var(--surface-2)] p-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Edit question"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--primary-hover)]"
            >
              <EditIcon />
              Edit
            </button>
            <form action={deleteQuestion}>
              <input type="hidden" name="test_id" value={testId} />
              <input type="hidden" name="question_id" value={question.id} />
              <button
                title="Delete question"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3 py-2 text-xs font-semibold text-[var(--danger)] transition hover:-translate-y-0.5 hover:border-[var(--danger)] hover:bg-[var(--danger)] hover:text-white"
              >
                <TrashIcon />
                Delete
              </button>
            </form>
          </div>
          )}
        </div>

        <ul className="mt-3 space-y-1.5">
          {question.options.map((o, i) => (
            <li
              key={o.id}
              className={`flex items-center gap-2.5 text-sm ${
                o.is_correct
                  ? "font-medium text-[var(--success)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              <span
                aria-hidden
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${
                  o.is_correct
                    ? "bg-[var(--success-soft)] text-[var(--success)]"
                    : "border border-[var(--border-strong)] text-[var(--text-subtle)]"
                }`}
              >
                {LETTERS[i] ?? i + 1}
              </span>
              {o.option_text}
              {o.is_correct && (
                <span className="text-xs font-semibold">· correct</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-xl border border-[var(--primary)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]"
    >
      <input type="hidden" name="test_id" value={testId} />
      <input type="hidden" name="question_id" value={question.id} />

      <label
        htmlFor={`q-${question.id}`}
        className="text-xs font-semibold text-[var(--text-muted)]"
      >
        Question {index + 1}
      </label>
      <textarea
        id={`q-${question.id}`}
        name="question_text"
        rows={2}
        required
        defaultValue={question.question_text}
        className={`mt-1.5 ${field}`}
      />

      <fieldset className="mt-4">
        <legend className="text-xs font-semibold text-[var(--text-muted)]">
          Options — select the correct one. Clear a box to remove that option.
        </legend>
        <div className="mt-2 space-y-2">
          {slots.map((o, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                type="radio"
                name="correct"
                value={i}
                defaultChecked={i === correctIndex}
                required={i === 0}
                aria-label={`Option ${LETTERS[i]} is correct`}
                className="h-4 w-4 shrink-0 accent-[var(--primary)]"
              />
              <input type="hidden" name={`option_id_${i}`} value={o?.id ?? ""} />
              <input
                name={`option_${i}`}
                defaultValue={o?.option_text ?? ""}
                placeholder={`Option ${LETTERS[i]}`}
                className={field}
              />
            </div>
          ))}
        </div>
      </fieldset>

      {state.error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]"
        >
          {state.error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold
                     text-[var(--primary-fg)] transition hover:bg-[var(--primary-hover)]
                     disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium
                     text-[var(--text-muted)] transition hover:border-[var(--border-strong)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" /><path d="M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" />
    </svg>
  );
}
