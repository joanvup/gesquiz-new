import { serverError } from "@/lib/api-error";
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const groups = await db.group.findMany({
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    const students = await db.user.findMany({
      where: { role: 'STUDENT' },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({ groups, students });
  } catch (err) {
    return serverError(err);
  }
}
