"use client";

import { useState } from "react";

const field =
  "mt-2 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 pr-12 text-neutral-900 " +
  "placeholder:text-neutral-400 outline-none transition focus:border-[var(--primary)] " +
  "focus:ring-2 focus:ring-[var(--ring)]";

export default function PasswordField({
  id,
  name = id,
  label,
  hint,
  autoComplete = "current-password",
  autoFocus = false,
  minLength,
  required = true,
}: {
  id: string;
  name?: string;
  label: string;
  hint?: string;
  autoComplete?: "current-password" | "new-password";
  autoFocus?: boolean;
  minLength?: number;
  required?: boolean;
}) {
  const [shown, setShown] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-800">
        {label}
        {required && <span className="text-[var(--primary)]">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          required={required}
          minLength={minLength}
          className={field}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 mt-2 flex w-12 items-center justify-center
                     text-neutral-400 transition hover:text-neutral-700"
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint && <p className="mt-1.5 text-xs text-neutral-500">{hint}</p>}
    </div>
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
