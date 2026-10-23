import ExcelJS from "exceljs";
import { z } from "zod";

export class ExcelFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExcelFormatError";
  }
}

export interface ParsedStudentRow {
  rowNumber: number;
  nombre: string;
  email: string;
  password: string;
  grupos: string[];
}

export interface ImportIssue {
  row: number;
  message: string;
}

export interface ParsedStudentsWorkbook {
  students: ParsedStudentRow[];
  groups: string[];
  errors: ImportIssue[];
}

const rowSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "El nombre es demasiado largo"),
  email: z
    .string()
    .trim()
    .min(1, "El email es obligatorio")
    .email("El email no es válido")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128, "La contraseña es demasiado larga"),
});

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;

  if (value === null || value === undefined) return "";

  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("result" in value && value.result !== undefined) {
      return String(value.result).trim();
    }
    if ("hyperlink" in value && "text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
  }

  return cell.text?.trim() ?? "";
}

function findSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet | undefined {
  const target = normalize(name);
  return workbook.worksheets.find((sheet) => normalize(sheet.name) === target);
}

interface HeaderInfo {
  rowNumber: number;
  columns: Map<string, number>;
}

function findHeaders(sheet: ExcelJS.Worksheet, required: string[]): HeaderInfo {
  const maxRow = Math.min(sheet.rowCount, 10);

  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const columns = new Map<string, number>();

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = normalize(cellText(cell));
      if (header) columns.set(header, colNumber);
    });

    if (required.every((header) => columns.has(header))) {
      return { rowNumber, columns };
    }
  }

  throw new ExcelFormatError(
    `No se encontró la fila de encabezados. Debe incluir las columnas: ${required.join(", ")}`
  );
}

function parseGroups(raw: string): string[] {
  const seen = new Set<string>();
  const groups: string[] = [];

  for (const part of raw.split(/[;,]/)) {
    const name = part.trim();
    if (!name) continue;

    const key = normalize(name);
    if (seen.has(key)) continue;

    seen.add(key);
    groups.push(name);
  }

  return groups;
}

export async function parseStudentsWorkbook(
  data: ArrayBuffer
): Promise<ParsedStudentsWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);

  const studentsSheet = findSheet(workbook, "Estudiantes");
  if (!studentsSheet) {
    throw new ExcelFormatError('El archivo debe contener una hoja llamada "Estudiantes"');
  }

  const headers = findHeaders(studentsSheet, ["nombre", "email", "password"]);
  const nombreColumn = headers.columns.get("nombre")!;
  const emailColumn = headers.columns.get("email")!;
  const passwordColumn = headers.columns.get("password")!;
  const gruposColumn = headers.columns.get("grupos");

  const students: ParsedStudentRow[] = [];
  const errors: ImportIssue[] = [];
  const seenEmails = new Set<string>();
  const groupSet = new Map<string, string>();

  for (let rowNumber = headers.rowNumber + 1; rowNumber <= studentsSheet.rowCount; rowNumber++) {
    const row = studentsSheet.getRow(rowNumber);

    const nombre = cellText(row.getCell(nombreColumn));
    const email = cellText(row.getCell(emailColumn));
    const password = cellText(row.getCell(passwordColumn));
    const gruposRaw = gruposColumn ? cellText(row.getCell(gruposColumn)) : "";

    if (!nombre && !email && !password && !gruposRaw) continue;

    const result = rowSchema.safeParse({ nombre, email, password });
    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join(". ");
      errors.push({ row: rowNumber, message });
      continue;
    }

    const grupos = parseGroups(gruposRaw);
    const tooLongGroup = grupos.find((group) => group.length > 100);
    if (tooLongGroup) {
      errors.push({
        row: rowNumber,
        message: `El grupo "${tooLongGroup}" supera los 100 caracteres`,
      });
      continue;
    }

    if (seenEmails.has(result.data.email)) {
      errors.push({
        row: rowNumber,
        message: `El email ${result.data.email} está repetido en el archivo`,
      });
      continue;
    }

    seenEmails.add(result.data.email);
    for (const group of grupos) {
      const key = normalize(group);
      if (!groupSet.has(key)) groupSet.set(key, group);
    }

    students.push({
      rowNumber,
      nombre: result.data.nombre,
      email: result.data.email,
      password: result.data.password,
      grupos,
    });
  }

  const groupsSheet = findSheet(workbook, "Grupos");
  if (groupsSheet) {
    try {
      const groupHeaders = findHeaders(groupsSheet, ["grupo"]);
      const groupColumn = groupHeaders.columns.get("grupo")!;

      for (
        let rowNumber = groupHeaders.rowNumber + 1;
        rowNumber <= groupsSheet.rowCount;
        rowNumber++
      ) {
        const name = cellText(groupsSheet.getRow(rowNumber).getCell(groupColumn));
        if (!name) continue;

        if (name.length > 100) {
          errors.push({
            row: rowNumber,
            message: `El grupo "${name}" supera los 100 caracteres`,
          });
          continue;
        }

        const key = normalize(name);
        if (!groupSet.has(key)) groupSet.set(key, name);
      }
    } catch {
      // La hoja Grupos es opcional; si existe pero no tiene el formato
      // esperado, se ignoran sus filas y se reporta el problema.
      errors.push({
        row: 1,
        message: 'La hoja "Grupos" no tiene la columna "grupo" y fue ignorada',
      });
    }
  }

  return {
    students,
    groups: Array.from(groupSet.values()),
    errors,
  };
}
