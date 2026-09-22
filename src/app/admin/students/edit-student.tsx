"use client";

import { useActionState, useState } from "react";
import { updateStudent, type AdminState } from "../actions";

const field =
  "min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 " +
  "text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]";

/**
 * Corrects one student's first name, last name and admission number, inline in
 * their row. Changing the last name changes their password, which is their
 * surname. Fields are controlled so a refused save keeps what was typed,
 * rather than React clearing the form.
 */
export default function EditStudent({
  id,
  firstName,
  lastName,
  admissionNo,
}: {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ firstName, lastName, admissionNo });
  const [state, action, pending] = useActionState(
    async (prev: AdminState, formData: FormData) => {
      const result = await updateStudent(prev, formData);
      if (!result.error) setEditing(false);
      return result;
    },
    {},
  );

  const set = (key: keyof typeof values) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        {state.notice && (
          <span role="status" className="text-xs text-[var(--success)]">
            {state.notice}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setValues({ firstName, lastName, admissionNo });
            setEditing(true);
          }}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium
                     text-[var(--text-muted)] transition hover:border-[var(--border-strong)]
                     hover:text-[var(--text)]"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex w-full flex-wrap items-center gap-2">
      <input type="hidden" name="profile_id" value={id} />
      <input name="first_name" value={values.firstName} onChange={set("firstName")}
        aria-label="First name" placeholder="First name" required autoFocus
        className={`${field} w-32`} />
      <input name="last_name" value={values.lastName} onChange={set("lastName")}
        aria-label="Last name (password)" placeholder="Last name" required
        className={`${field} w-32`} />
      <input name="admissionNo" value={values.admissionNo} onChange={set("admissionNo")}
        aria-label="Admission number" placeholder="Admission no." required
        autoCapitalize="characters" autoCorrect="off" spellCheck={false}
        className={`${field} w-40 font-mono uppercase`} />
      <button
        disabled={pending}
        className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold
                   text-[var(--primary-fg)] transition hover:bg-[var(--primary-hover)]
                   disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium
                   text-[var(--text-muted)]"
      >
        Cancel
      </button>
      {state.error && (
        <span role="alert" className="w-full text-xs text-[var(--danger)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
