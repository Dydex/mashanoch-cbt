"use client";

import { useActionState, useState } from "react";
import {
  createSubject,
  deleteSubject,
  updateSubject,
  type AdminState,
} from "../actions";
import { DEPARTMENTS, DEPARTMENT_LABELS, type Department } from "@/lib/constants";

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

function DepartmentSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      name="department"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Department"
      className={`${field} flex-none sm:w-44`}
    >
      <option value="">General — everyone</option>
      {DEPARTMENTS.map((d) => (
        <option key={d} value={d}>
          {DEPARTMENT_LABELS[d]} only
        </option>
      ))}
    </select>
  );
}

export function AddSubjectForm() {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [state, action, pending] = useActionState(
    async (prev: AdminState, formData: FormData) => {
      const result = await createSubject(prev, formData);
      if (!result.error) {
        setName("");
        setDepartment("");
      }
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
          placeholder="Marketing"
          className={field}
        />
        <DepartmentSelect value={department} onChange={setDepartment} />
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        A department subject is only open to that department in SS1 and SS2.
        General subjects are open to the whole class.
      </p>

      {state.error && (
        <p role="alert" className="mt-3 text-xs text-[var(--danger)]">{state.error}</p>
      )}
      {state.notice && (
        <p role="status" className="mt-3 text-xs text-[var(--success)]">{state.notice}</p>
      )}
    </form>
  );
}

export function SubjectRow({
  id,
  name,
  department,
  tests,
}: {
  id: string;
  name: string;
  department: Department | null;
  tests: number;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [dept, setDept] = useState(department ?? "");
  const [confirming, setConfirming] = useState(false);

  const [saveState, save, saving] = useActionState(
    async (prev: AdminState, formData: FormData) => {
      const result = await updateSubject(prev, formData);
      if (!result.error) setEditing(false);
      return result;
    },
    initial,
  );
  const [deleteState, remove, removing] = useActionState(deleteSubject, initial);
  const error = saveState.error ?? deleteState.error;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {editing ? (
          <form action={save} className="flex min-w-0 flex-1 flex-wrap gap-2">
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
            <DepartmentSelect value={dept} onChange={setDept} />
            <button disabled={saving} className={primary}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setValue(name);
                setDept(department ?? "");
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
                {department ? `${DEPARTMENT_LABELS[department]} only` : "General"} ·{" "}
                {tests} test{tests === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => setEditing(true)} className={quiet}>
                Edit
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
