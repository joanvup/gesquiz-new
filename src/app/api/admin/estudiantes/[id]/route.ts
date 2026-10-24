import { serverError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";
import { studentUpdateSchema } from "@/lib/admin-schemas";

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();

    const { id } = await params;
    const student = await db.user.findUnique({ where: { id } });
    if (!student || student.role !== "STUDENT") {
      return NextResponse.json({ error: "Estudiante no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const result = studentUpdateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const { nombre, email, groupIds } = result.data;
    const uniqueGroupIds = Array.from(new Set(groupIds));

    const emailOwner = await db.user.findUnique({ where: { email } });
    if (emailOwner && emailOwner.id !== id) {
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

    const updated = await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { name: nombre, email },
      });

      await tx.groupMember.deleteMany({ where: { userId: id } });

      if (uniqueGroupIds.length > 0) {
        await tx.groupMember.createMany({
          data: uniqueGroupIds.map((groupId) => ({ groupId, userId: id })),
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id },
        select: studentSelect,
      });
    });

    return NextResponse.json({ student: serializeStudent(updated) });
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
    const student = await db.user.findUnique({ where: { id } });
    if (!student || student.role !== "STUDENT") {
      return NextResponse.json({ error: "Estudiante no encontrado" }, { status: 404 });
    }

    await db.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
