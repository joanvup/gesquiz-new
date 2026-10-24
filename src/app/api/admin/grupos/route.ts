import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";
import { groupSchema } from "@/lib/admin-schemas";

function unauthorized() {
  return NextResponse.json({ error: "No autorizado" }, { status: 403 });
}

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();

    const groups = await db.group.findMany({
      include: {
        members: {
          select: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      groups: groups.map((group) => ({
        id: group.id,
        nombre: group.name,
        createdAt: group.createdAt,
        memberCount: group._count.members,
        members: group.members.map((member) => member.user),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();

    const body = await request.json();
    const result = groupSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const grupo = await db.group.create({
      data: { name: result.data.nombre },
    });

    return NextResponse.json(
      { group: { id: grupo.id, nombre: grupo.name, memberCount: 0, members: [] } },
      { status: 201 }
    );
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe un grupo con ese nombre" },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
