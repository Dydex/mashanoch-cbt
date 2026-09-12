"use client";

import { useActionState, useState } from "react";
import { resetClassPins, type AdminState } from "../actions";
import { Slips } from "../slips";

const initial: AdminState = {};

export default function BulkReset({
  klass,
  count,
}: {
  klass: string;
  count: number;
}) {
  const [state, action, pending] = useActionState(resetClassPins, initial);
  const [confirming, setConfirming] = useState(false);

  if (state.issuedBatch?.length) {
    return (
      <div className="print:m-0">
        {state.notice && (
          <p className="rounded-lg bg-[var(--success-soft)] px-4 py-2.5 text-sm text-[var(--success)] print:hidden">
            {state.notice}
          </p>
        )}
        <Slips slips={state.issuedBatch} />
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={count === 0}
        className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium
                   text-[var(--text-muted)] transition hover:border-[var(--border-strong)]
                   hover:text-[var(--text)] disabled:opacity-40"
      >
        Reset all {klass} PINs
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="class" value={klass} />
      <span className="text-xs text-[var(--text-muted)]">
        Reset {count} PIN{count === 1 ? "" : "s"}? Old ones stop working.
      </span>
      <button
        disabled={pending}
        className="rounded-lg bg-[var(--danger)] px-3 py-1.5 text-xs font-semibold
                   text-white transition disabled:opacity-60"
      >
        {pending ? "Resetting…" : "Yes, reset"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium
                   text-[var(--text-muted)]"
      >
        Cancel
      </button>
      {state.error && (
        <span className="text-xs text-[var(--danger)]">{state.error}</span>
      )}
    </form>
  );
}
