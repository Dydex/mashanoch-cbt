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
  const [showPin, setShowPin] = useState(false);

  return (
    <>
      <h2 className="text-3xl font-bold text-neutral-900">Student sign in</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Use the ID and PIN on your slip.
      </p>

      <form action={formAction} className="mt-8 space-y-5">
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-neutral-800"
          >
            Student ID<span className="text-[#5b58d6]">*</span>
          </label>
          <input
            id="username"
            name="username"
            inputMode="numeric"
            autoComplete="username"
            autoFocus
            required
            placeholder="260147"
            className={`${field} tracking-widest`}
          />
        </div>

        <div>
          <label
            htmlFor="pin"
            className="block text-sm font-medium text-neutral-800"
          >
            PIN<span className="text-[#5b58d6]">*</span>
          </label>
          <div className="relative">
            <input
              id="pin"
              name="pin"
              type={showPin ? "text" : "password"}
              autoComplete="current-password"
              required
              className={`${field} pr-12 tracking-widest`}
            />
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              aria-label={showPin ? "Hide PIN" : "Show PIN"}
              aria-pressed={showPin}
              className="absolute inset-y-0 right-0 mt-2 flex w-12 items-center justify-center
                         text-neutral-400 transition hover:text-neutral-700"
            >
              {showPin ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
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
        Lost your PIN? Your exam officer can issue a new one.
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
