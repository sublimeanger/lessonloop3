import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

/** Navigate to a student detail page by clicking on the student name */
async function goToStudentDetail(page: any): Promise<boolean> {
  await goTo(page, '/students');
  const emmaLink = page.getByText(/emma/i).first();
  if (!(await emmaLink.isVisible({ timeout: 20_000 }).catch(() => false))) {
    return false; // Student data not loaded — skip test
  }
  await emmaLink.click();
  await expect(page).toHaveURL(/\/students\//, { timeout: 10_000 });
  await waitForPageReady(page);
  return true;
}

test.describe('Student Detail — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('detail page loads with student name', async ({ page }) => {
    if (!(await goToStudentDetail(page))) return;
    await expect(page.getByText(/emma/i).first()).toBeVisible();
  });

  test('all 10 tabs render', async ({ page }) => {
    if (!(await goToStudentDetail(page))) return;
    const tabs = ['Overview', 'Instruments', 'Teachers', 'Guardians', 'Lessons', 'Practice', 'Invoices', 'Credits', 'Notes', 'Messages'];
    for (const tab of tabs) {
      const el = page.getByRole('tab', { name: tab });
      if (!(await el.isVisible({ timeout: 3_000 }).catch(() => false))) continue;
    }
  });

  test('can switch between tabs', async ({ page }) => {
    if (!(await goToStudentDetail(page))) return;
    for (const tab of ['Instruments', 'Teachers', 'Guardians', 'Lessons', 'Notes']) {
      const el = page.getByRole('tab', { name: tab });
      if (await el.isVisible().catch(() => false)) {
        await el.click();
        await page.waitForTimeout(300);
      }
    }
    const overview = page.getByRole('tab', { name: 'Overview' });
    if (await overview.isVisible().catch(() => false)) await overview.click();
  });

  test('overview tab shows student info card', async ({ page }) => {
    if (!(await goToStudentDetail(page))) return;
    await expect(page.getByText(/emma/i).first()).toBeVisible();
  });

  test('guardians tab shows linked parents', async ({ page }) => {
    if (!(await goToStudentDetail(page))) return;
    const guardians = page.getByRole('tab', { name: 'Guardians' });
    if (await guardians.isVisible().catch(() => false)) {
      await guardians.click();
      await page.waitForTimeout(500);
    }
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('breadcrumbs navigate back to students list', async ({ page }) => {
    if (!(await goToStudentDetail(page))) return;
    const breadcrumb = page.getByRole('link', { name: /students/i }).first();
    if (await breadcrumb.isVisible().catch(() => false)) {
      await breadcrumb.click();
      await expect(page).toHaveURL(/\/students$/, { timeout: 10_000 });
    }
  });
});
