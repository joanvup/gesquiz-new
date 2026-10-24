import { serverError } from "@/lib/api-error";
﻿import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { shuffleArray } from '@/lib/quiz-random';
import { getClientIp } from '@/lib/rate-limit';
import crypto from 'crypto';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'STUDENT' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { id: quizId } = await params;
    const quiz = await db.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: { options: true },
          orderBy: { orden: 'asc' },
        },
        assignments: {
          include: { group: { include: { members: true } } },
        },
      },
    });

    if (!quiz || !quiz.publicado) {
      return NextResponse.json({ error: 'Quiz no encontrado o no disponible' }, { status: 404 });
    }

    const now = new Date();
    if (quiz.ventanaAbre && now < new Date(quiz.ventanaAbre)) {
      return NextResponse.json({ error: 'El quiz aún no está abierto' }, { status: 403 });
    }
    if (quiz.ventanaCierra && now > new Date(quiz.ventanaCierra)) {
      return NextResponse.json({ error: 'El quiz ya ha cerrado' }, { status: 403 });
    }

    const isAssignedDirectly = quiz.assignments.some(a => a.studentId === user.id);
    const isAssignedGroup = quiz.assignments.some(a => a.group?.members.some(m => m.userId === user.id));
    if (!isAssignedDirectly && !isAssignedGroup && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Quiz no asignado al estudiante' }, { status: 403 });
    }

    const existingAttempts = await db.attempt.findMany({
      where: { quizId, studentId: user.id },
      orderBy: { numeroAttempt: 'desc' },
    });

    const activeAttempt = existingAttempts.find(a => a.status === 'EN_CURSO');
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || '';

    if (activeAttempt) {
      if (activeAttempt.expiresAt && new Date(activeAttempt.expiresAt) < now) {
        await db.attempt.update({
          where: { id: activeAttempt.id },
          data: { status: 'EXPIRADO' },
        });
      } else {
        const sessionToken = crypto.randomBytes(32).toString('hex');
        const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

        const updatedAttempt = await db.attempt.update({
          where: { id: activeAttempt.id },
          data: { sessionTokenHash },
        });

        return NextResponse.json({ success: true, attempt: updatedAttempt, sessionToken, resumed: true });
      }
    }

    const validAttemptsCount = existingAttempts.filter(a => a.status !== 'ANULADO').length;
    if (validAttemptsCount >= quiz.intentosPermitidos && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Número máximo de intentos alcanzados' }, { status: 400 });
    }

    const seed = crypto.randomBytes(16).toString('hex');
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

    let questionIds = quiz.questions.map(q => q.id);
    if (quiz.ordenAleatorioPreguntas) {
      questionIds = shuffleArray(questionIds, seed);
    }

    const optionOrders: Record<string, string[]> = {};
    for (const q of quiz.questions) {
      let optIds = q.options.map(o => o.id);
      if (quiz.ordenAleatorioOpciones) {
        optIds = shuffleArray(optIds, seed + q.id);
      }
      optionOrders[q.id] = optIds;
    }

    const expiresAt = quiz.tiempoLimiteMinutos
      ? new Date(Date.now() + quiz.tiempoLimiteMinutos * 60 * 1000)
      : null;

    const newAttempt = await db.attempt.create({
      data: {
        quizId,
        studentId: user.id,
        numeroAttempt: validAttemptsCount + 1,
        status: 'EN_CURSO',
        seed,
        sessionTokenHash,
        expiresAt,
        questionOrderJson: JSON.stringify(questionIds),
        optionOrderJson: JSON.stringify(optionOrders),
        currentQuestionIndex: 0,
      },
    });

    await db.auditEvent.create({
      data: {
        attemptId: newAttempt.id,
        userId: user.id,
        tipo: 'INICIO_INTENTO',
        detalle: `Inicio de intento #${newAttempt.numeroAttempt} para quiz ${quizId}`,
        ip,
        userAgent,
      },
    });

    return NextResponse.json({ success: true, attempt: newAttempt, sessionToken, resumed: false });
  } catch (err) {
    return serverError(err);
  }
}
