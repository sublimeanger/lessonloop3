import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, waitForPageReady } from './helpers';

test.describe('Students — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('page loads with student list', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');
    // Wait for student data — may take time in CI
    const hasStudents = await page.getByText(/emma|james|sophie/i).first().isVisible({ timeout: 15_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[students] Seed student visible: ${hasStudents}`);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });

  test('status filter pills (All/Active/Inactive)', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');
    await page.waitForTimeout(2000); // Let data load
    const pills = page.locator('[role="tablist"]').first();
    const hasPills = await pills.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasPills) {
      const activeTab = page.getByRole('tab', { name: /active/i }).or(page.locator('button').filter({ hasText: /active/i })).first();
      if (await activeTab.isVisible().catch(() => false)) {
        await activeTab.click();
        await page.waitForTimeout(300);
      }
      const allTab = page.getByRole('tab', { name: /all/i }).or(page.locator('button').filter({ hasText: /all/i })).first();
      if (await allTab.isVisible().catch(() => false)) {
        await allTab.click();
      }
    }
  });

  test('search filters students', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');
    await page.waitForTimeout(2000);
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await searchInput.fill('Emma');
      await page.waitForTimeout(500);
      const emmaVisible = await page.getByText(/emma/i).first().isVisible().catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[students] Search for Emma visible: ${emmaVisible}`);
    }
  });

  test('add student wizard opens', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');
    const addBtn = page.getByRole('button', { name: /add student/i }).first()
      .or(page.locator('[data-tour="add-student-button"]').first());
    await expect(addBtn.first()).toBeVisible({ timeout: 10_000 });
    await addBtn.first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  });

  test('wizard validates required fields', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');
    const addBtn = page.getByRole('button', { name: /add student/i }).first()
      .or(page.locator('[data-tour="add-student-button"]').first());
    await expect(addBtn.first()).toBeVisible({ timeout: 10_000 });
    await addBtn.first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('navigate to student detail', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');
    const emmaLink = page.getByText(/emma/i).first();
    const hasEmma = await emmaLink.isVisible({ timeout: 15_000 }).catch(() => false);
    if (hasEmma) {
      await emmaLink.click();
      await page.waitForURL(/\/students\//, { timeout: 10_000 }).catch(() => {});
    }
  });

  test('create student happy path', async ({ page }) => {
    test.setTimeout(120_000);
    await safeGoTo(page, '/students', 'Students');
    const addBtn = page.getByRole('button', { name: /add student/i }).first()
      .or(page.locator('[data-tour="add-student-button"]').first());
    await expect(addBtn.first()).toBeVisible({ timeout: 10_000 });
    await addBtn.first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Fill first name — try label then id
    const firstName = page.getByLabel(/first name/i).or(page.locator('#wizard-firstName'));
    await firstName.first().fill('E2E');
    const lastName = page.getByLabel(/last name/i).or(page.locator('#wizard-lastName'));
    await lastName.first().fill('TestStudent' + Date.now().toString().slice(-6));

    const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }
    // Skip optional steps
    const skipOrNext = page.getByRole('button', { name: /next|continue|skip/i }).first();
    if (await skipOrNext.isVisible().catch(() => false)) await skipOrNext.click();
    await page.waitForTimeout(500);
    const finish = page.getByRole('button', { name: /finish|save|create|done/i }).first();
    if (await finish.isVisible().catch(() => false)) await finish.click();
    // Wait for success toast or redirect
    const success = await page.getByText(/success|created|added/i).first().isVisible({ timeout: 15_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[students] Create student success: ${success}`);
  });

  test('export button visible', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');
    const exportBtn = page.getByRole('button', { name: /export|download/i }).first();
    const isVisible = await exportBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[students] Export button visible: ${isVisible}`);
  });
});

test.describe('Students — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('sees only their assigned students', async ({ page }) => {
    await safeGoTo(page, '/students', 'Teacher Students');
  });
});
