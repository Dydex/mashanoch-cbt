"use client";

import { useActionState, useEffect, useRef } from "react";
import { addQuestion, type ActionState } from "../actions";
import { IMAGE_ACCEPT } from "@/lib/question-image";

const initial: ActionState = {};
const field =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]";

export default function AddQuestionForm({ testId }: { testId: string }) {
  const [state, formAction, pending] = useActionState(addQuestion, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form after a successful save so the teacher can keep typing.
  useEffect(() => {
    if (!pending && state && !state.error) formRef.current?.reset();
  }, [state, pending]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="test_id" value={testId} />

      <div>
        <label htmlFor="question_text" className="text-sm font-medium">Question</label>
        <textarea id="question_text" name="question_text" rows={2} required
          className={`mt-1 ${field}`} placeholder="What is the capital of Nigeria?" />
      </div>

      <div>
        <label htmlFor="question_image" className="text-sm font-medium">
          Picture{" "}
          <span className="font-normal text-[var(--text-muted)]">
            — optional, for a diagram or map. Up to 2 MB.
          </span>
        </label>
        <input id="question_image" name="image" type="file" accept={IMAGE_ACCEPT}
          className="mt-1 block w-full text-sm text-[var(--text-muted)]
                     file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--surface-2)]
                     file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[var(--text)]" />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">
          Options{" "}
          <span className="font-normal text-[var(--text-muted)]">
            — select the correct one. Leave unused boxes blank.
          </span>
        </legend>
        <div className="mt-2 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <input type="radio" name="correct" value={i} required={i === 0}
                aria-label={`Option ${i + 1} is correct`}
                className="h-4 w-4 accent-[var(--primary)]" />
              <input name={`option_${i}`} className={field}
                placeholder={`Option ${i + 1}`} />
            </div>
          ))}
        </div>
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button type="submit" disabled={pending}
        className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-fg)] shadow-[var(--shadow)] transition hover:bg-[var(--primary-hover)] disabled:opacity-60">
        {pending ? "Adding…" : "Add question"}
      </button>
    </form>
  );
}
