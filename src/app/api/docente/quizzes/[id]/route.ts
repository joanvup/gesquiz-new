import { serverError } from "@/lib/api-error";
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { z } from 'zod';
import { deleteQuizImageFolder } from '@/lib/uploads';

const quizSchema = z.object({
  titulo: z.string().min(1, 'Título requerido'),
  descripcion: z.string().optional().nullable(),
  instrucciones: z.string().optional().nullable(),
  permitirRetroceso: z.boolean().default(true),
  advertirAlContinuar: z.boolean().default(false),
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
        questions: {
          include: { options: true },
          orderBy: { orden: 'asc' },
        },
        assignments: {
          include: {
            group: true,
            student: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz no encontrado' }, { status: 404 });
    }

    if (user.role !== 'ADMIN' && quiz.teacherId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    return NextResponse.json({ quiz });
  } catch (err) {
    return serverError(err);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.quiz.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Quiz no encontrado' }, { status: 404 });
    }
    if (user.role !== 'ADMIN' && existing.teacherId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = quizSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Datos inválidos';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const data = parsed.data;
    const updated = await db.quiz.update({
      where: { id },
      data: {
        titulo: data.titulo,
        descripcion: data.descripcion || null,
        instrucciones: data.instrucciones || null,
        permitirRetroceso: data.permitirRetroceso,
        advertirAlContinuar: data.advertirAlContinuar,
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

    return NextResponse.json({ success: true, quiz: updated });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.quiz.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Quiz no encontrado' }, { status: 404 });
    }
    if (user.role !== 'ADMIN' && existing.teacherId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await db.quiz.delete({ where: { id } });
    // Limpieza de las imagenes subidas para este quiz (best effort).
    await deleteQuizImageFolder(id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
