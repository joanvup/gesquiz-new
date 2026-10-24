import { serverError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { getTeacherQuiz } from "@/lib/quiz-access";
import { buildQuizExport } from "@/lib/quiz-transfer";

/** Descarga un quiz completo (configuracion + preguntas + imagenes) en JSON. */
export async function GET(
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

    const data = await buildQuizExport(quizId);
    const json = JSON.stringify(data, null, 2);

    const slug = (data.quiz.titulo || "quiz")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "quiz";

    const fileName = `${slug}.quiz.json`;

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return serverError(err);
  }
}
