import { serverError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAdminUser } from "@/lib/admin";

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "QuizColegio";

    const students = workbook.addWorksheet("Estudiantes");
    students.columns = [
      { header: "nombre", key: "nombre", width: 32 },
      { header: "email", key: "email", width: 36 },
      { header: "grupos", key: "grupos", width: 32 },
      { header: "password", key: "password", width: 24 },
    ];
    students.getRow(1).font = { bold: true };
    students.views = [{ state: "frozen", ySplit: 1 }];

    const teachers = workbook.addWorksheet("Docentes");
    teachers.columns = [
      { header: "nombre", key: "nombre", width: 32 },
      { header: "email", key: "email", width: 36 },
      { header: "password", key: "password", width: 24 },
    ];
    teachers.getRow(1).font = { bold: true };
    teachers.views = [{ state: "frozen", ySplit: 1 }];

    const groups = workbook.addWorksheet("Grupos");
    groups.columns = [{ header: "grupo", key: "grupo", width: 32 }];
    groups.getRow(1).font = { bold: true };
    groups.views = [{ state: "frozen", ySplit: 1 }];

    const instructions = workbook.addWorksheet("Instrucciones");
    instructions.columns = [{ width: 100 }];
    instructions.addRows([
      ["Plantilla de importación — QuizColegio"],
      [""],
      ["Hoja Estudiantes (opcional):"],
      ["- nombre: obligatorio."],
      ["- email: obligatorio y único. Si ya existe un estudiante, se reutiliza."],
      ["- grupos: opcional. Varios grupos separados por punto y coma (;)."],
      ["- password: obligatorio, mínimo 8 caracteres. Solo se usa al crear estudiantes nuevos."],
      [""],
      ["Hoja Docentes (opcional):"],
      ["- nombre: obligatorio."],
      ["- email: obligatorio y único. Si ya existe un docente, se reutiliza."],
      ["- password: obligatorio, mínimo 8 caracteres. Solo se usa al crear docentes nuevos."],
      [""],
      ["Hoja Grupos (opcional):"],
      ["- Permite crear grupos vacíos. Una fila por grupo."],
      ["- Si un grupo no existe, se crea automáticamente al importar estudiantes."],
      [""],
      ["Notas:"],
      ["- Un email no puede repetirse entre estudiantes y docentes, ni pertenecer a un administrador."],
      ["- Los estudiantes y docentes existentes no cambian su contraseña."],
      ["- Las filas con errores se reportan y no se importan; el resto sí."],
    ]);
    instructions.getRow(1).font = { bold: true, size: 14 };
    instructions.getColumn(1).alignment = { wrapText: true, vertical: "top" };

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla-importacion.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return serverError(err);
  }
}
