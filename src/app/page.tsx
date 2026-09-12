import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";

export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "student") redirect("/exam");
  if (profile.role === "admin") redirect("/admin");
  redirect("/teacher");
}
