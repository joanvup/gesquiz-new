import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export async function getAdminUser() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function requireAdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") {
    redirect(user.role === "TEACHER" ? "/docente" : "/estudiante");
  }
  return user;
}
