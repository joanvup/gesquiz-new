import crypto from "crypto";
import { NextResponse } from "next/server";

/**
 * Valida que la cabecera `x-attempt-session` coincida con el token hasheado
 * del intento. Si no coincide, el intento está abierto en otra pestaña o
 * dispositivo y la respuesta se bloquea.
 */
export async function requireAttemptSession(
  request: Request,
  attempt: { id: string; studentId: string; sessionTokenHash: string }
): Promise<
  | { ok: true; token: string }
  | { ok: false; response: NextResponse }
> {
  const token = request.headers.get("x-attempt-session") || "";
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  if (!token || tokenHash !== attempt.sessionTokenHash) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Sesión duplicada detectada en otra pestaña o dispositivo",
          code: "DUPLICATE_SESSION",
        },
        { status: 409 }
      ),
    };
  }

  return { ok: true, token };
}