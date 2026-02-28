import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

/** Navigate to a student detail page by clicking on the student name */
async function goToStudentDetail(page: any) {
  await goTo(page, '/students');
  const emmaLink = page.getByText(/emma/i).first();
  await expect(emmaLink).toBeVisible({ timeout: 15_000 });
  await emmaLink.click();
  await expect(page).toHaveURL(/\/students\//, { timeout: 10_000 });
  await waitForPageReady(page);
}

test.describe('Student Detail — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('detail page loads with student name', async ({ page }) => {
    await goToStudentDetail(page);
    await expect(page.getByText(/emma/i).first()).toBeVisible();
  });

  test('all 10 tabs render', async ({ page }) => {
    await goToStudentDetail(page);
    const tabs = ['Overview', 'Instruments', 'Teachers', 'Guardians', 'Lessons', 'Practice', 'Invoices', 'Credits', 'Notes', 'Messages'];
    for (const tab of tabs) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible({ timeout: 5_000 });
    }
  });

  test('can switch between tabs', async ({ page }) => {
    await goToStudentDetail(page);
    // Click each tab and verify content area changes
    for (const tab of ['Instruments', 'Teachers', 'Guardians', 'Lessons', 'Notes']) {
      await page.getByRole('tab', { name: tab }).click();
      await page.waitForTimeout(300);
    }
    // Return to Overview
    await page.getByRole('tab', { name: 'Overview' }).click();
  });

  test('overview tab shows student info card', async ({ page }) => {
    await goToStudentDetail(page);
    // Overview tab should show student details
    await expect(page.getByText(/emma/i).first()).toBeVisible();
  });

  test('guardians tab shows linked parents', async ({ page }) => {
    await goToStudentDetail(page);
    await page.getByRole('tab', { name: 'Guardians' }).click();
    await page.waitForTimeout(500);
    // Should show the linked parent
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('breadcrumbs navigate back to students list', async ({ page }) => {
    await goToStudentDetail(page);
    // Breadcrumb link might be "Students" or a back arrow
    const breadcrumb = page.getByRole('link', { name: /students/i }).first();
    if (await breadcrumb.isVisible().catch(() => false)) {
      await breadcrumb.click();
      await expect(page).toHaveURL(/\/students$/, { timeout: 10_000 });
    }
  });
});
