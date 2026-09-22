"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "./actions";

const initial: LoginState = {};
const field =
  "mt-2 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-900 " +
  "placeholder:text-neutral-400 outline-none transition focus:border-[#5b58d6] " +
  "focus:ring-2 focus:ring-[#5b58d6]/20";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initial);
  const [showPassword, setShowPassword] = useState(false);

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
            Admission number<span className="text-[#5b58d6]">*</span>
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

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-neutral-800"
          >
            Password<span className="text-[#5b58d6]">*</span>
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              autoCorrect="off"
              spellCheck={false}
              required
              className={`${field} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 mt-2 flex w-12 items-center justify-center
                         text-neutral-400 transition hover:text-neutral-700"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-neutral-500">
            Your surname. Capital letters don&apos;t matter.
          </p>
        </div>

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
          className="w-full rounded-lg bg-[#5b58d6] px-4 py-3 font-semibold text-white
                     transition hover:bg-[#4b48c4] disabled:opacity-60"
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

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.4 5.3A9.6 9.6 0 0112 5c6.4 0 10 7 10 7a17.7 17.7 0 01-3.4 4.3M6.2 6.9A17.4 17.4 0 002 12s3.6 7 10 7a9.7 9.7 0 004-.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
