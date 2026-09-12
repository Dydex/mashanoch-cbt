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

/** The signed-in user's profile, or null. Never throws. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  // getUser() revalidates the JWT with the auth server. Do not use getSession()
  // for authorisation — it trusts whatever cookie the browser sent.
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

/**
 * Guard for teacher/admin surfaces.
 *
 * Server Actions are reachable by direct POST, not only through our UI, so this
 * must be called inside every action — a guard on the page is not enough.
 */
export async function requireStaff(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "teacher" && profile.role !== "admin") redirect("/");
  return profile;
}

/**
 * Guard for writing tests. Teachers write tests and admins approve them; an
 * admin who could also edit a paper would be approving their own work. Admins
 * are sent to their review queue instead.
 */
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

/**
 * Confirms the caller may modify this test, then returns their profile.
 *
 * Mandatory before any service-role write: that client bypasses RLS, so the
 * database will NOT stop one teacher from editing another teacher's test.
 * This function is that check.
 *
 * Only the teacher who wrote the test passes. Admins are refused even on a
 * test they own (one inherited from a removed teacher, say): they review
 * papers, they never change them. See requireTeacher.
 */
export async function requireTestOwner(testId: string): Promise<Profile> {
  const profile = await requireStaff();
  const author = await testAuthor(testId);

  if (!author) redirect("/teacher");
  if (profile.role === "admin") redirect(`/teacher/${testId}`);
  if (author !== profile.id) redirect("/teacher");
  return profile;
}

/**
 * Confirms the caller may look at this test: the teacher who wrote it, or
 * any admin reviewing it. For pages only; every write goes through
 * requireTestOwner.
 */
export async function requireTestViewer(testId: string): Promise<Profile> {
  const profile = await requireStaff();
  const author = await testAuthor(testId);

  if (!author) redirect("/teacher");
  if (author !== profile.id && profile.role !== "admin") redirect("/teacher");
  return profile;
}

/** Guard for the student exam surfaces. */
export async function requireStudent(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "student") redirect("/teacher");
  return profile;
}

/** Guard for admin-only surfaces (account management). */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/staff/login");
  if (profile.role === "student") redirect("/exam");
  if (profile.role !== "admin") redirect("/teacher");
  return profile;
}
