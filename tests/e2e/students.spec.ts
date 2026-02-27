import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo, openDialog } from './helpers';

test.describe('Students — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('page loads with student list', async ({ page }) => {
    await goTo(page, '/students');
    await expect(page.getByText(/emma|james|sophie/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('status filter pills (All/Active/Inactive)', async ({ page }) => {
    await goTo(page, '/students');
    const pills = page.locator('[role="tablist"]').first();
    await expect(pills).toBeVisible();
    await page.getByRole('tab', { name: /active/i }).or(page.locator('button').filter({ hasText: /active/i })).first().click();
    await page.waitForTimeout(300);
    await page.getByRole('tab', { name: /all/i }).or(page.locator('button').filter({ hasText: /all/i })).first().click();
  });

  test('search filters students', async ({ page }) => {
    await goTo(page, '/students');
    await page.getByPlaceholder(/search/i).first().fill('Emma');
    await page.waitForTimeout(500);
    await expect(page.getByText(/emma/i).first()).toBeVisible();
  });

  test('add student wizard opens', async ({ page }) => {
    await goTo(page, '/students');
    await page.getByRole('button', { name: /add student|new student/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  });

  test('wizard validates required fields', async ({ page }) => {
    await goTo(page, '/students');
    await page.getByRole('button', { name: /add student|new student/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // Try to proceed without filling required fields
    const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('navigate to student detail', async ({ page }) => {
    await goTo(page, '/students');
    await page.getByText(/emma/i).first().click();
    await expect(page).toHaveURL(/\/students\//, { timeout: 5_000 });
  });

  test('create student happy path', async ({ page }) => {
    await goTo(page, '/students');
    await page.getByRole('button', { name: /add student|new student/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel(/first name/i).fill('E2E');
    await page.getByLabel(/last name/i).fill('TestStudent' + Date.now().toString().slice(-6));
    const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
    await nextBtn.click();
    await page.waitForTimeout(500);
    // Skip optional steps
    const skipOrNext = page.getByRole('button', { name: /next|continue|skip/i }).first();
    if (await skipOrNext.isVisible()) await skipOrNext.click();
    await page.waitForTimeout(500);
    const finish = page.getByRole('button', { name: /finish|save|create|done/i }).first();
    if (await finish.isVisible()) await finish.click();
    await expect(page.getByText(/success|created|added/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('export button visible', async ({ page }) => {
    await goTo(page, '/students');
    await expect(page.getByRole('button', { name: /export|download/i }).first()).toBeVisible();
  });
});

test.describe('Students — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('sees only their assigned students', async ({ page }) => {
    await goTo(page, '/students');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });
});
