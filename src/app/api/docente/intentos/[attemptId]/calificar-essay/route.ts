import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { attemptId } = await params;
    const attempt = await db.attempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: { include: { questions: true } },
        answers: true,
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: 'Intento no encontrado' }, { status: 404 });
    }

    if (user.role !== 'ADMIN' && attempt.quiz.teacherId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { questionId, puntuacion } = body;

    if (!questionId || typeof puntuacion !== 'number') {
      return NextResponse.json({ error: 'questionId y puntuacion requeridos' }, { status: 400 });
    }

    const question = attempt.quiz.questions.find((q) => q.id === questionId);
    if (!question) {
      return NextResponse.json({ error: 'Pregunta no encontrada en el quiz' }, { status: 404 });
    }

    if (puntuacion < 0 || puntuacion > question.defaultGrade) {
      return NextResponse.json({ error: `La puntuación debe estar entre 0 y ${question.defaultGrade}` }, { status: 400 });
    }

    const existingAnswer = attempt.answers.find((a) => a.questionId === questionId);
    if (existingAnswer) {
      await db.attemptAnswer.update({
        where: { id: existingAnswer.id },
        data: {
          puntuacion,
          esCorrecta: puntuacion >= question.defaultGrade * 0.99,
          calificadaManualmente: true,
        },
      });
    } else {
      await db.attemptAnswer.create({
        data: {
          attemptId,
          questionId,
          puntuacion,
          esCorrecta: puntuacion >= question.defaultGrade * 0.99,
          calificadaManualmente: true,
        },
      });
    }

    const allAnswers = await db.attemptAnswer.findMany({ where: { attemptId } });
    const totalScore = allAnswers.reduce((sum, a) => sum + (a.puntuacion || 0), 0);

    const updatedAttempt = await db.attempt.update({
      where: { id: attemptId },
      data: {
        score: totalScore,
        status: 'CALIFICADO',
      },
      include: { answers: true },
    });

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || '';

    await db.auditEvent.create({
      data: {
        attemptId,
        userId: user.id,
        tipo: 'CALIFICACION_ESSAY',
        detalle: `Calificación manual pregunta ${questionId}: ${puntuacion}`,
        ip,
        userAgent,
      },
    });

    return NextResponse.json({ success: true, attempt: updatedAttempt });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
