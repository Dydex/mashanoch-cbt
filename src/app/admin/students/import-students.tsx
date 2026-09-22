"use client";

import { useActionState } from "react";
import { importStudents, type AdminState } from "../actions";
import { CLASSES } from "@/lib/constants";

const initial: AdminState = {};

const TEMPLATE = `first_name,last_name,admission_no,class
Ada,Obi,MPS/2026/001,${CLASSES[0]}
Musa,Bello,MPS/2026/002,${CLASSES[1] ?? CLASSES[0]}`;

/**
 * Adds a list of students from a spreadsheet saved as CSV. Every row is
 * checked first; rows that cannot be used are reported and skipped, so one
 * bad line never stops the rest.
 */
export default function ImportStudents() {
  const [state, action, pending] = useActionState(importStudents, initial);

  return (
    <form
      action={action}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]"
    >
      <h2 className="text-sm font-semibold">Add many at once</h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        Upload a spreadsheet saved as CSV. Its first row names the columns —
        first_name, last_name, admission_no, class — in any order. Up to 200
        rows at a time. Each student&apos;s password is their last name.
      </p>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-[var(--text-muted)]">
          What the file should look like
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--surface-2)] p-3 text-[11px] leading-5">
{TEMPLATE}
        </pre>
      </details>

      <input
        type="file"
        name="file"
        accept=".csv,text/csv"
        required
        className="mt-3 block w-full text-xs text-[var(--text-muted)]
                   file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--surface-2)]
                   file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[var(--text)]"
      />

      {state.error && (
        <p role="alert" className="mt-3 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
          {state.error}
        </p>
      )}

      {state.imported && (
        <div className="mt-3 rounded-lg bg-[var(--surface-2)] px-3 py-2">
          <p className="text-xs font-semibold text-[var(--success)]">
            {state.notice}
          </p>
          {state.imported.problems.length > 0 && (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[11px] text-[var(--danger)]">
              {state.imported.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold
                   text-[var(--primary-fg)] transition hover:bg-[var(--primary-hover)]
                   disabled:opacity-60"
      >
        {pending ? "Adding students…" : "Upload and add"}
      </button>
    </form>
  );
}
