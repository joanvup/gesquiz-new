import { serverError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
    }

    // Cargar todas las opciones actuales indexadas por ID y por texto normalizado
    const allOptions = await db.answerOption.findMany({
      select: { id: true, questionId: true, textoHtml: true },
    });

    const optionById = new Map(allOptions.map((o) => [o.id, o]));
    const optionsByQuestion = new Map<string, typeof allOptions>();
    for (const o of allOptions) {
      const arr = optionsByQuestion.get(o.questionId) || [];
      arr.push(o);
      optionsByQuestion.set(o.questionId, arr);
    }

    // Buscar todas las respuestas que tengan respuestaJson (array de IDs)
    const answers = await db.attemptAnswer.findMany({
      where: { respuestaJson: { not: null } },
      select: {
        id: true,
        questionId: true,
        respuestaJson: true,
        attempt: { select: { quizId: true } },
      },
    });

    let totalFixed = 0;
    let totalOrphaned = 0;
    const problems: Array<{
      answerId: string;
      questionId: string;
      orphanIds: string[];
      reason: string;
    }> = [];

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
      const orphanIds: string[] = [];

      for (const oldId of optionIds) {
        if (optionById.has(oldId)) {
          newIds.push(oldId);
          continue;
        }
        totalOrphaned++;

        // Si la pregunta tiene exactamente 1 opción ahora, usamos esa (match único)
        if (questionOptions.length === 1) {
          newIds.push(questionOptions[0].id);
        } else {
          // No podemos determinar cuál era → huérfano real
          orphanIds.push(oldId);
        }
      }

      if (orphanIds.length > 0) {
        problems.push({
          answerId: ans.id,
          questionId: ans.questionId,
          orphanIds,
          reason:
            orphanIds.length === optionIds.length
              ? "Todas las opciones huérfanas; no hay match único"
              : `${orphanIds.length} de ${optionIds.length} huérfanas`,
        });
      } else if (JSON.stringify(newIds) !== JSON.stringify(optionIds)) {
        // Hubo cambios: actualizar
        await db.attemptAnswer.update({
          where: { id: ans.id },
          data: { respuestaJson: JSON.stringify(newIds) },
        });
        totalFixed++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: answers.length,
      orphanedIds: totalOrphaned,
      fixed: totalFixed,
      unresolved: problems.length,
      problems: problems.slice(0, 50), // limitar output
    });
  } catch (err) {
    return serverError(err);
  }
}