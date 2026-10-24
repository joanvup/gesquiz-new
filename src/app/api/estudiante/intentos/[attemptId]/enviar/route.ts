import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { gradeQuestion } from '@/lib/scoring';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { attemptId } = await params;
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

    if (attempt.status !== 'EN_CURSO' && attempt.status !== 'EXPIRADO') {
      return NextResponse.json({ error: 'El intento ya fue enviado o finalizado' }, { status: 400 });
    }

    const quiz = attempt.quiz;
    const questionsForScoring = quiz.questions.map(q => ({
      id: q.id,
      tipo: q.tipo,
      defaultGrade: q.defaultGrade,
      penalty: q.penalty,
      noPuntua: q.noPuntua,
      options: q.options.map(o => ({
        id: o.id,
        textoHtml: o.textoHtml,
        esCorrecta: o.esCorrecta,
        fraction: o.fraction,
        extraJson: o.extraJson,
      })),
    }));

    let totalScore = 0;
    let hasManual = false;

    for (const q of questionsForScoring) {
      const ans = attempt.answers.find(a => a.questionId === q.id);
      const graded = gradeQuestion(q, ans ? { questionId: q.id, respuestaJson: ans.respuestaJson, respuestaTexto: ans.respuestaTexto } : null);
      if (graded.calificadaManualmente) hasManual = true;
      totalScore += graded.puntuacion;

      await db.attemptAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId,
            questionId: q.id,
          },
        },
        update: {
          puntuacion: graded.puntuacion,
          esCorrecta: graded.esCorrecta,
          calificadaManualmente: graded.calificadaManualmente,
        },
        create: {
          attemptId,
          questionId: q.id,
          puntuacion: graded.puntuacion,
          esCorrecta: graded.esCorrecta,
          calificadaManualmente: graded.calificadaManualmente,
        },
      });
    }

    const newStatus = hasManual ? 'ENVIADO' : 'CALIFICADO';
    const updatedAttempt = await db.attempt.update({
      where: { id: attemptId },
      data: {
        status: newStatus,
        score: totalScore,
        submittedAt: new Date(),
      },
      include: {
        answers: true,
        quiz: {
          include: {
            questions: {
              include: { options: true },
            },
          },
        },
      },
    });

    const responseData: Record<string, unknown> = {
      success: true,
      status: updatedAttempt.status,
      mostrarResultado: quiz.mostrarResultado,
    };

    if (quiz.mostrarResultado === 'NOTA') {
      responseData.score = updatedAttempt.score;
      responseData.puntajeMaximo = quiz.puntajeMaximo;
    } else if (quiz.mostrarResultado === 'NOTA_Y_RESPUESTAS') {
      responseData.score = updatedAttempt.score;
      responseData.puntajeMaximo = quiz.puntajeMaximo;
      responseData.answers = updatedAttempt.answers;
      responseData.questions = quiz.questions.map(q => ({
        id: q.id,
        enunciadoHtml: q.enunciadoHtml,
        tipo: q.tipo,
        defaultGrade: q.defaultGrade,
        options: q.options.map(o => ({
          id: o.id,
          textoHtml: o.textoHtml,
          esCorrecta: o.esCorrecta,
          fraction: o.fraction,
        })),
      }));
    }

    return NextResponse.json(responseData);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
