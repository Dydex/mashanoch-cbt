"use client";

import { useActionState, useEffect, useState } from "react";
import { setPassword, type StaffState } from "../actions";
import { createClient } from "@/lib/supabase/client";

const initial: StaffState = {};
const field =
  "mt-2 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-900 " +
  "outline-none transition focus:border-[#5b58d6] focus:ring-2 focus:ring-[#5b58d6]/20";

export default function SetPasswordPage() {
  const [state, formAction, pending] = useActionState(setPassword, initial);
  const [ready, setReady] = useState(false);

  /**
   * Invite and recovery links can arrive two ways. If Supabase used the PKCE
   * flow, /auth/callback already exchanged the code and there is a session.
   * If it used the implicit flow the tokens are in the URL fragment, which the
   * server never sees — so pick them up here and establish the session before
   * the password can be changed.
   */
  useEffect(() => {
    const supabase = createClient();
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");

    if (access_token && refresh_token) {
      supabase.auth
        .setSession({ access_token, refresh_token })
        .finally(() => {
          history.replaceState(null, "", window.location.pathname);
          setReady(true);
        });
    } else {
      setReady(true);
    }
  }, []);

  return (
    <>
      <h2 className="text-2xl font-bold text-neutral-900">Choose your password</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Pick something only you know. The school never sees it.
      </p>

      <form action={formAction} className="mt-7 space-y-5">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-neutral-800">
            New password
          </label>
          <input id="password" name="password" type="password"
            autoComplete="new-password" autoFocus required minLength={10} className={field} />
          <p className="mt-1.5 text-xs text-neutral-500">At least 10 characters.</p>
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-neutral-800">
            Confirm password
          </label>
          <input id="confirm" name="confirm" type="password"
            autoComplete="new-password" required minLength={10} className={field} />
        </div>

        {state.error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}

        <button type="submit" disabled={pending || !ready}
          className="w-full rounded-lg bg-[#5b58d6] px-4 py-3 font-semibold text-white
                     transition hover:bg-[#4b48c4] disabled:opacity-60">
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
