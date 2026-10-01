import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role, SchoolClass } from "@/lib/constants";

export type Profile = {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  class: SchoolClass | null;
};

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, username, full_name, role, class")
    .eq("id", user.id)
    .single();
  return (data as Profile) ?? null;
}

export async function requireStaff(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "teacher" && profile.role !== "admin") redirect("/");
  return profile;
}

export async function requireTeacher(): Promise<Profile> {
  const profile = await requireStaff();
  if (profile.role !== "teacher") redirect("/admin/reviews");
  return profile;
}

async function testAuthor(testId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("test")
    .select("created_by")
    .eq("id", testId)
    .single();
  return data?.created_by ?? null;
}

export async function requireTestOwner(testId: string): Promise<Profile> {
  const profile = await requireStaff();
  const author = await testAuthor(testId);
  if (!author) redirect("/teacher");
  if (profile.role === "admin") redirect(`/teacher/${testId}`);
  if (author !== profile.id) redirect("/teacher");
  return profile;
}

export async function requireTestViewer(testId: string): Promise<Profile> {
  const profile = await requireStaff();
  const author = await testAuthor(testId);
  if (!author) redirect("/teacher");
  if (author !== profile.id && profile.role !== "admin") redirect("/teacher");
  return profile;
}

export async function requireStudent(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "student") redirect("/teacher");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/staff/login");
  if (profile.role === "student") redirect("/exam");
  if (profile.role !== "admin") redirect("/teacher");
  return profile;
}
