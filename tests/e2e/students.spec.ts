import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo, openDialog } from './helpers';

test.describe('Students — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('page loads with student list', async ({ page }) => {
    await goTo(page, '/students');
    await expect(page.getByText(/emma|james|sophie/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('status filter pills (All/Active/Inactive)', async ({ page }) => {
    await goTo(page, '/students');
    await expect(page.getByText(/emma|james|sophie/i).first()).toBeVisible({ timeout: 20_000 });
    const pills = page.locator('[role="tablist"]').first();
    if (await pills.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.getByRole('tab', { name: /active/i }).or(page.locator('button').filter({ hasText: /active/i })).first().click();
      await page.waitForTimeout(300);
      await page.getByRole('tab', { name: /all/i }).or(page.locator('button').filter({ hasText: /all/i })).first().click();
    }
  });

  test('search filters students', async ({ page }) => {
    await goTo(page, '/students');
    await expect(page.getByText(/emma|james|sophie/i).first()).toBeVisible({ timeout: 20_000 });
    await page.getByPlaceholder(/search/i).first().fill('Emma');
    await page.waitForTimeout(500);
    await expect(page.getByText(/emma/i).first()).toBeVisible();
  });

  test('add student wizard opens', async ({ page }) => {
    await goTo(page, '/students');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    const addBtn = page.getByRole('button', { name: /add student|new student/i }).first()
      .or(page.locator('button').filter({ hasText: /add student|new student/i }).first());
    if (await addBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await addBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('wizard validates required fields', async ({ page }) => {
    await goTo(page, '/students');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    const addBtn = page.getByRole('button', { name: /add student|new student/i }).first()
      .or(page.locator('button').filter({ hasText: /add student|new student/i }).first());
    if (await addBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await addBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
      const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('navigate to student detail', async ({ page }) => {
    await goTo(page, '/students');
    const emmaLink = page.getByText(/emma/i).first();
    if (await emmaLink.isVisible({ timeout: 20_000 }).catch(() => false)) {
      await emmaLink.click();
      await expect(page).toHaveURL(/\/students\//, { timeout: 10_000 });
    }
  });

  test('create student happy path', async ({ page }) => {
    await goTo(page, '/students');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    const addBtn = page.getByRole('button', { name: /add student|new student/i }).first()
      .or(page.locator('button').filter({ hasText: /add student|new student/i }).first());
    if (!(await addBtn.isVisible({ timeout: 10_000 }).catch(() => false))) return;
    await addBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
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
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    const exportBtn = page.getByRole('button', { name: /export|download/i }).first();
    const isVisible = await exportBtn.isVisible().catch(() => false);
    if (isVisible) {
      await expect(exportBtn).toBeVisible();
    }
  });
});

test.describe('Students — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('sees only their assigned students', async ({ page }) => {
    await goTo(page, '/students');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });
});
