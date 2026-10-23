import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/**
 * Verifica que el usuario autenticado sea docente (o admin) y dueno del quiz.
 * Devuelve una union discriminada para que las rutas respondan sin repetir
 * la logica de autorizacion.
 */
export async function getTeacherQuiz(quizId: string) {
  const user = await getSessionUser();
  if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) {
    return { ok: false as const, status: 403, error: "No autorizado" };
  }

  const quiz = await db.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) {
    return { ok: false as const, status: 404, error: "Quiz no encontrado" };
  }

  if (user.role !== "ADMIN" && quiz.teacherId !== user.id) {
    return { ok: false as const, status: 403, error: "No autorizado" };
  }

  return { ok: true as const, user, quiz };
}
