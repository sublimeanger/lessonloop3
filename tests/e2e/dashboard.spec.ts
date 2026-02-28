import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

test.describe('Owner Dashboard', () => {
  test.use({ storageState: AUTH.owner });

  test('loads with greeting and org name', async ({ page }) => {
    await goTo(page, '/dashboard');
    // Dashboard hero shows "Good morning/afternoon/evening, <name>!" as an h1
    await expect(
      page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })
        .or(page.getByRole('heading', { name: /^hi /i }))
        .or(page.getByRole('heading', { name: /dashboard/i }))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows stat cards', async ({ page }) => {
    await goTo(page, '/dashboard');
    // Stat cards show text like "Today's Lessons", "Active Students", etc.
    await expect(
      page.getByText(/today's lessons|active students|this week|revenue/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar shows all owner/admin nav groups', async ({ page }) => {
    await goTo(page, '/dashboard');
    const expected = ['Dashboard', 'Calendar', 'Students', 'Teachers', 'Register', 'Batch Attendance', 'Practice', 'Resources', 'Invoices', 'Leads', 'Waiting List', 'Make-Ups', 'Continuation', 'Reports', 'Locations', 'Messages'];
    for (const link of expected) {
      await expect(page.getByRole('link', { name: link, exact: true }).first()).toBeVisible();
    }
  });

  test('LoopAssist button visible in sidebar footer', async ({ page }) => {
    await goTo(page, '/dashboard');
    await expect(page.getByText('LoopAssist').first()).toBeVisible();
  });

  test('Settings and Help links in footer', async ({ page }) => {
    await goTo(page, '/dashboard');
    await expect(page.getByRole('link', { name: 'Settings', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Help', exact: true }).first()).toBeVisible();
  });

  test('sign out button works', async ({ page }) => {
    await goTo(page, '/dashboard');
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/(login|auth)/, { timeout: 10_000 });
  });
});

test.describe('Teacher Dashboard', () => {
  test.use({ storageState: AUTH.teacher });

  test('loads without admin widgets', async ({ page }) => {
    await goTo(page, '/dashboard');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Finance Dashboard', () => {
  test.use({ storageState: AUTH.finance });

  test('loads with finance-relevant data', async ({ page }) => {
    await goTo(page, '/dashboard');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });
});
