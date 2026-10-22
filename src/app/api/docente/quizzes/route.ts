import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { z } from 'zod';

const quizSchema = z.object({
  titulo: z.string().min(1, 'Título requerido'),
  descripcion: z.string().optional().nullable(),
  instrucciones: z.string().optional().nullable(),
  permitirRetroceso: z.boolean().default(true),
  tiempoLimiteMinutos: z.number().int().positive().optional().nullable(),
  ordenAleatorioPreguntas: z.boolean().default(false),
  ordenAleatorioOpciones: z.boolean().default(false),
  intentosPermitidos: z.number().int().min(1).default(1),
  ventanaAbre: z.string().optional().nullable(),
  ventanaCierra: z.string().optional().nullable(),
  mostrarResultado: z.enum(['NOTA', 'NOTA_Y_RESPUESTAS', 'NADA']).default('NOTA'),
  modoSeguro: z.boolean().default(true),
  maxInfracciones: z.number().int().min(1).default(3),
  publicado: z.boolean().default(false),
});

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const where = user.role === 'ADMIN' ? {} : { teacherId: user.id };
    const quizzes = await db.quiz.findMany({
      where,
      include: {
        _count: {
          select: { questions: true, assignments: true, attempts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ quizzes });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = quizSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Datos inválidos';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const data = parsed.data;
    const quiz = await db.quiz.create({
      data: {
        teacherId: user.id,
        titulo: data.titulo,
        descripcion: data.descripcion || null,
        instrucciones: data.instrucciones || null,
        permitirRetroceso: data.permitirRetroceso,
        tiempoLimiteMinutos: data.tiempoLimiteMinutos || null,
        ordenAleatorioPreguntas: data.ordenAleatorioPreguntas,
        ordenAleatorioOpciones: data.ordenAleatorioOpciones,
        intentosPermitidos: data.intentosPermitidos,
        ventanaAbre: data.ventanaAbre ? new Date(data.ventanaAbre) : null,
        ventanaCierra: data.ventanaCierra ? new Date(data.ventanaCierra) : null,
        mostrarResultado: data.mostrarResultado,
        modoSeguro: data.modoSeguro,
        maxInfracciones: data.maxInfracciones,
        publicado: data.publicado,
      },
    });

    return NextResponse.json({ success: true, quiz });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
