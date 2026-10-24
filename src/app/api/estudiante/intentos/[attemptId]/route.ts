import { serverError } from "@/lib/api-error";
﻿import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { gradeQuestion } from '@/lib/scoring';

export async function GET(
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
              orderBy: { orden: 'asc' },
            },
          },
        },
        answers: true,
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: 'Intento no encontrado' }, { status: 404 });
    }

    const isOwner = attempt.studentId === user.id;
    const isAdmin = user.role === 'ADMIN';
    // Un docente solo puede ver intentos de SUS quizzes (no de otros docentes).
    const isTeacherOwner = user.role === 'TEACHER' && attempt.quiz.teacherId === user.id;

    if (!isOwner && !isAdmin && !isTeacherOwner) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const now = new Date();
    if (attempt.status === 'EN_CURSO' && attempt.expiresAt && new Date(attempt.expiresAt) < now) {
      const questionsForScoring = attempt.quiz.questions.map(q => ({
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
      for (const q of questionsForScoring) {
        const ans = attempt.answers.find(a => a.questionId === q.id);
        const graded = gradeQuestion(q, ans ? { questionId: q.id, respuestaJson: ans.respuestaJson, respuestaTexto: ans.respuestaTexto } : null);
        totalScore += graded.puntuacion;

        await db.attemptAnswer.updateMany({
          where: { attemptId: attempt.id, questionId: q.id },
          data: {
            puntuacion: graded.puntuacion,
            esCorrecta: graded.esCorrecta,
            calificadaManualmente: graded.calificadaManualmente,
          },
        });
      }

      const updated = await db.attempt.update({
        where: { id: attempt.id },
        data: {
          status: 'EXPIRADO',
          score: totalScore,
          submittedAt: now,
        },
        include: { answers: true, quiz: { include: { questions: { include: { options: true } } } } },
      });

      return NextResponse.json({ success: true, attempt: updated });
    }

    return NextResponse.json({ success: true, attempt });
  } catch (err) {
    return serverError(err);
  }
}
