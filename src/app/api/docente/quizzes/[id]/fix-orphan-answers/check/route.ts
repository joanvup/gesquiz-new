import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTeacherQuiz } from "@/lib/quiz-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quizId } = await params;
    const access = await getTeacherQuiz(quizId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const questions = await db.question.findMany({
      where: { quizId },
      select: { id: true },
    });
    const questionIds = questions.map((q) => q.id);

    const allOptions = await db.answerOption.findMany({
      where: { questionId: { in: questionIds } },
      select: { id: true, questionId: true },
    });

    const optionById = new Set(allOptions.map((o) => o.id));

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

    let orphanedAnswers = 0;
    let totalOrphanedIds = 0;

    for (const ans of answers) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(ans.respuestaJson!);
      } catch {
        continue;
      }

      if (!Array.isArray(parsed)) continue;

      const optionIds: string[] = parsed.map(String);

      for (const oldId of optionIds) {
        if (!optionById.has(oldId)) {
          totalOrphanedIds++;
          break; // contar respuesta una sola vez
        }
      }
      if (optionIds.some((id) => !optionById.has(id))) {
        orphanedAnswers++;
      }
    }

    return NextResponse.json({
      success: true,
      hasOrphans: orphanedAnswers > 0,
      orphanedAnswers,
      totalOrphanedIds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}