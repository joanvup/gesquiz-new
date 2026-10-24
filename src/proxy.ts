import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/csrf";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSRF: toda petición mutante debe provenir del mismo origen.
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json(
        { error: "Origen no permitido" },
        { status: 403 }
      );
    }
  }

  const sessionCookie = request.cookies.get("session")?.value;

  // Proteger rutas de admin, docente y estudiante
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/docente") ||
    pathname.startsWith("/estudiante")
  ) {
    if (!sessionCookie) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Si ya tiene sesion y va a login, redirigir segun cookie o dejar pasar (la pagina decide)
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/docente/:path*",
    "/estudiante/:path*",
    "/login",
    "/api/:path*",
  ],
};
