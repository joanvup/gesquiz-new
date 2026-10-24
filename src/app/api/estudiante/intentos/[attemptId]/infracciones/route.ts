import { serverError } from "@/lib/api-error";
﻿import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { gradeQuestion } from '@/lib/scoring';
import crypto from 'crypto';

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
    const body = await request.json().catch(() => ({}));
    const { tipo, detalle } = body;

    const sessionToken = request.headers.get('x-attempt-session') || '';
    const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

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

    if (attempt.sessionTokenHash !== sessionTokenHash) {
      return NextResponse.json({
        error: 'Sesión duplicada detectada en otra pestaña o dispositivo',
        code: 'DUPLICATE_SESSION',
      }, { status: 409 });
    }

    if (attempt.status !== 'EN_CURSO') {
      return NextResponse.json({ error: 'El intento ya no está en curso' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || '';

    const newInfractionsCount = attempt.infractions + 1;
    const maxInfracciones = attempt.quiz.maxInfracciones;

    await db.auditEvent.create({
      data: {
        attemptId,
        userId: user.id,
        tipo: tipo || 'INFRACCION_VISIBILIDAD',
        detalle: detalle || `Infracción #${newInfractionsCount}`,
        ip,
        userAgent,
      },
    });

    let autoSubmitted = false;
    let newStatus = 'EN_CURSO';

    if (newInfractionsCount >= maxInfracciones) {
      autoSubmitted = true;
      newStatus = 'FINALIZADO_POR_INFRACCIONES';

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
      for (const q of questionsForScoring) {
        const ans = attempt.answers.find(a => a.questionId === q.id);
        const graded = gradeQuestion(q, ans ? { questionId: q.id, respuestaJson: ans.respuestaJson, respuestaTexto: ans.respuestaTexto } : null);
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

      await db.attempt.update({
        where: { id: attemptId },
        data: {
          infractions: newInfractionsCount,
          status: newStatus,
          score: totalScore,
          submittedAt: new Date(),
        },
      });

      await db.auditEvent.create({
        data: {
          attemptId,
          userId: user.id,
          tipo: 'AUTO_ENVIO_POR_INFRACCIONES',
          detalle: `Intento finalizado automáticamente por alcanzar ${maxInfracciones} infracciones.`,
          ip,
          userAgent,
        },
      });
    } else {
      await db.attempt.update({
        where: { id: attemptId },
        data: { infractions: newInfractionsCount },
      });
    }

    return NextResponse.json({
      success: true,
      infractions: newInfractionsCount,
      maxInfracciones,
      autoSubmitted,
      status: newStatus,
    });
  } catch (err) {
    return serverError(err);
  }
}
