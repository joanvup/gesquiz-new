import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { requireAttemptSession } from "@/lib/attempt-session";
import { answerSaveSchema } from "@/lib/answer-schemas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { attemptId } = await params;
    const attempt = await db.attempt.findUnique({
      where: { id: attemptId },
      include: { quiz: { select: { id: true } } },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Intento no encontrado" }, { status: 404 });
    }

    if (attempt.studentId !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (attempt.status !== "EN_CURSO") {
      return NextResponse.json({ error: "El intento ya no está en curso" }, { status: 400 });
    }

    if (attempt.expiresAt && new Date(attempt.expiresAt) < new Date()) {
      return NextResponse.json({ error: "El tiempo límite ha expirado" }, { status: 400 });
    }

    // Sesión única del intento: impide responder desde otra pestaña/dispositivo.
    const session = await requireAttemptSession(request, attempt);
    if (!session.ok) return session.response;

    const body = await request.json();
    const parsed = answerSaveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const { questionId, respuestaJson, respuestaTexto } = parsed.data;

    // La pregunta debe pertenecer al intento (evita response pollution).
    const question = await db.question.findUnique({
      where: { id: questionId },
      select: { id: true, quizId: true },
    });

    if (!question || question.quizId !== attempt.quiz.id) {
      return NextResponse.json({ error: "Pregunta no válida para este intento" }, { status: 400 });
    }

    const answer = await db.attemptAnswer.upsert({
      where: {
        attemptId_questionId: {
          attemptId,
          questionId,
        },
      },
      update: {
        respuestaJson: respuestaJson !== undefined ? respuestaJson : undefined,
        respuestaTexto: respuestaTexto !== undefined ? respuestaTexto : undefined,
      },
      create: {
        attemptId,
        questionId,
        respuestaJson: respuestaJson || null,
        respuestaTexto: respuestaTexto || null,
      },
    });

    await db.attempt.update({
      where: { id: attemptId },
      data: { lastActivityAt: new Date() },
    });

    return NextResponse.json({ success: true, answer });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}