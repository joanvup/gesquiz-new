import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ attemptId: string; index: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { attemptId, index: indexStr } = await params;
    const requestedIndex = parseInt(indexStr, 10);
    if (isNaN(requestedIndex) || requestedIndex < 0) {
      return NextResponse.json({ error: 'Índice inválido' }, { status: 400 });
    }

    const attempt = await db.attempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          include: {
            questions: {
              include: { options: true },
            },
          },
        },
        answers: true,
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: 'Intento no encontrado' }, { status: 404 });
    }

    if (attempt.studentId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (attempt.status !== 'EN_CURSO') {
      return NextResponse.json({ error: 'El intento ya no está en curso' }, { status: 400 });
    }

    if (attempt.expiresAt && new Date(attempt.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'El tiempo límite ha expirado' }, { status: 400 });
    }

    const quiz = attempt.quiz;
    if (!quiz.permitirRetroceso && requestedIndex < attempt.currentQuestionIndex) {
      return NextResponse.json({ error: 'Retroceso no permitido en este quiz' }, { status: 403 });
    }

    let questionIds: string[] = [];
    try {
      if (attempt.questionOrderJson) {
        questionIds = JSON.parse(attempt.questionOrderJson);
      }
    } catch {}

    if (questionIds.length === 0) {
      questionIds = quiz.questions.map(q => q.id);
    }

    if (requestedIndex >= questionIds.length) {
      return NextResponse.json({ error: 'Pregunta fuera de rango' }, { status: 404 });
    }

    const qId = questionIds[requestedIndex];
    const question = quiz.questions.find(q => q.id === qId);
    if (!question) {
      return NextResponse.json({ error: 'Pregunta no encontrada' }, { status: 404 });
    }

    let optionOrder: string[] = [];
    try {
      if (attempt.optionOrderJson) {
        const optionOrders = JSON.parse(attempt.optionOrderJson);
        if (optionOrders[question.id]) {
          optionOrder = optionOrders[question.id];
        }
      }
    } catch {}

    if (optionOrder.length === 0) {
      optionOrder = question.options.map(o => o.id);
    }

    const orderedOptions = optionOrder
      .map(id => question.options.find(o => o.id === id))
      .filter(Boolean)
      .map(o => ({
        id: o!.id,
        textoHtml: o!.textoHtml,
        orden: o!.orden,
        extraJson: o!.extraJson,
      }));

    if (requestedIndex > attempt.currentQuestionIndex) {
      await db.attempt.update({
        where: { id: attemptId },
        data: { currentQuestionIndex: requestedIndex },
      });
    }

    const existingAnswer = attempt.answers.find(a => a.questionId === question.id);

    return NextResponse.json({
      success: true,
      index: requestedIndex,
      totalQuestions: questionIds.length,
      question: {
        id: question.id,
        tipo: question.tipo,
        enunciadoHtml: question.enunciadoHtml,
        defaultGrade: question.defaultGrade,
        options: orderedOptions,
      },
      answer: existingAnswer ? {
        respuestaJson: existingAnswer.respuestaJson,
        respuestaTexto: existingAnswer.respuestaTexto,
      } : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
