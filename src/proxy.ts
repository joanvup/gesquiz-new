import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("session")?.value;

  // Proteger rutas de docente y estudiante
  if (pathname.startsWith("/docente") || pathname.startsWith("/estudiante")) {
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
  matcher: ["/docente/:path*", "/estudiante/:path*", "/login"],
};
