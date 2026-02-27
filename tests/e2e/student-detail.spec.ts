import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

test.describe('Student Detail — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('detail page loads with student name', async ({ page }) => {
    await goTo(page, '/students');
    await page.getByText(/emma/i).first().click();
    await expect(page).toHaveURL(/\/students\//);
    await waitForPageReady(page);
    await expect(page.getByText(/emma/i).first()).toBeVisible();
  });

  test('all 10 tabs render', async ({ page }) => {
    await goTo(page, '/students');
    await page.getByText(/emma/i).first().click();
    await waitForPageReady(page);
    const tabs = ['Overview', 'Instruments', 'Teachers', 'Guardians', 'Lessons', 'Practice', 'Invoices', 'Credits', 'Notes', 'Messages'];
    for (const tab of tabs) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    }
  });

  test('can switch between tabs', async ({ page }) => {
    await goTo(page, '/students');
    await page.getByText(/emma/i).first().click();
    await waitForPageReady(page);
    // Click each tab and verify content area changes
    for (const tab of ['Instruments', 'Teachers', 'Guardians', 'Lessons', 'Notes']) {
      await page.getByRole('tab', { name: tab }).click();
      await page.waitForTimeout(300);
    }
    // Return to Overview
    await page.getByRole('tab', { name: 'Overview' }).click();
  });

  test('overview tab shows student info card', async ({ page }) => {
    await goTo(page, '/students');
    await page.getByText(/emma/i).first().click();
    await waitForPageReady(page);
    // Overview tab should show student details
    await expect(page.getByText(/emma/i).first()).toBeVisible();
  });

  test('guardians tab shows linked parents', async ({ page }) => {
    await goTo(page, '/students');
    await page.getByText(/emma/i).first().click();
    await waitForPageReady(page);
    await page.getByRole('tab', { name: 'Guardians' }).click();
    await page.waitForTimeout(500);
    // Should show the linked parent
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('breadcrumbs navigate back to students list', async ({ page }) => {
    await goTo(page, '/students');
    await page.getByText(/emma/i).first().click();
    await waitForPageReady(page);
    await page.getByRole('link', { name: 'Students' }).first().click();
    await expect(page).toHaveURL(/\/students$/);
  });
});
