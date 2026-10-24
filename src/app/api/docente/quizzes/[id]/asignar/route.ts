import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { id: quizId } = await params;
    const assignments = await db.quizAssignment.findMany({
      where: { quizId },
      include: {
        group: true,
        student: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ assignments });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { id: quizId } = await params;
    const quiz = await db.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz no encontrado' }, { status: 404 });
    }
    if (user.role !== 'ADMIN' && quiz.teacherId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const groupIds = body.groupIds || [];
    const studentIds = body.studentIds || [];

    await db.quizAssignment.deleteMany({ where: { quizId } });

    const createData = [
      ...groupIds.map((groupId: string) => ({ quizId, groupId, studentId: null })),
      ...studentIds.map((studentId: string) => ({ quizId, studentId, groupId: null })),
    ];

    if (createData.length > 0) {
      await db.quizAssignment.createMany({
        data: createData,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
