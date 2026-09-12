"use client";

import { useActionState } from "react";
import { inviteStaff, createStudent, type AdminState } from "./actions";
import { CLASSES } from "@/lib/constants";

const initial: AdminState = {};
const field =
  "mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 " +
  "text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]";
const label = "text-xs font-semibold text-[var(--text-muted)]";
const button =
  "rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-fg)] " +
  "transition hover:bg-[var(--primary-hover)] disabled:opacity-60";

export function InviteStaffForm() {
  const [state, action, pending] = useActionState(inviteStaff, initial);

  return (
    <form
      action={action}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]"
    >
      <h2 className="text-sm font-semibold">Invite a teacher or admin</h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        Any working address — personal is fine. They receive a link and choose
        their own password, which you never see.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="staff_name" className={label}>Full name</label>
          <input id="staff_name" name="full_name" required
            placeholder="Mrs Adeyemi" className={field} />
        </div>
        <div>
          <label htmlFor="staff_email" className={label}>
            Email address
          </label>
          <input id="staff_email" name="email" type="email" required
            placeholder="teacher@example.com" className={field} />
        </div>
        <div>
          <label htmlFor="staff_role" className={label}>Role</label>
          <select id="staff_role" name="role" defaultValue="teacher" className={field}>
            <option value="teacher">Teacher</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="mt-3 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p className="mt-3 rounded-lg bg-[var(--success-soft)] px-3 py-2 text-xs text-[var(--success)]">
          {state.notice}
        </p>
      )}

      <button type="submit" disabled={pending} className={`mt-4 ${button}`}>
        {pending ? "Sending…" : "Send invitation"}
      </button>
    </form>
  );
}

export function AddStudentForm() {
  const [state, action, pending] = useActionState(createStudent, initial);

  return (
    <form
      action={action}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]"
    >
      <h2 className="text-sm font-semibold">Add a student</h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        An ID and PIN are generated. Write them down — the PIN cannot be recovered.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="student_name" className={label}>Full name</label>
          <input id="student_name" name="full_name" required
            placeholder="Ada Obi" className={field} />
        </div>
        <div>
          <label htmlFor="student_class" className={label}>Class</label>
          <select id="student_class" name="class" defaultValue="" required className={field}>
            <option value="" disabled>Choose…</option>
            {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="mt-3 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
          {state.error}
        </p>
      )}

      {state.issued && <Slip issued={state.issued} />}

      <button type="submit" disabled={pending} className={`mt-4 ${button}`}>
        {pending ? "Creating…" : "Create student"}
      </button>
    </form>
  );
}

/** Shown once. There is no way to read the PIN back afterwards. */
export function Slip({ issued }: { issued: NonNullable<AdminState["issued"]> }) {
  return (
    <div className="mt-3 rounded-xl border-2 border-dashed border-[var(--primary)] bg-[var(--primary-soft)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--primary)]">
        Write this down now
      </p>
      <p className="mt-2 text-sm font-semibold">{issued.fullName}</p>
      {issued.class && (
        <p className="text-xs text-[var(--text-muted)]">{issued.class}</p>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-[11px] text-[var(--text-muted)]">ID</dt>
          <dd className="font-mono text-lg font-semibold tracking-widest">{issued.username}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-[var(--text-muted)]">PIN</dt>
          <dd className="font-mono text-lg font-semibold tracking-widest">{issued.pin}</dd>
        </div>
      </dl>
    </div>
  );
}
