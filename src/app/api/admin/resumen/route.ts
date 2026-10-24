import { serverError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const [students, groups, teachers, quizzes, attempts] = await Promise.all([
      db.user.count({ where: { role: "STUDENT" } }),
      db.group.count(),
      db.user.count({ where: { role: "TEACHER" } }),
      db.quiz.count(),
      db.attempt.count(),
    ]);

    return NextResponse.json({
      students,
      groups,
      teachers,
      quizzes,
      attempts,
    });
  } catch (err) {
    return serverError(err);
  }
}
