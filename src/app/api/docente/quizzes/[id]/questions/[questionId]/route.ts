import { serverError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTeacherQuiz } from "@/lib/quiz-access";
import {
  buildGenericQuestionUpdate,
  buildQuestionWriteData,
  genericQuestionUpdateSchema,
  manualQuestionInputSchema,
} from "@/lib/question-write";
import { isManualEditableDbType } from "@/lib/question-types";
import {
  normalizeQuestionOrder,
  recalculateQuizScore,
} from "@/lib/quiz-total";

/** Actualiza una pregunta (completa si es manual, parcial si fue importada). */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const { id: quizId, questionId } = await params;
    const access = await getTeacherQuiz(quizId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const existing = await db.question.findUnique({
      where: { id: questionId },
      include: { options: true },
    });
    if (!existing || existing.quizId !== quizId) {
      return NextResponse.json(
        { error: "Pregunta no encontrada" },
        { status: 404 }
      );
    }

    // Bloquear edición si el quiz ya tiene intentos (cambiaría IDs de opciones
    // y rompería las respuestas ya enviadas).
    const attempts = await db.attempt.count({ where: { quizId } });
    if (attempts > 0) {
      return NextResponse.json(
        {
          error:
            "No se puede editar la pregunta porque el quiz ya tiene intentos registrados. " +
            "Duplica el quiz o crea uno nuevo para modificar su contenido.",
        },
        { status: 409 }
      );
    }

    const body = await request.json();

    if (isManualEditableDbType(existing.tipo)) {
      const parsed = manualQuestionInputSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Datos inválidos" },
          { status: 400 }
        );
      }

      const data = buildQuestionWriteData(parsed.data);
      const question = await db.question.update({
        where: { id: questionId },
        data: {
          tipo: data.tipo,
          enunciadoHtml: data.enunciadoHtml,
          formato: data.formato,
          defaultGrade: data.defaultGrade,
          penalty: data.penalty,
          generalFeedbackHtml: data.generalFeedbackHtml,
          noPuntua: data.noPuntua,
          datosJson: data.datosJson,
          options: {
            deleteMany: {},
            create: data.options,
          },
        },
        include: { options: { orderBy: { orden: "asc" } } },
      });

      const puntajeMaximo = await recalculateQuizScore(quizId);
      return NextResponse.json({ success: true, question, puntajeMaximo });
    }

    // Preguntas importadas desde Moodle (emparejamiento, numérica...): se
    // conservan sus opciones y solo se edita el contenido general.
    const parsed = genericQuestionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const question = await db.question.update({
      where: { id: questionId },
      data: buildGenericQuestionUpdate(parsed.data),
      include: { options: { orderBy: { orden: "asc" } } },
    });

    const puntajeMaximo = await recalculateQuizScore(quizId);
    return NextResponse.json({ success: true, question, puntajeMaximo });
  } catch (err) {
    return serverError(err);
  }
}

/** Elimina una pregunta. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const { id: quizId, questionId } = await params;
    const access = await getTeacherQuiz(quizId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const existing = await db.question.findUnique({
      where: { id: questionId },
      select: { id: true, quizId: true },
    });
    if (!existing || existing.quizId !== quizId) {
      return NextResponse.json(
        { error: "Pregunta no encontrada" },
        { status: 404 }
      );
    }

    // Borrar una pregunta elimina en cascada las respuestas de intentos
    // anteriores; se evita cuando ya existen intentos registrados.
    const attempts = await db.attempt.count({ where: { quizId } });
    if (attempts > 0) {
      return NextResponse.json(
        {
          error:
            "No se puede eliminar la pregunta porque el quiz ya tiene intentos registrados. " +
            "Duplica el quiz o crea uno nuevo para modificar su contenido.",
        },
        { status: 409 }
      );
    }

    await db.question.delete({ where: { id: questionId } });
    await normalizeQuestionOrder(quizId);
    const puntajeMaximo = await recalculateQuizScore(quizId);

    return NextResponse.json({ success: true, puntajeMaximo });
  } catch (err) {
    return serverError(err);
  }
}
