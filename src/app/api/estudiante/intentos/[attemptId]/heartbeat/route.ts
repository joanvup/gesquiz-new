import { serverError } from "@/lib/api-error";
﻿import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
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
    const sessionToken = request.headers.get('x-attempt-session') || '';
    const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

    const attempt = await db.attempt.findUnique({
      where: { id: attemptId },
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
      return NextResponse.json({ success: true, status: attempt.status });
    }

    const now = new Date();
    if (attempt.expiresAt && new Date(attempt.expiresAt) < now) {
      await db.attempt.update({
        where: { id: attemptId },
        data: { status: 'EXPIRADO' },
      });
      return NextResponse.json({ success: false, status: 'EXPIRADO' });
    }

    await db.attempt.update({
      where: { id: attemptId },
      data: { lastActivityAt: now },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
