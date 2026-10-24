import { NextResponse } from "next/server";

/**
 * Respuesta 500 genérica: registra el error en el servidor pero no filtra
 * detalles internos (mensajes de Prisma, rutas de disco, etc.) al cliente.
 */
export function serverError(err: unknown, context?: string) {
  if (context) {
    console.error(`[api] ${context}`, err);
  } else {
    console.error("[api]", err);
  }

  return NextResponse.json(
    { error: "Error interno del servidor" },
    { status: 500 }
  );
}
