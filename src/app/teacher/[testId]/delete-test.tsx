"use client";

import { useState } from "react";
import { deleteTest } from "../actions";

/**
 * Deletes a test with its questions and approval thread. Two-step, and only
 * offered while nobody has sat it: the server refuses once there are
 * submissions, because those are the school's record of results.
 */
export default function DeleteTest({
  testId,
  title,
}: {
  testId: string;
  title: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium
                   text-[var(--text-muted)] transition hover:border-[var(--danger)]
                   hover:text-[var(--danger)]"
      >
        Delete this test
      </button>
    );
  }

  return (
    <form action={deleteTest} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="test_id" value={testId} />
      <span className="text-xs text-[var(--text-muted)]">
        Delete “{title}” and its questions? This cannot be undone.
      </span>
      <button
        className="rounded-lg bg-[var(--danger)] px-3 py-1.5 text-xs font-semibold
                   text-white transition"
      >
        Yes, delete
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium
                   text-[var(--text-muted)]"
      >
        Cancel
      </button>
    </form>
  );
}
