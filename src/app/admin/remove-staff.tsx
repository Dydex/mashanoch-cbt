"use client";

import { useActionState, useState } from "react";
import { removeStaff, type AdminState } from "./actions";

const initial: AdminState = {};

/**
 * Two-step: the first click asks for confirmation. Removing an account is not
 * undoable, so it should never be one stray click away.
 */
export default function RemoveStaff({
  id,
  name,
  isSelf,
}: {
  id: string;
  name: string;
  isSelf: boolean;
}) {
  const [state, action, pending] = useActionState(removeStaff, initial);
  const [confirming, setConfirming] = useState(false);

  if (isSelf) {
    return (
      <span className="shrink-0 text-xs text-[var(--text-subtle)]">You</span>
    );
  }

  if (state.error) {
    return (
      <span className="shrink-0 text-xs text-[var(--danger)]">
        {state.error}
      </span>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="shrink-0 rounded-lg border border-transparent px-3 py-1.5 text-xs
                   font-medium text-[var(--text-muted)] transition
                   hover:border-[var(--danger)] hover:text-[var(--danger)]"
      >
        Remove
      </button>
    );
  }

  return (
    <form action={action} className="flex shrink-0 items-center gap-2">
      <input type="hidden" name="profile_id" value={id} />
      <span className="text-xs text-[var(--text-muted)]">
        Remove {name.split(/\s+/)[0]}?
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
        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs
                   font-medium text-[var(--text-muted)]"
      >
        Cancel
      </button>
    </form>
  );
}
