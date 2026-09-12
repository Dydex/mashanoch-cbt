"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authEmailFor } from "@/lib/constants";

export type LoginState = { error?: string };

/**
 * STUDENT login only. Staff sign in at /staff/login with an email address and
 * a password they chose themselves — see the note in src/app/staff/login.
 *
 * Students log in with a school-issued ID and a PIN — no email.
 *
 * We look the username up with the service role (an anonymous visitor has no
 * RLS access to profiles, by design), derive the synthetic email from the
 * profile UUID, then hand the PIN to Supabase Auth for verification.
 *
 * We never confirm whether a username exists: a wrong ID and a wrong PIN return
 * exactly the same message, so nobody can enumerate valid student IDs.
 */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const pin = String(formData.get("pin") ?? "");

  if (!username || !pin) {
    return { error: "Enter your ID and PIN." };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("username", username)
    .maybeSingle();

  const generic = { error: "Incorrect ID or PIN." };
  if (!profile) return generic;

  // Staff must use the staff login. Same generic message either way, so this
  // box cannot be used to discover which IDs exist or what role they hold.
  if (profile.role !== "student") return generic;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: authEmailFor(profile.id),
    password: pin,
  });

  if (error) return generic;

  redirect("/exam");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
