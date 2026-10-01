"use client";

import { useActionState, useEffect, useState } from "react";
import { setPassword, type StaffState } from "../actions";
import { createClient } from "@/lib/supabase/client";
import PasswordField from "@/components/password-field";

const initial: StaffState = {};

export default function SetPasswordPage() {
  const [state, formAction, pending] = useActionState(setPassword, initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");

    const session =
      access_token && refresh_token
        ? createClient()
            .auth.setSession({ access_token, refresh_token })
            .then(() => {
              history.replaceState(null, "", window.location.pathname);
            })
        : Promise.resolve();
    session.finally(() => setReady(true));
  }, []);

  return (
    <>
      <h2 className="text-2xl font-bold text-neutral-900">Choose your password</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Pick something only you know. The school never sees it.
      </p>

      <form action={formAction} className="mt-7 space-y-5">
        <PasswordField
          id="password"
          label="New password"
          hint="At least 10 characters."
          autoComplete="new-password"
          autoFocus
          minLength={10}
        />

        <PasswordField
          id="confirm"
          label="Confirm password"
          autoComplete="new-password"
          minLength={10}
        />

        {state.error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending || !ready}
          className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 font-semibold text-white
                     transition hover:bg-[var(--primary-hover)] disabled:opacity-60">
          {!ready
            ? "Checking your link…"
            : pending
              ? "Saving…"
              : "Save password and continue"}
        </button>
      </form>
    </>
  );
}
