import { serverError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";
import {
  ExcelFormatError,
  parseStudentsWorkbook,
  type ImportIssue,
} from "@/lib/import/estudiantes-excel";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export async function POST(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No se proporcionó ningún archivo" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "El archivo debe tener extensión .xlsx" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "El archivo excede el límite de 10 MB" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();

    let parsed;
    try {
      parsed = await parseStudentsWorkbook(buffer);
    } catch (err) {
      const message =
        err instanceof ExcelFormatError
          ? err.message
          : "El archivo no es un Excel .xlsx válido";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const errors: ImportIssue[] = [...parsed.errors];
    const report = {
      totalRows: parsed.students.length + parsed.teachers.length,
      studentsCreated: 0,
      studentsExisting: 0,
      studentsUpdated: 0,
      teachersCreated: 0,
      teachersExisting: 0,
      teachersUpdated: 0,
      groupsCreated: 0,
      membershipsAdded: 0,
      errors,
    };

    if (
      parsed.students.length === 0 &&
      parsed.teachers.length === 0 &&
      parsed.groups.length === 0
    ) {
      return NextResponse.json(
        {
          error: "No se encontraron filas válidas para importar",
          report,
        },
        { status: 400 }
      );
    }

    await db.$transaction(
      async (tx) => {
        const existingGroups = await tx.group.findMany();
        const groupCache = new Map<string, string>(
          existingGroups.map((group) => [normalize(group.name), group.id])
        );

        for (const groupName of parsed.groups) {
          const key = normalize(groupName);
          if (groupCache.has(key)) continue;

          const group = await tx.group.create({ data: { name: groupName } });
          groupCache.set(key, group.id);
          report.groupsCreated++;
        }

        for (const row of parsed.students) {
          let student = await tx.user.findUnique({ where: { email: row.email } });

          if (student) {
            if (student.role !== "STUDENT") {
              errors.push({
                sheet: "Estudiantes",
                row: row.rowNumber,
                message: `El email ${row.email} pertenece a un usuario que no es estudiante`,
              });
              continue;
            }

            report.studentsExisting++;
            if (student.name !== row.nombre) {
              student = await tx.user.update({
                where: { id: student.id },
                data: { name: row.nombre },
              });
              report.studentsUpdated++;
            }
          } else {
            const passwordHash = await bcrypt.hash(row.password, 10);
            student = await tx.user.create({
              data: {
                name: row.nombre,
                email: row.email,
                passwordHash,
                role: "STUDENT",
              },
            });
            report.studentsCreated++;
          }

          for (const groupName of row.grupos) {
            const groupId = groupCache.get(normalize(groupName));
            if (!groupId) {
              errors.push({
                sheet: "Estudiantes",
                row: row.rowNumber,
                message: `No se pudo crear o encontrar el grupo "${groupName}"`,
              });
              continue;
            }

            const membership = await tx.groupMember.findUnique({
              where: {
                groupId_userId: { groupId, userId: student.id },
              },
            });

            if (!membership) {
              await tx.groupMember.create({
                data: { groupId, userId: student.id },
              });
              report.membershipsAdded++;
            }
          }
        }

        for (const row of parsed.teachers) {
          const existingTeacher = await tx.user.findUnique({
            where: { email: row.email },
          });

          if (existingTeacher) {
            if (existingTeacher.role !== "TEACHER") {
              errors.push({
                sheet: "Docentes",
                row: row.rowNumber,
                message: `El email ${row.email} pertenece a un usuario que no es docente`,
              });
              continue;
            }

            report.teachersExisting++;
            if (existingTeacher.name !== row.nombre) {
              await tx.user.update({
                where: { id: existingTeacher.id },
                data: { name: row.nombre },
              });
              report.teachersUpdated++;
            }
          } else {
            const passwordHash = await bcrypt.hash(row.password, 10);
            await tx.user.create({
              data: {
                name: row.nombre,
                email: row.email,
                passwordHash,
                role: "TEACHER",
              },
            });
            report.teachersCreated++;
          }
        }

        await tx.importBatch.create({
          data: {
            teacherId: admin.id,
            fileName: file.name,
            reportJson: JSON.stringify(report),
          },
        });
      },
      { timeout: 60000 }
    );

    return NextResponse.json({ success: true, report });
  } catch (err) {
    return serverError(err);
  }
}
