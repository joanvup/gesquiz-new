import { db } from "@/lib/db";

/**
 * Recalcula `Quiz.puntajeMaximo` a partir de las preguntas que puntuan.
 * Se llama despues de cualquier cambio manual en las preguntas para que la
 * nota del estudiante y el panel del docente sigan cuadrando.
 */
export async function recalculateQuizScore(quizId: string): Promise<number> {
  const aggregate = await db.question.aggregate({
    where: { quizId, noPuntua: false },
    _sum: { defaultGrade: true },
  });

  const puntajeMaximo = Math.round((aggregate._sum.defaultGrade ?? 0) * 100) / 100;

  await db.quiz.update({
    where: { id: quizId },
    data: { puntajeMaximo },
  });

  return puntajeMaximo;
}

/** Siguiente numero de orden disponible para agregar preguntas. */
export async function nextQuestionOrder(quizId: string): Promise<number> {
  const last = await db.question.findFirst({
    where: { quizId },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });

  return (last?.orden ?? 0) + 1;
}

/** Normaliza el orden de las preguntas a 1..n. */
export async function normalizeQuestionOrder(quizId: string): Promise<void> {
  const questions = await db.question.findMany({
    where: { quizId },
    orderBy: { orden: "asc" },
    select: { id: true },
  });

  await db.$transaction(
    questions.map((question, index) =>
      db.question.update({
        where: { id: question.id },
        data: { orden: index + 1 },
      })
    )
  );
}
