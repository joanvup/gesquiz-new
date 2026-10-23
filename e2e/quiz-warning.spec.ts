import { test, expect, type Page } from '@playwright/test';

const TEACHER_EMAIL = 'docente@quizcolegio.test';
const TEACHER_PASSWORD = 'Docente123!';

async function loginTeacher(page: Page, ip: string) {
  const response = await page.request.post('/api/auth/login', {
    headers: { 'x-forwarded-for': ip },
    data: { email: TEACHER_EMAIL, password: TEACHER_PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
}

test('la advertencia al continuar está desactivada por defecto y se guarda por quiz', async ({
  page,
}) => {
  const unique = Date.now();
  const ipBase = `10.30.${unique % 200}`;
  await loginTeacher(page, `${ipBase}.51`);

  await page.goto('/docente/quizzes/nuevo');
  const warningCheckbox = page.getByLabel('Mostrar advertencia al continuar');
  const allowBackCheckbox = page.getByLabel('Permitir retroceso entre preguntas');

  await expect(warningCheckbox).not.toBeChecked();
  await expect(warningCheckbox).toBeDisabled();

  await allowBackCheckbox.uncheck();
  await expect(warningCheckbox).toBeEnabled();
  await expect(warningCheckbox).not.toBeChecked();

  await warningCheckbox.check();
  await expect(warningCheckbox).toBeChecked();

  const title = `E2E advertencia ${unique}`;
  const createResponse = await page.request.post('/api/docente/quizzes', {
    data: {
      titulo: title,
      permitirRetroceso: false,
    },
  });
  const createBody = await createResponse.text();
  expect(createResponse.ok(), createBody).toBeTruthy();
  const created = JSON.parse(createBody);

  try {
    expect(created.quiz.advertirAlContinuar).toBe(false);

    const updateResponse = await page.request.put(
      `/api/docente/quizzes/${created.quiz.id}`,
      {
        data: {
          titulo: title,
          permitirRetroceso: false,
          advertirAlContinuar: true,
        },
      }
    );
    expect(updateResponse.ok()).toBeTruthy();
    const updated = await updateResponse.json();
    expect(updated.quiz.advertirAlContinuar).toBe(true);

    const getResponse = await page.request.get(
      `/api/docente/quizzes/${created.quiz.id}`
    );
    expect(getResponse.ok()).toBeTruthy();
    const fetched = await getResponse.json();
    expect(fetched.quiz.advertirAlContinuar).toBe(true);
  } finally {
    await page.request.delete(`/api/docente/quizzes/${created.quiz.id}`);
  }
});
