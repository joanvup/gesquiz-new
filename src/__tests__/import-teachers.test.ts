import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  ExcelFormatError,
  parseStudentsWorkbook,
} from "../lib/import/estudiantes-excel";

async function workbookBuffer(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
  return (await workbook.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}

function addPeopleSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  rows: string[][]
) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(["nombre", "email", "password"]);
  for (const row of rows) sheet.addRow(row);
  return sheet;
}

describe("parseStudentsWorkbook", () => {
  it("parses a workbook with only a Docentes sheet", async () => {
    const workbook = new ExcelJS.Workbook();
    addPeopleSheet(workbook, "Docentes", [
      ["Profesora Ana", "ana.docente@example.test", "Docente123!"],
    ]);

    const parsed = await parseStudentsWorkbook(await workbookBuffer(workbook));

    expect(parsed.students).toHaveLength(0);
    expect(parsed.teachers).toHaveLength(1);
    expect(parsed.teachers[0]).toMatchObject({
      nombre: "Profesora Ana",
      email: "ana.docente@example.test",
    });
    expect(parsed.errors).toHaveLength(0);
  });

  it("parses students, teachers and groups together", async () => {
    const workbook = new ExcelJS.Workbook();

    const students = workbook.addWorksheet("Estudiantes");
    students.addRow(["nombre", "email", "grupos", "password"]);
    students.addRow([
      "Estudiante Uno",
      "estudiante.uno@example.test",
      "8A;Matemática",
      "Estudiante123!",
    ]);

    addPeopleSheet(workbook, "Docentes", [
      ["Profesor Uno", "profesor.uno@example.test", "Docente123!"],
    ]);

    const groups = workbook.addWorksheet("Grupos");
    groups.addRow(["grupo"]);
    groups.addRow(["Grupo vacío"]);

    const parsed = await parseStudentsWorkbook(await workbookBuffer(workbook));

    expect(parsed.students).toHaveLength(1);
    expect(parsed.teachers).toHaveLength(1);
    expect(parsed.groups).toEqual(
      expect.arrayContaining(["8A", "Matemática", "Grupo vacío"])
    );
    expect(parsed.errors).toHaveLength(0);
  });

  it("reports duplicate emails across sheets", async () => {
    const workbook = new ExcelJS.Workbook();

    addPeopleSheet(workbook, "Estudiantes", [
      ["Estudiante", "repetido@example.test", "Estudiante123!"],
    ]);
    addPeopleSheet(workbook, "Docentes", [
      ["Docente", "repetido@example.test", "Docente123!"],
    ]);

    const parsed = await parseStudentsWorkbook(await workbookBuffer(workbook));

    expect(parsed.students).toHaveLength(1);
    expect(parsed.teachers).toHaveLength(0);
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        sheet: "Docentes",
        row: 2,
        message: expect.stringContaining("repetido en el archivo"),
      }),
    ]);
  });

  it("reports invalid teacher rows without stopping valid rows", async () => {
    const workbook = new ExcelJS.Workbook();
    addPeopleSheet(workbook, "Docentes", [
      ["Docente sin clave", "sinclave@example.test", "corta"],
      ["Docente válido", "valido@example.test", "Docente123!"],
    ]);

    const parsed = await parseStudentsWorkbook(await workbookBuffer(workbook));

    expect(parsed.teachers).toHaveLength(1);
    expect(parsed.teachers[0].email).toBe("valido@example.test");
    expect(parsed.errors).toEqual([
      expect.objectContaining({ sheet: "Docentes", row: 2 }),
    ]);
  });

  it("rejects workbooks without a recognized sheet", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Otros").addRow(["dato"]);

    await expect(
      parseStudentsWorkbook(await workbookBuffer(workbook))
    ).rejects.toBeInstanceOf(ExcelFormatError);
  });
});
