"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authEmailFor, normalizeAdmissionNo } from "@/lib/constants";
import { studentAuthPassword } from "@/lib/student-password";

export type LoginState = { error?: string };

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
