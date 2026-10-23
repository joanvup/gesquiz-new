import { test, expect, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const ADMIN_EMAIL = "admin@quizcolegio.test";
const ADMIN_PASSWORD = "Admin123!";

async function loginAdmin(page: Page, ip: string) {
  const response = await page.request.post("/api/auth/login", {
    headers: { "x-forwarded-for": ip },
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
}

test("admin can create, edit, reset the password and delete a teacher", async ({
  page,
  request,
}) => {
  const unique = Date.now();
  const ipBase = `10.20.${unique % 200}`;
  await loginAdmin(page, `${ipBase}.41`);

  const email = `docente.e2e.${unique}@example.test`;
  const initialPassword = "DocenteE2E123!";
  const newPassword = "DocenteE2E456!";
  let teacherId: string | null = null;

  try {
    await page.goto("/admin/docentes");
    await expect(
      page.getByRole("heading", { name: "Docentes", exact: true })
    ).toBeVisible();

    await page.getByRole("button", { name: "Nuevo docente" }).click();
    await page.getByLabel("Nombre").fill("Docente E2E");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña inicial").fill(initialPassword);
    await page.getByRole("button", { name: "Crear docente" }).click();

    await expect(page.getByText("Docente creado")).toBeVisible();

    const listResponse = await page.request.get("/api/admin/docentes");
    expect(listResponse.ok()).toBeTruthy();
    const list = await listResponse.json();
    const created = list.teachers.find(
      (teacher: { email: string }) => teacher.email === email
    );
    expect(created).toBeTruthy();
    teacherId = created.id;

    let row = page.locator("tbody tr").filter({ hasText: email });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Docente E2E");

    await row.getByTitle("Editar").click();
    await expect(page.locator("#teacher-nombre")).toHaveValue("Docente E2E");
    await page.locator("#teacher-nombre").fill("Docente E2E Editado");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Docente actualizado")).toBeVisible();

    row = page.locator("tbody tr").filter({ hasText: email });
    await expect(row).toContainText("Docente E2E Editado");

    await row.getByTitle("Restablecer contraseña").click();
    await page.locator("#teacher-new-password").fill(newPassword);
    await page.getByRole("button", { name: "Actualizar contraseña" }).click();
    await expect(
      page.getByText("Contraseña actualizada para Docente E2E Editado")
    ).toBeVisible();

    const teacherLogin = await request.post("/api/auth/login", {
      headers: { "x-forwarded-for": `${ipBase}.42` },
      data: { email, password: newPassword },
    });
    expect(teacherLogin.ok()).toBeTruthy();
    const teacherSession = await teacherLogin.json();
    expect(teacherSession.user.role).toBe("TEACHER");

    page.once("dialog", (dialog) => dialog.accept());
    await row.getByTitle("Eliminar").click();
    await expect(page.getByText("Docente eliminado")).toBeVisible();
    await expect(page.locator("tbody tr").filter({ hasText: email })).toHaveCount(0);
    teacherId = null;
  } finally {
    if (teacherId) {
      await page.request.delete(`/api/admin/docentes/${teacherId}`);
    }
  }
});

test("admin can import teachers and download a template with a Docentes sheet", async ({
  page,
  request,
}) => {
  const unique = Date.now();
  const ipBase = `10.20.${unique % 200}`;
  await loginAdmin(page, `${ipBase}.51`);

  const email = `docente.import.${unique}@example.test`;
  const password = "Import123!";
  const studentEmail = `estudiante.import.${unique}@example.test`;
  const studentPassword = "Estudiante123!";
  const groupName = `Grupo Import E2E ${unique}`;
  let teacherId: string | null = null;
  let studentId: string | null = null;
  let groupId: string | null = null;

  try {
    const templateResponse = await page.request.get(
      "/api/admin/plantilla-estudiantes"
    );
    expect(templateResponse.ok()).toBeTruthy();
    const templateBuffer = await templateResponse.body();
    const templateWorkbook = new ExcelJS.Workbook();
    await templateWorkbook.xlsx.load(templateBuffer as unknown as ArrayBuffer);
    expect(templateWorkbook.getWorksheet("Docentes")).toBeTruthy();

    const workbook = new ExcelJS.Workbook();

    const students = workbook.addWorksheet("Estudiantes");
    students.addRow(["nombre", "email", "grupos", "password"]);
    students.addRow([
      "Estudiante Importado E2E",
      studentEmail,
      groupName,
      studentPassword,
    ]);

    const docentes = workbook.addWorksheet("Docentes");
    docentes.addRow(["nombre", "email", "password"]);
    docentes.addRow(["Docente Importado", email, password]);

    const filePath = test.info().outputPath("docentes-import.xlsx");
    await workbook.xlsx.writeFile(filePath);

    await page.goto("/admin/importar");
    await page.locator("#admin-excel-input").setInputFiles(filePath);
    await page.getByRole("button", { name: "Importar archivo" }).click();

    await expect(page.getByText("Reporte de importación")).toBeVisible();
    await expect(page.getByText("Docentes creados").locator("..")).toContainText(
      "1"
    );
    await expect(
      page.getByText("Estudiantes creados").locator("..")
    ).toContainText("1");
    await expect(page.getByText("Grupos creados").locator("..")).toContainText(
      "1"
    );

    const listResponse = await page.request.get("/api/admin/docentes");
    expect(listResponse.ok()).toBeTruthy();
    const list = await listResponse.json();
    const imported = list.teachers.find(
      (teacher: { email: string }) => teacher.email === email
    );
    expect(imported).toBeTruthy();
    expect(imported.nombre).toBe("Docente Importado");
    teacherId = imported.id;

    const studentsResponse = await page.request.get("/api/admin/estudiantes");
    expect(studentsResponse.ok()).toBeTruthy();
    const studentsList = await studentsResponse.json();
    const importedStudent = studentsList.students.find(
      (student: { email: string }) => student.email === studentEmail
    );
    expect(importedStudent).toBeTruthy();
    expect(importedStudent.nombre).toBe("Estudiante Importado E2E");
    expect(importedStudent.groups.map((group: { name: string }) => group.name)).toContain(
      groupName
    );
    studentId = importedStudent.id;

    const groupsResponse = await page.request.get("/api/admin/grupos");
    expect(groupsResponse.ok()).toBeTruthy();
    const groupsList = await groupsResponse.json();
    const importedGroup = groupsList.groups.find(
      (group: { nombre: string }) => group.nombre === groupName
    );
    expect(importedGroup).toBeTruthy();
    groupId = importedGroup.id;

    const teacherLogin = await request.post("/api/auth/login", {
      headers: { "x-forwarded-for": `${ipBase}.52` },
      data: { email, password },
    });
    expect(teacherLogin.ok()).toBeTruthy();
    const teacherSession = await teacherLogin.json();
    expect(teacherSession.user.role).toBe("TEACHER");

    const studentLogin = await request.post("/api/auth/login", {
      headers: { "x-forwarded-for": `${ipBase}.53` },
      data: { email: studentEmail, password: studentPassword },
    });
    expect(studentLogin.ok()).toBeTruthy();
    const studentSession = await studentLogin.json();
    expect(studentSession.user.role).toBe("STUDENT");
  } finally {
    if (teacherId) {
      await page.request.delete(`/api/admin/docentes/${teacherId}`);
    }
    if (studentId) {
      await page.request.delete(`/api/admin/estudiantes/${studentId}`);
    }
    if (groupId) {
      await page.request.delete(`/api/admin/grupos/${groupId}`);
    }
  }
});
