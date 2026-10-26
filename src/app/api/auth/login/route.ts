import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
});

/** Errores de Prisma (P1xxx / P2024) y del pool de mariadb que indican BD no disponible. */
function isDatabaseUnavailable(err: unknown): boolean {
  return collectErrorCodes(err).some((code) => {
    if (typeof code === "number") return code === 45028; // ER_GET_CONNECTION_TIMEOUT
    if (typeof code !== "string") return false;
    return (
      code === "ECONNREFUSED" ||
      code === "ECONNRESET" ||
      code === "ETIMEDOUT" ||
      code === "ENOTFOUND" ||
      code === "ER_ACCESS_DENIED_ERROR" ||
      code === "ER_CANNOT_RETRIEVE_RSA_KEY" ||
      code === "ER_GET_CONNECTION_TIMEOUT" ||
      code === "P2024" || // Prisma: timeout obteniendo conexión del pool
      code.startsWith("P1")
    );
  });
}

/** Recorre la cadena de `cause` para no perder el error real del driver. */
function collectErrorCodes(err: unknown, depth = 0): unknown[] {
  if (!err || typeof err !== "object" || depth > 3) return [];
  const error = err as { code?: unknown; cause?: unknown };
  return [error.code, ...collectErrorCodes(error.cause, depth + 1)];
}

/**
 * El detalle real de un fallo de conexión queda en `err.cause`, que el driver
 * de mariadb no incluye en el mensaje. Se registra en el log del servidor
 * (PM2) sin exponerlo al navegador.
 */
function logLoginFailure(err: unknown) {
  const error = err as
    | { code?: unknown; cause?: { code?: unknown; message?: unknown } | null }
    | null
    | undefined;

  console.error("[auth/login] fallo al procesar el inicio de sesión", {
    code: error?.code,
    message: err instanceof Error ? err.message : String(err),
    causeCode: error?.cause?.code,
    causeMessage: error?.cause?.message,
  });
  console.error(err);
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      const message = result.error.issues[0]?.message || "Datos inválidos";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { email, password } = result.data;
    const rateKey = `${ip}:${email}`;
    if (!checkRateLimit(rateKey, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Demasiados intentos de acceso. Intente en 15 minutos." },
        { status: 429 }
      );
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    await createSession(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err: unknown) {
    logLoginFailure(err);

    if (isDatabaseUnavailable(err)) {
      return NextResponse.json(
        {
          error:
            "Servicio no disponible temporalmente. Intente de nuevo en unos minutos.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "No se pudo iniciar sesión. Intente de nuevo." },
      { status: 500 }
    );
  }
}
