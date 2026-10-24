import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTeacherQuiz } from "@/lib/quiz-access";
import {
  buildQuestionWriteData,
  manualQuestionInputSchema,
} from "@/lib/question-write";
import { nextQuestionOrder, recalculateQuizScore } from "@/lib/quiz-total";

const MAX_QUESTIONS_PER_QUIZ = 500;

/** Lista las preguntas del quiz con sus opciones. */
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

    const quiz = await db.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        titulo: true,
        puntajeMaximo: true,
        questions: {
          include: { options: { orderBy: { orden: "asc" } } },
          orderBy: { orden: "asc" },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      questions: quiz.questions,
      puntajeMaximo: quiz.puntajeMaximo,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Crea una pregunta manual. */
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
    const parsed = manualQuestionInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const total = await db.question.count({ where: { quizId } });
    if (total >= MAX_QUESTIONS_PER_QUIZ) {
      return NextResponse.json(
        { error: `Un quiz no puede tener más de ${MAX_QUESTIONS_PER_QUIZ} preguntas` },
        { status: 400 }
      );
    }

    const data = buildQuestionWriteData(parsed.data);
    const orden = await nextQuestionOrder(quizId);

    const question = await db.question.create({
      data: {
        quizId,
        tipo: data.tipo,
        enunciadoHtml: data.enunciadoHtml,
        formato: data.formato,
        defaultGrade: data.defaultGrade,
        penalty: data.penalty,
        generalFeedbackHtml: data.generalFeedbackHtml,
        orden,
        noPuntua: data.noPuntua,
        datosJson: data.datosJson,
        options: { create: data.options },
      },
      include: { options: { orderBy: { orden: "asc" } } },
    });

    const puntajeMaximo = await recalculateQuizScore(quizId);

    return NextResponse.json({ success: true, question, puntajeMaximo });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
