"use client";

import { useActionState } from "react";
import { resetStudentPin, type AdminState } from "./actions";
import { Slip } from "./account-forms";

const initial: AdminState = {};

export default function ResetPin({ id }: { id: string }) {
  const [state, action, pending] = useActionState(resetStudentPin, initial);

  if (state.issued) {
    return (
      <div className="w-full max-w-xs">
        <Slip issued={state.issued} />
      </div>
    );
  }

  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="profile_id" value={id} />
      <button
        disabled={pending}
        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium
                   text-[var(--text-muted)] transition hover:border-[var(--border-strong)]
                   hover:text-[var(--text)] disabled:opacity-60"
      >
        {pending ? "Resetting…" : "Reset PIN"}
      </button>
    </form>
  );
}
