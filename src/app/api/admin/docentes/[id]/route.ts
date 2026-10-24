import { serverError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";
import { teacherUpdateSchema } from "@/lib/admin-schemas";

const teacherSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  _count: {
    select: { quizzes: true },
  },
} as const;

function serializeTeacher(teacher: {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  _count: { quizzes: number };
}) {
  return {
    id: teacher.id,
    nombre: teacher.name,
    email: teacher.email,
    createdAt: teacher.createdAt,
    quizzesCount: teacher._count.quizzes,
  };
}

function unauthorized() {
  return NextResponse.json({ error: "No autorizado" }, { status: 403 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();

    const { id } = await params;
    const teacher = await db.user.findUnique({ where: { id } });
    if (!teacher || teacher.role !== "TEACHER") {
      return NextResponse.json(
        { error: "Docente no encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const result = teacherUpdateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const { nombre, email } = result.data;

    const emailOwner = await db.user.findUnique({ where: { email } });
    if (emailOwner && emailOwner.id !== id) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 }
      );
    }

    const updated = await db.user.update({
      where: { id },
      data: { name: nombre, email },
      select: teacherSelect,
    });

    return NextResponse.json({ teacher: serializeTeacher(updated) });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 }
      );
    }
    return serverError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();

    const { id } = await params;
    const teacher = await db.user.findUnique({ where: { id } });
    if (!teacher || teacher.role !== "TEACHER") {
      return NextResponse.json(
        { error: "Docente no encontrado" },
        { status: 404 }
      );
    }

    await db.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
