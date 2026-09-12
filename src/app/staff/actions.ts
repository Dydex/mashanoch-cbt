"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StaffState = { error?: string; notice?: string };

/**
 * Staff sign in with a real email address and a password they chose
 * themselves, never a PIN. Teachers can read the answer key and admins can
 * create accounts, so those credentials must not be something printed on a
 * slip and typed in a room full of students.
 */
export async function staffLogin(
  _prev: StaffState,
  formData: FormData,
): Promise<StaffState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) return { error: "Incorrect email or password." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  // A student account should never be usable here, even if someone worked out
  // its synthetic email address.
  if (!profile || profile.role === "student") {
    await supabase.auth.signOut();
    return { error: "Incorrect email or password." };
  }

  redirect(profile.role === "admin" ? "/admin" : "/teacher");
}

/** Emails a reset link. Staff only — students have no email to send to. */
export async function requestPasswordReset(
  _prev: StaffState,
  formData: FormData,
): Promise<StaffState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "Enter your email address." };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/staff/set-password`,
  });

  // Always the same reply, so this cannot be used to test which staff
  // addresses exist.
  return {
    notice:
      "If that address belongs to a staff account, a reset link is on its way.",
  };
}

/**
 * Sets the password for whoever is currently signed in. Reached from an invite
 * or reset link, which /auth/callback has already exchanged for a session.
 */
export async function setPassword(
  _prev: StaffState,
  formData: FormData,
): Promise<StaffState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 10)
    return { error: "Use at least 10 characters." };
  if (password !== confirm) return { error: "The two passwords do not match." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "That link has expired. Ask for a new one." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  redirect(profile?.role === "admin" ? "/admin" : "/teacher");
}
