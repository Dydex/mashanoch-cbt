"use client";

import { useActionState, useState } from "react";
import {
  createSubject,
  deleteSubject,
  renameSubject,
  type AdminState,
} from "../actions";

const initial: AdminState = {};
const field =
  "min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 " +
  "text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]";
const primary =
  "rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-fg)] " +
  "transition hover:bg-[var(--primary-hover)] disabled:opacity-60";
const quiet =
  "rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium " +
  "text-[var(--text-muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--text)]";

export function AddSubjectForm() {
  const [name, setName] = useState("");
  const [state, action, pending] = useActionState(
    async (prev: AdminState, formData: FormData) => {
      const result = await createSubject(prev, formData);
      if (!result.error) setName("");
      return result;
    },
    initial,
  );

  return (
    <form
      action={action}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]"
    >
      <label htmlFor="subject_name" className="text-sm font-semibold">
        Add a subject
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          id="subject_name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Further Mathematics"
          className={field}
        />
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Adding…" : "Add"}
        </button>
      </div>

      {state.error && (
        <p role="alert" className="mt-3 text-xs text-[var(--danger)]">{state.error}</p>
      )}
      {state.notice && (
        <p role="status" className="mt-3 text-xs text-[var(--success)]">{state.notice}</p>
      )}
    </form>
  );
}

/** One subject: rename it, or remove it while no test uses it. */
export function SubjectRow({
  id,
  name,
  tests,
}: {
  id: string;
  name: string;
  tests: number;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [confirming, setConfirming] = useState(false);

  const [renameState, rename, renaming] = useActionState(
    async (prev: AdminState, formData: FormData) => {
      const result = await renameSubject(prev, formData);
      if (!result.error) setEditing(false);
      return result;
    },
    initial,
  );
  const [deleteState, remove, removing] = useActionState(deleteSubject, initial);

  const error = renameState.error ?? deleteState.error;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {editing ? (
          <form action={rename} className="flex min-w-0 flex-1 flex-wrap gap-2">
            <input type="hidden" name="subject_id" value={id} />
            <input
              name="name"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-label="Subject name"
              autoFocus
              required
              className={field}
            />
            <button disabled={renaming} className={primary}>
              {renaming ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setValue(name);
                setEditing(false);
              }}
              className={quiet}
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {tests} test{tests === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => setEditing(true)} className={quiet}>
                Rename
              </button>
              {tests === 0 &&
                (confirming ? (
                  <form action={remove} className="flex items-center gap-2">
                    <input type="hidden" name="subject_id" value={id} />
                    <span className="text-xs text-[var(--text-muted)]">Remove {name}?</span>
                    <button
                      disabled={removing}
                      className="rounded-lg bg-[var(--danger)] px-3 py-1.5 text-xs font-semibold
                                 text-white transition disabled:opacity-60"
                    >
                      {removing ? "Removing…" : "Yes"}
                    </button>
                    <button type="button" onClick={() => setConfirming(false)} className={quiet}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium
                               text-[var(--text-muted)] transition hover:border-[var(--danger)]
                               hover:text-[var(--danger)]"
                  >
                    Remove
                  </button>
                ))}
            </div>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-[var(--danger)]">{error}</p>
      )}
    </div>
  );
}
