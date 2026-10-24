import { serverError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";
import { groupSchema } from "@/lib/admin-schemas";

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
    const group = await db.group.findUnique({ where: { id } });
    if (!group) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const result = groupSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const updated = await db.group.update({
      where: { id },
      data: { name: result.data.nombre },
    });

    return NextResponse.json({
      group: { id: updated.id, nombre: updated.name },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe un grupo con ese nombre" },
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
    const group = await db.group.findUnique({ where: { id } });
    if (!group) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    await db.group.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
