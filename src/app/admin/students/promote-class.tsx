"use client";

import { useActionState, useState } from "react";
import { promoteClass, type AdminState } from "../actions";

const initial: AdminState = {};
const quiet =
  "rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium " +
  "text-[var(--text-muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--text)]";

/**
 * Moves a whole class up a year at the end of the session. Two-step: it
 * changes which tests every student in the class can see.
 */
export default function PromoteClass({
  klass,
  next,
  count,
}: {
  klass: string;
  /** The class they move up to, or null if this is the final class. */
  next: string | null;
  count: number;
}) {
  const [state, action, pending] = useActionState(promoteClass, initial);
  const [confirming, setConfirming] = useState(false);

  if (state.notice) {
    return (
      <span role="status" className="text-xs text-[var(--success)]">
        {state.notice}
      </span>
    );
  }

  if (!next) {
    return (
      <span className="text-xs text-[var(--text-subtle)]">
        Final class — remove students once they leave
      </span>
    );
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={quiet}>
        Promote to {next}
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="class" value={klass} />
      <span className="text-xs text-[var(--text-muted)]">
        Move all {count} student{count === 1 ? "" : "s"} to {next}?
      </span>
      <button
        disabled={pending}
        className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold
                   text-[var(--primary-fg)] transition disabled:opacity-60"
      >
        {pending ? "Moving…" : "Yes, promote"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className={quiet}>
        Cancel
      </button>
      {state.error && (
        <span role="alert" className="text-xs text-[var(--danger)]">{state.error}</span>
      )}
    </form>
  );
}
