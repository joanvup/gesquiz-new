import { serverError } from "@/lib/api-error";
﻿import { NextResponse } from 'next/server';
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
      include: { quiz: true },
    });

    if (!attempt) {
      return NextResponse.json({ error: 'Intento no encontrado' }, { status: 404 });
    }

    if (user.role !== 'ADMIN' && attempt.quiz.teacherId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    let motivo = 'Intento anulado por docente';
    try {
      const body = await request.json();
      if (body?.motivo) motivo = body.motivo;
    } catch {}

    const updated = await db.attempt.update({
      where: { id: attemptId },
      data: {
        status: 'ANULADO',
        score: 0,
      },
    });

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || '';

    await db.auditEvent.create({
      data: {
        attemptId,
        userId: user.id,
        tipo: 'ANULACION',
        detalle: motivo,
        ip,
        userAgent,
      },
    });

    return NextResponse.json({ success: true, attempt: updated });
  } catch (err) {
    return serverError(err);
  }
}
