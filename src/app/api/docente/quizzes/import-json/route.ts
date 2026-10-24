import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  importQuizTransfer,
  MAX_TRANSFER_BYTES,
} from "@/lib/quiz-transfer";

/**
 * Crea un quiz nuevo a partir de un paquete JSON exportado.
 * El quiz se crea siempre como borrador (publicado = false).
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Selecciona un archivo .json exportado desde QuizColegio" },
        { status: 400 }
      );
    }

    if (file.size > MAX_TRANSFER_BYTES) {
      return NextResponse.json(
        { error: "El archivo supera el límite de 40 MB" },
        { status: 413 }
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      return NextResponse.json(
        { error: "El archivo no es un JSON válido" },
        { status: 400 }
      );
    }

    const report = await importQuizTransfer(raw, {
      teacherId: user.id,
      applyQuizConfig: true,
      replaceQuestions: false,
    });

    return NextResponse.json({ success: true, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
