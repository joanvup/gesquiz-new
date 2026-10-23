import { test, expect, type Page } from '@playwright/test';

/**
 * Flujo del docente: crear, editar y eliminar una pregunta manual desde la
 * pestaña "Preguntas" del editor del quiz, incluyendo la subida de una imagen.
 */

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z0Z8AAAAASUVORK5CYII=';

async function loginAsTeacher(page: Page) {
  await page.setExtraHTTPHeaders({
    'x-forwarded-for': `10.98.${Date.now() % 200}.${Math.floor(Math.random() * 200)}`,
  });
  await page.goto('/login');
  await page.fill('input[type="email"]', 'docente@quizcolegio.test');
  await page.fill('input[type="password"]', 'Docente123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/docente/, { timeout: 15000 });
}

async function createQuiz(page: Page): Promise<string> {
  const response = await page.request.post('/api/docente/quizzes', {
    data: {
      titulo: `E2E preguntas manuales ${Date.now()}`,
      descripcion: 'Quiz temporal de Playwright',
      intentosPermitidos: 1,
      mostrarResultado: 'NOTA',
    },
  });
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  return data.quiz.id as string;
}

test('crea, edita y elimina una pregunta manual con imagen', async ({ page }) => {
  await loginAsTeacher(page);
  const quizId = await createQuiz(page);

  try {
    await page.goto(`/docente/quizzes/${quizId}/editar`);
    await expect(page.getByRole('tab', { name: 'Preguntas' })).toBeVisible();

    await page.getByRole('tab', { name: 'Preguntas' }).click();
    await expect(
      page.getByText('Este quiz todavía no tiene preguntas')
    ).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Nueva pregunta' }).click();
    await expect(
      page.getByRole('heading', { name: 'Nueva pregunta' })
    ).toBeVisible();

    // Enunciado
    const enunciado = page.locator('.ProseMirror').nth(0);
    await enunciado.click();
    await enunciado.fill('¿Cuál es la capital de Francia?');

    // Imagen en el enunciado (input oculto del primer editor)
    await page
      .locator('input[type="file"][accept*="image"]')
      .first()
      .setInputFiles({
        name: 'pixel.png',
        mimeType: 'image/png',
        buffer: Buffer.from(PNG_BASE64, 'base64'),
      });
    await expect(enunciado.locator('img')).toHaveCount(1, { timeout: 15000 });

    // Opciones
    const opcion1 = page.locator('.ProseMirror').nth(1);
    const opcion2 = page.locator('.ProseMirror').nth(2);
    await opcion1.click();
    await opcion1.fill('París');
    await opcion2.click();
    await opcion2.fill('Madrid');

    await page.getByRole('button', { name: 'Crear pregunta' }).click();

    // La tarjeta aparece con el resumen y el puntaje recalculado
    await expect(page.getByText('¿Cuál es la capital de Francia?')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText('2 opciones · 1 correcta')).toBeVisible();
    await expect(page.getByText('1 pregunta', { exact: true })).toBeVisible();
    await expect(page.getByText('1 pts en total')).toBeVisible();

    // Editar
    await page.getByTitle('Editar pregunta').click();
    await expect(
      page.getByRole('heading', { name: 'Editar pregunta' })
    ).toBeVisible();
    const enunciadoEdit = page.locator('.ProseMirror').nth(0);
    await enunciadoEdit.fill('¿Cuál es la capital de Italia?');
    await page.getByLabel('Puntaje *').fill('3');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(
      page.getByText('¿Cuál es la capital de Italia?')
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('3 pts en total')).toBeVisible();

    // Eliminar (confirmación del navegador)
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByTitle('Eliminar pregunta').click();
    await expect(
      page.getByText('Este quiz todavía no tiene preguntas')
    ).toBeVisible({ timeout: 15000 });
  } finally {
    await page.request.delete(`/api/docente/quizzes/${quizId}`);
  }
});

test('valida los campos antes de guardar', async ({ page }) => {
  await loginAsTeacher(page);
  const quizId = await createQuiz(page);

  try {
    await page.goto(`/docente/quizzes/${quizId}/editar`);
    await page.getByRole('tab', { name: 'Preguntas' }).click();
    await page.getByRole('button', { name: 'Nueva pregunta' }).click();

    // Sin enunciado no debe guardar
    await page.getByRole('button', { name: 'Crear pregunta' }).click();
    await expect(page.getByText('El enunciado no puede estar vacío')).toBeVisible();

    // Con enunciado pero sin opciones tampoco
    const enunciado = page.locator('.ProseMirror').nth(0);
    await enunciado.click();
    await enunciado.fill('Pregunta de prueba');
    await page.getByRole('button', { name: 'Crear pregunta' }).click();
    await expect(
      page.getByText('Completa el texto de todas las opciones')
    ).toBeVisible();
  } finally {
    await page.request.delete(`/api/docente/quizzes/${quizId}`);
  }
});
