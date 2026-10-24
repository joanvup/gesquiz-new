import { serverError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";
import { teacherCreateSchema } from "@/lib/admin-schemas";

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

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();

    const teachers = await db.user.findMany({
      where: { role: "TEACHER" },
      select: teacherSelect,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ teachers: teachers.map(serializeTeacher) });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();

    const body = await request.json();
    const result = teacherCreateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const { nombre, email, password } = result.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const teacher = await db.user.create({
      data: {
        name: nombre,
        email,
        passwordHash,
        role: "TEACHER",
      },
      select: teacherSelect,
    });

    return NextResponse.json(
      { teacher: serializeTeacher(teacher) },
      { status: 201 }
    );
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
