import { cookies } from "next/headers";
import crypto from "crypto";

export async function getOrCreateCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  let csrf = cookieStore.get("csrf")?.value;
  if (!csrf) {
    csrf = crypto.randomBytes(24).toString("hex");
    cookieStore.set({
      name: "csrf",
      value: csrf,
      httpOnly: false, // accesible por JS para poner en el header
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }
  return csrf;
}

export async function verifyCsrf(request: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const csrfCookie = cookieStore.get("csrf")?.value;
  const csrfHeader = request.headers.get("x-csrf-token");
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return false;
  }
  return true;
}
