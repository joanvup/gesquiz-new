import { serverError } from "@/lib/api-error";
﻿import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { toGradeScale } from '@/lib/grades';

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

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'QuizColegio';

      const sheet = workbook.addWorksheet('Resultados');
      sheet.columns = [
        { header: 'Estudiante', key: 'student', width: 30 },
        { header: 'Email', key: 'email', width: 36 },
        { header: 'Intento', key: 'attempt', width: 10 },
        { header: 'Estado', key: 'status', width: 16 },
        { header: 'Puntaje Obtenido', key: 'score', width: 18 },
        { header: 'Puntaje Máximo', key: 'maxScore', width: 18 },
        { header: 'Nota (10-100)', key: 'grade', width: 16 },
        { header: 'Infracciones', key: 'infractions', width: 14 },
        { header: 'Fecha Inicio', key: 'startedAt', width: 22 },
        { header: 'Fecha Envío', key: 'submittedAt', width: 22 },
      ];
      sheet.getRow(1).font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' },
      };
      sheet.getRow(1).alignment = {
        vertical: 'middle',
        horizontal: 'center',
      };
      sheet.getRow(1).height = 22;
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = { from: 'A1', to: 'J1' };

      for (const att of quiz.attempts) {
        const row = sheet.addRow({
          student: att.student.name,
          email: att.student.email,
          attempt: att.numeroAttempt,
          status: att.status,
          score: att.score ?? null,
          maxScore: quiz.puntajeMaximo,
          grade: toGradeScale(att.score, quiz.puntajeMaximo),
          infractions: att.infractions,
          startedAt: att.startedAt ? new Date(att.startedAt) : null,
          submittedAt: att.submittedAt ? new Date(att.submittedAt) : null,
        });

        row.getCell('attempt').alignment = { horizontal: 'center' };
        row.getCell('status').alignment = { horizontal: 'center' };
        row.getCell('score').alignment = { horizontal: 'center' };
        row.getCell('maxScore').alignment = { horizontal: 'center' };
        row.getCell('grade').alignment = { horizontal: 'center' };
        row.getCell('infractions').alignment = { horizontal: 'center' };
        row.getCell('score').numFmt = '0.##';
        row.getCell('maxScore').numFmt = '0.##';
        row.getCell('grade').numFmt = '0';
        row.getCell('grade').font = { bold: true };
        row.getCell('startedAt').numFmt = 'dd/mm/yyyy hh:mm';
        row.getCell('submittedAt').numFmt = 'dd/mm/yyyy hh:mm';
      }

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="resultados-quiz-${id}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (format === 'csv') {
      const headers = [
        'Estudiante',
        'Email',
        'Intento',
        'Estado',
        'Puntaje Obtenido',
        'Puntaje Máximo',
        'Nota (10-100)',
        'Infracciones',
        'Fecha Inicio',
        'Fecha Envío',
      ];

      const rows = quiz.attempts.map((att) => {
        const started = att.startedAt ? new Date(att.startedAt).toISOString() : '';
        const submitted = att.submittedAt ? new Date(att.submittedAt).toISOString() : '';
        const grade = toGradeScale(att.score, quiz.puntajeMaximo);
        return [
          escapeCsv(att.student.name),
          escapeCsv(att.student.email),
          att.numeroAttempt,
          att.status,
          att.score ?? '',
          quiz.puntajeMaximo,
          grade ?? '',
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
    return serverError(err);
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
