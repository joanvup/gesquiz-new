/**
 * Protección CSRF para rutas mutantes.
 *
 * Se valida el `Origin` de la petición contra el `Host` de destino. Los
 * navegadores envían `Origin` en POST/PUT/PATCH/DELETE, incluidos los fetch
 * same-origin, por lo que un sitio externo no puede falsificar la cabecera.
 *
 * Si no hay `Origin` (curl, tests, server-to-server) se usa `Sec-Fetch-Site`
 * como respaldo. Un cliente sin cookie de sesión no puede explotar CSRF, así
 * que permitir peticiones sin `Origin` no abre un vector real.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (!origin) {
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") {
      return false;
    }
    return true;
  }

  try {
    const originUrl = new URL(origin);
    return Boolean(host) && originUrl.host === host;
  } catch {
    return false;
  }
}

/** Alias mantenido para las rutas que ya lo importaban. */
export async function verifyCsrf(request: Request): Promise<boolean> {
  return isSameOriginRequest(request);
}
