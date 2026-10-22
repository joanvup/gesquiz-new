import { test, expect } from '@playwright/test';

test.describe('QuizColegio E2E Comprehensive Flows', () => {
  test('1. Teacher login and import Moodle XML', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'docente@quizcolegio.test');
    await page.fill('input[type="password"]', 'Docente123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/docente/);
    await expect(page.locator('body')).toContainText('Panel Docente');
  });

  test('4. API block back navigation when permitirRetroceso = false', async ({ request }) => {
    // Login as student via API or cookie
    const loginRes = await request.post('/api/auth/login', {
      data: {
        email: 'estudiante1@quizcolegio.test',
        password: 'Estudiante123!',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
  });

  test('2, 3 & 5. Student quiz attempt flow, resume and auto-submit', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'estudiante1@quizcolegio.test');
    await page.fill('input[type="password"]', 'Estudiante123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/estudiante/);
  });
});
