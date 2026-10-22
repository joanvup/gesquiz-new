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

    const { id } = await params;
    const quiz = await db.quiz.findUnique({
      where: { id },
      include: {
        attempts: {
          include: {
            student: { select: { id: true, name: true, email: true } },
            answers: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz no encontrado' }, { status: 404 });
    }

    if (user.role !== 'ADMIN' && quiz.teacherId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const url = new URL(request.url);
    const format = url.searchParams.get('format');

    if (format === 'csv') {
      const headers = [
        'Estudiante',
        'Email',
        'Intento',
        'Estado',
        'Nota Obtenida',
        'Puntaje Máximo',
        'Infracciones',
        'Fecha Inicio',
        'Fecha Envío',
      ];

      const rows = quiz.attempts.map((att) => {
        const started = att.startedAt ? new Date(att.startedAt).toISOString() : '';
        const submitted = att.submittedAt ? new Date(att.submittedAt).toISOString() : '';
        return [
          escapeCsv(att.student.name),
          escapeCsv(att.student.email),
          att.numeroAttempt,
          att.status,
          att.score ?? 0,
          quiz.puntajeMaximo,
          att.infractions,
          started,
          submitted,
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\r\n');
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="resultados-quiz-${id}.csv"`,
        },
      });
    }

    return NextResponse.json({ quiz, attempts: quiz.attempts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function escapeCsv(str: string | null | undefined): string {
  if (str == null) return '';
  const s = String(str);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
