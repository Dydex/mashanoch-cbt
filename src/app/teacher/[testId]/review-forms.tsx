"use client";

import { useActionState, useState } from "react";
import { submitForReview, type ActionState } from "../actions";
import { reviewTest, type AdminState } from "@/app/admin/actions";
import { REVIEW_NOTE_MAX } from "@/lib/constants";

const field =
  "mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm " +
  "outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]";

const button =
  "rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60";

/*
 * Both notes are controlled rather than left to the form. React resets
 * uncontrolled fields after every action, including one that was refused, and
 * a long note should survive being told to add something. Each is cleared
 * only once its action succeeds.
 */

function Feedback({ state }: { state: { error?: string; notice?: string } }) {
  if (state.error)
    return (
      <p role="alert" className="mt-3 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
        {state.error}
      </p>
    );
  if (state.notice)
    return (
      <p role="status" className="mt-3 rounded-lg bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">
        {state.notice}
      </p>
    );
  return null;
}

/** The teacher's side: hand the test to the admins, with an optional note. */
export function SubmitForm({
  testId,
  resubmit,
}: {
  testId: string;
  /** True if it has been submitted before, e.g. after changes were requested. */
  resubmit: boolean;
}) {
  const [note, setNote] = useState("");
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await submitForReview(prev, formData);
      if (!result.error) setNote("");
      return result;
    },
    {},
  );

  return (
    <form action={formAction} className="mt-5 border-t border-[var(--border)] pt-5">
      <input type="hidden" name="test_id" value={testId} />

      <label htmlFor="submit-note" className="text-sm font-medium">
        Note for the admin{" "}
        <span className="font-normal text-[var(--text-muted)]">(optional)</span>
      </label>
      <textarea
        id="submit-note"
        name="note"
        rows={2}
        maxLength={REVIEW_NOTE_MAX}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={resubmit ? "What did you change?" : "Anything the admin should know?"}
        className={field}
      />

      <Feedback state={state} />

      <button
        type="submit"
        disabled={pending}
        className={`mt-3 ${button} bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)]`}
      >
        {pending
          ? "Submitting…"
          : resubmit
            ? "Resubmit for approval"
            : "Submit for approval"}
      </button>
    </form>
  );
}

/** The admin's side: approve, send back with a note, or just comment. */
export function ReviewForm({
  testId,
  submissionId,
  canApprove,
  canSendBack,
}: {
  testId: string;
  /** The latest submission this page showed; see reviewTest. */
  submissionId: string;
  canApprove: boolean;
  canSendBack: boolean;
}) {
  const [note, setNote] = useState("");
  const [state, formAction, pending] = useActionState(
    async (prev: AdminState, formData: FormData) => {
      const result = await reviewTest(prev, formData);
      if (!result.error) setNote("");
      return result;
    },
    {},
  );

  const hint = canSendBack
    ? "Needed when you request changes, so the teacher knows what to fix. Optional when you approve."
    : canApprove
      ? "Optional. Saved with your approval, or post it on its own as a comment."
      : "Comments are shared with the teacher and the other admins.";

  return (
    <form action={formAction} className="mt-4">
      <input type="hidden" name="test_id" value={testId} />
      <input type="hidden" name="submission_id" value={submissionId} />

      <label htmlFor="review-note" className="text-sm font-medium">
        Note for the teacher
      </label>
      <textarea
        id="review-note"
        name="note"
        rows={3}
        maxLength={REVIEW_NOTE_MAX}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Question 4 has two correct options."
        className={field}
      />
      <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>

      <Feedback state={state} />

      <div className="mt-3 flex flex-wrap gap-2">
        {canApprove && (
          <button
            type="submit"
            name="decision"
            value="approve"
            disabled={pending}
            className={`${button} bg-[var(--success)] text-[var(--surface)] hover:opacity-90`}
          >
            Approve
          </button>
        )}
        {canSendBack && (
          <button
            type="submit"
            name="decision"
            value="changes"
            disabled={pending}
            className={`${button} border border-[var(--warning)]/30 bg-[var(--warning-soft)] text-[var(--warning)] hover:border-[var(--warning)]`}
          >
            Request changes
          </button>
        )}
        <button
          type="submit"
          name="decision"
          value="comment"
          disabled={pending}
          className={`${button} border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]`}
        >
          Add comment
        </button>
      </div>
    </form>
  );
}
