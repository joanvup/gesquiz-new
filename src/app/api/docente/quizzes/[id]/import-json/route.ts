import { NextResponse } from "next/server";
import { getTeacherQuiz } from "@/lib/quiz-access";
import { serverError } from "@/lib/api-error";
import {
  importQuizTransfer,
  MAX_TRANSFER_BYTES,
} from "@/lib/quiz-transfer";

/**
 * Importa un paquete JSON de quiz en un quiz existente.
 * Por defecto fusiona las preguntas al final y no toca la configuracion.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quizId } = await params;
    const access = await getTeacherQuiz(quizId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
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

    const applyQuizConfig = formData.get("aplicarConfiguracion") === "true";
    const replaceQuestions = formData.get("reemplazar") === "true";

    const report = await importQuizTransfer(raw, {
      teacherId: access.user.id,
      targetQuizId: quizId,
      applyQuizConfig,
      replaceQuestions,
    });

    return NextResponse.json({ success: true, report });
  } catch (err) {
    return serverError(err);
  }
}
