"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import PasswordField from "@/components/password-field";

const initial: LoginState = {};
const field =
  "mt-2 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-900 " +
  "placeholder:text-neutral-400 outline-none transition focus:border-[var(--primary)] " +
  "focus:ring-2 focus:ring-[var(--ring)]";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initial);

  return (
    <>
      <h2 className="text-3xl font-bold text-neutral-900">Student sign in</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Use your admission number. Your password is your surname.
      </p>

      <form action={formAction} className="mt-8 space-y-5">
        <div>
          <label
            htmlFor="admissionNo"
            className="block text-sm font-medium text-neutral-800"
          >
            Admission number<span className="text-[var(--primary)]">*</span>
          </label>
          <input
            id="admissionNo"
            name="admissionNo"
            autoComplete="username"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            required
            className={`${field} uppercase tracking-wide`}
          />
        </div>

        <PasswordField
          id="password"
          label="Password"
          hint="Your surname. Capital letters don't matter."
        />

        {state.error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 font-semibold text-white
                     transition hover:bg-[var(--primary-hover)] disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 border-t border-neutral-200 pt-5 text-center text-xs text-neutral-400">
        Can&apos;t sign in? Ask your exam officer to check your details.
      </p>
    </>
  );
}
