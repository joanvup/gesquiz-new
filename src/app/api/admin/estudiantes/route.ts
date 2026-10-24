import { serverError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";
import { studentCreateSchema } from "@/lib/admin-schemas";

const studentSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  memberships: {
    select: {
      group: {
        select: { id: true, name: true },
      },
    },
  },
} as const;

function serializeStudent(student: {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  memberships: { group: { id: string; name: string } }[];
}) {
  return {
    id: student.id,
    nombre: student.name,
    email: student.email,
    createdAt: student.createdAt,
    groups: student.memberships.map((membership) => membership.group),
  };
}

function unauthorized() {
  return NextResponse.json({ error: "No autorizado" }, { status: 403 });
}

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();

    const students = await db.user.findMany({
      where: { role: "STUDENT" },
      select: studentSelect,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ students: students.map(serializeStudent) });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();

    const body = await request.json();
    const result = studentCreateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const { nombre, email, password, groupIds } = result.data;
    const uniqueGroupIds = Array.from(new Set(groupIds));

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 }
      );
    }

    if (uniqueGroupIds.length > 0) {
      const groupCount = await db.group.count({
        where: { id: { in: uniqueGroupIds } },
      });
      if (groupCount !== uniqueGroupIds.length) {
        return NextResponse.json(
          { error: "Uno o más grupos seleccionados no existen" },
          { status: 400 }
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const student = await db.user.create({
      data: {
        name: nombre,
        email,
        passwordHash,
        role: "STUDENT",
        memberships: {
          create: uniqueGroupIds.map((groupId) => ({ groupId })),
        },
      },
      select: studentSelect,
    });

    return NextResponse.json({ student: serializeStudent(student) }, { status: 201 });
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
