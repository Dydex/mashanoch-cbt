"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authEmailFor, normalizeAdmissionNo } from "@/lib/constants";
import { studentAuthPassword } from "@/lib/student-password";

export type LoginState = { error?: string };

/**
 * STUDENT login only. Staff sign in at /staff/login with an email address and
 * a password they chose themselves — see the note in src/app/staff/login.
 *
 * Students log in with their admission number, and their surname as the
 * password — no email. See src/lib/student-password.ts for how the surname
 * they type becomes what Supabase Auth checks.
 *
 * We look the admission number up (it is the profile's username) with the
 * service role, since an anonymous visitor has no RLS access to profiles, by
 * design. Then we derive the synthetic email from the profile UUID and hand
 * the password to Supabase Auth for verification.
 *
 * We never confirm whether a admission number exists: a wrong number and a wrong
 * password return exactly the same message, so nobody can enumerate valid ones.
 */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const admissionNo = normalizeAdmissionNo(String(formData.get("admissionNo") ?? ""));
  const surname = String(formData.get("password") ?? "");

  if (!admissionNo || !surname.trim()) {
    return { error: "Enter your admission number and password." };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("username", admissionNo)
    .maybeSingle();

  const generic = { error: "Incorrect admission number or password." };
  if (!profile) return generic;

  // Staff must use the staff login. Same generic message either way, so this
  // box cannot be used to discover which numbers exist or what role they hold.
  if (profile.role !== "student") return generic;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: authEmailFor(profile.id),
    password: studentAuthPassword(surname),
  });

  if (error) return generic;

  redirect("/exam");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
