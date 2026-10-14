"use client";

import { useActionState, useState } from "react";
import { reopenTest, type AdminState } from "@/app/admin/actions";
import { REOPEN_MAX_DAYS } from "@/lib/constants";
import { SCHOOL_TIME_LABEL } from "@/lib/time";

const field =
  "mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm " +
  "outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]";
const choice =
  "rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium " +
  "text-[var(--text-muted)] transition hover:border-[var(--primary)] hover:text-[var(--text)]";

export default function ReopenForm({
  testId,
  tomorrowSameTime,
  inTwoHours,
}: {
  testId: string;
  tomorrowSameTime: string;
  inTwoHours: string;
}) {
  const [closesAt, setClosesAt] = useState(tomorrowSameTime);
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState(
    async (prev: AdminState, formData: FormData) => {
      const result = await reopenTest(prev, formData);
      if (!result.error) setReason("");
      return result;
    },
    {},
  );

  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="test_id" value={testId} />

      <label htmlFor="closes_at" className="text-sm font-medium">
        Close it again at
      </label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <button type="button" onClick={() => setClosesAt(tomorrowSameTime)} className={choice}>
          Tomorrow, same closing time
        </button>
        <button type="button" onClick={() => setClosesAt(inTwoHours)} className={choice}>
          In 2 hours
        </button>
      </div>
      <input
        id="closes_at"
        name="closes_at"
        type="datetime-local"
        required
        value={closesAt}
        onChange={(e) => setClosesAt(e.target.value)}
        className={field}
      />
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        {SCHOOL_TIME_LABEL}. Up to {REOPEN_MAX_DAYS} days from now. Each student
        still gets their full time from when they start, up to this closing
        time.
      </p>

      <label htmlFor="reopen_reason" className="mt-4 block text-sm font-medium">
        Why are you reopening it?
      </label>
      <textarea
        id="reopen_reason"
        name="reason"
        rows={2}
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Several students were absent."
        className={field}
      />
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        Saved in the test&apos;s approval history, where the teacher can see it.
      </p>

      {state.error && (
        <p role="alert" className="mt-3 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="mt-3 rounded-lg bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">
          {state.notice}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold
                   text-[var(--primary-fg)] transition hover:bg-[var(--primary-hover)]
                   disabled:opacity-60"
      >
        {pending ? "Reopening…" : "Reopen test"}
      </button>
    </form>
  );
}
