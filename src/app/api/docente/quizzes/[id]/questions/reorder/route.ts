import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTeacherQuiz } from "@/lib/quiz-access";

const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

/** Guarda el nuevo orden de las preguntas (drag & drop). */
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

    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const ids = [...new Set(parsed.data.ids)];
    const questions = await db.question.findMany({
      where: { quizId },
      select: { id: true },
    });

    const existingIds = new Set(questions.map((question) => question.id));
    const unknown = ids.filter((id) => !existingIds.has(id));
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: "El orden incluye preguntas que no pertenecen a este quiz" },
        { status: 400 }
      );
    }

    // Las preguntas no incluidas en el payload conservan su posicion al final.
    const rest = questions
      .map((question) => question.id)
      .filter((id) => !ids.includes(id));
    const finalOrder = [...ids, ...rest];

    await db.$transaction(
      finalOrder.map((id, index) =>
        db.question.update({
          where: { id },
          data: { orden: index + 1 },
        })
      )
    );

    return NextResponse.json({ success: true, orden: finalOrder });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
