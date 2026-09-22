"use client";

import { useActionState, useState } from "react";
import { removeStudent, type AdminState } from "../actions";

const initial: AdminState = {};

/**
 * Removes one student. Two-step, because it also deletes everything they
 * have sat and cannot be undone.
 */
export default function RemoveStudent({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [state, action, pending] = useActionState(removeStudent, initial);
  const [confirming, setConfirming] = useState(false);

  if (state.error) {
    return (
      <span role="alert" className="text-xs text-[var(--danger)]">
        {state.error}
      </span>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium
                   text-[var(--text-muted)] transition hover:border-[var(--danger)]
                   hover:text-[var(--danger)]"
      >
        Remove
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="profile_id" value={id} />
      <span className="text-xs text-[var(--text-muted)]">
        Remove {name.split(/\s+/)[0]} and their results?
      </span>
      <button
        disabled={pending}
        className="rounded-lg bg-[var(--danger)] px-3 py-1.5 text-xs font-semibold
                   text-white transition disabled:opacity-60"
      >
        {pending ? "Removing…" : "Yes, remove"}
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
