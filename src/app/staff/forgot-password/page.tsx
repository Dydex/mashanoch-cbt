"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { requestPasswordReset, type StaffState } from "../actions";
import {
  RESET_LINK_TTL_SECONDS,
  RESET_RESEND_COOLDOWN_SECONDS,
} from "@/lib/constants";

const initial: StaffState = {};

/** 3725 seconds as "1:02:05", 125 as "2:05". */
function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export default function ForgotPasswordPage() {
  // Controlled, so the address is still there to resend to: React clears
  // uncontrolled fields after every form action.
  const [email, setEmail] = useState("");

  // When the latest link was sent, and the clock both countdowns read. Each is
  // set outside render (in the action, and by the interval below), which
  // keeps rendering pure.
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  const [state, formAction, pending] = useActionState(
    async (prev: StaffState, formData: FormData) => {
      const result = await requestPasswordReset(prev, formData);
      if (!result.error) {
        const t = Date.now();
        setSentAt(t);
        setNow(t);
      }
      return result;
    },
    initial,
  );

  useEffect(() => {
    if (sentAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sentAt]);

  const sent = sentAt !== null;
  const elapsed = sent ? Math.floor((now - sentAt) / 1000) : 0;
  const expiresIn = Math.max(0, RESET_LINK_TTL_SECONDS - elapsed);
  // Supabase will not send another reset email to the same address this
  // soon. The action hides that refusal (it would reveal which addresses
  // exist), so without this wait a resend would restart the countdown for a
  // link that never went out.
  const resendIn = Math.max(0, RESET_RESEND_COOLDOWN_SECONDS - elapsed);
  const expired = sent && expiresIn === 0;

  return (
    <>
      <h2 className="text-2xl font-bold text-neutral-900">Reset your password</h2>
      <p className="mt-2 text-sm text-neutral-600">
        We&apos;ll email you a link to choose a new one.
      </p>

      <form action={formAction} className="mt-7 space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-neutral-800">
            Email address
          </label>
          <input id="email" name="email" type="email" autoComplete="username"
            autoFocus required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3
                       text-neutral-900 outline-none transition focus:border-[#5b58d6]
                       focus:ring-2 focus:ring-[#5b58d6]/20" />
        </div>

        {state.error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
        {state.notice && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.notice}</p>
        )}

        {sent && (
          <div
            role="timer"
            className={`rounded-lg px-4 py-3 text-sm ${
              expired ? "bg-amber-50 text-amber-800" : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {expired ? (
              <p>That link has expired. Send a new one below.</p>
            ) : (
              <>
                <p>
                  The link expires in{" "}
                  <span className="font-semibold tabular-nums text-neutral-900">
                    {formatCountdown(expiresIn)}
                  </span>
                  .
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Sending a new link cancels the old one, so use the newest email.
                </p>
              </>
            )}
          </div>
        )}

        <button type="submit" disabled={pending || resendIn > 0}
          className="w-full rounded-lg bg-[#5b58d6] px-4 py-3 font-semibold text-white
                     transition hover:bg-[#4b48c4] disabled:opacity-60">
          {pending
            ? "Sending…"
            : !sent
              ? "Send reset link"
              : resendIn > 0
                ? `Resend in ${formatCountdown(resendIn)}`
                : "Send a new link"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link href="/staff/login" className="text-neutral-500 hover:underline">
          ← Back to sign in
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-neutral-400">
        Students: your password is your surname. Ask an administrator if you still cannot sign in.
      </p>
    </>
  );
}
