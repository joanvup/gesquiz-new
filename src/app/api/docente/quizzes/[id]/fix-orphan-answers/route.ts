import { serverError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTeacherQuiz } from "@/lib/quiz-access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quizId } = await params;
    const access = await getTeacherQuiz(quizId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Obtener todas las opciones actuales de este quiz
    const questions = await db.question.findMany({
      where: { quizId },
      select: { id: true },
    });
    const questionIds = questions.map((q) => q.id);

    const allOptions = await db.answerOption.findMany({
      where: { questionId: { in: questionIds } },
      select: { id: true, questionId: true, textoHtml: true },
    });

    const optionById = new Map(allOptions.map((o) => [o.id, o]));
    const optionsByQuestion = new Map<string, typeof allOptions>();
    for (const o of allOptions) {
      const arr = optionsByQuestion.get(o.questionId) || [];
      arr.push(o);
      optionsByQuestion.set(o.questionId, arr);
    }

    // Buscar respuestas de este quiz con respuestaJson
    const answers = await db.attemptAnswer.findMany({
      where: {
        questionId: { in: questionIds },
        respuestaJson: { not: null },
      },
      select: {
        id: true,
        questionId: true,
        respuestaJson: true,
      },
    });

    let totalFixed = 0;
    let totalOrphaned = 0;

    for (const ans of answers) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(ans.respuestaJson!);
      } catch {
        continue;
      }

      if (!Array.isArray(parsed)) continue;

      const optionIds: string[] = parsed.map(String);
      const questionOptions = optionsByQuestion.get(ans.questionId) || [];

      const newIds: string[] = [];
      let hasChanges = false;

      for (const oldId of optionIds) {
        if (optionById.has(oldId)) {
          newIds.push(oldId);
          continue;
        }
        totalOrphaned++;

        // Si la pregunta tiene exactamente 1 opción ahora, usamos esa (match único)
        if (questionOptions.length === 1) {
          newIds.push(questionOptions[0].id);
          hasChanges = true;
        } else {
          // No podemos determinar cuál era → mantenemos el ID huérfano (no se puede reparar auto)
          newIds.push(oldId);
        }
      }

      if (hasChanges) {
        await db.attemptAnswer.update({
          where: { id: ans.id },
          data: { respuestaJson: JSON.stringify(newIds) },
        });
        totalFixed++;
      }
    }

    return NextResponse.json({
      success: true,
      quizId,
      processed: answers.length,
      orphanedIds: totalOrphaned,
      fixed: totalFixed,
    });
  } catch (err) {
    return serverError(err);
  }
}