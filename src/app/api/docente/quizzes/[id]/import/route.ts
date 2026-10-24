import { serverError } from "@/lib/api-error";
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { parseMoodleXml } from '@/lib/moodle-xml/parser';

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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.xml')) {
      return NextResponse.json({ error: 'El archivo debe tener extensión .xml' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo excede el límite de 10MB' }, { status: 400 });
    }

    const parseResult = parseMoodleXml(buffer);

    await db.question.deleteMany({ where: { quizId } });

    let puntajeMaximo = 0;

    for (const pq of parseResult.questions) {
      if (!pq.noPuntua) {
        puntajeMaximo += pq.defaultGrade;
      }

      await db.question.create({
        data: {
          quizId,
          tipo: pq.tipo,
          enunciadoHtml: pq.enunciadoHtml,
          formato: pq.formato,
          defaultGrade: pq.defaultGrade,
          penalty: pq.penalty,
          generalFeedbackHtml: pq.generalFeedbackHtml,
          category: pq.category,
          orden: pq.orden,
          noPuntua: pq.noPuntua,
          datosJson: pq.datosJson,
          options: {
            create: pq.options.map((opt) => ({
              orden: opt.orden,
              textoHtml: opt.textoHtml,
              esCorrecta: opt.esCorrecta,
              fraction: opt.fraction,
              feedbackHtml: opt.feedbackHtml,
              extraJson: opt.extraJson,
            })),
          },
        },
      });
    }

    await db.quiz.update({
      where: { id: quizId },
      data: { puntajeMaximo },
    });

    await db.importBatch.create({
      data: {
        teacherId: user.id,
        quizId,
        fileName: file.name,
        reportJson: JSON.stringify(parseResult.report),
      },
    });

    return NextResponse.json({
      success: true,
      report: parseResult.report,
      puntajeMaximo,
    });
  } catch (err) {
    return serverError(err);
  }
}
