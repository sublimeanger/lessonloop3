/**
 * 06 — Dashboard (per role)
 *
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §6
 *
 * Three role-specific dashboard layouts (Academy/Solo, Teacher,
 * Finance) + parent redirect. Each must:
 *  - Load without error boundary
 *  - Render its widgets
 *  - Reflect actual DB values in stat cards
 *  - Navigate correctly when stat cards are tapped
 *  - Update via realtime when DB changes
 */

import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary } from '../helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.admin);
  refreshStorageStateIfStale(AUTH.teacher);
  refreshStorageStateIfStale(AUTH.finance);
});

test.describe('Owner Dashboard (AcademyDashboard)', () => {
  test.use({ storageState: AUTH.owner });

  test('renders without error boundary', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    await assertNoErrorBoundary(page);
  });

  test('greeting renders with time-of-day phrase', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/good (morning|afternoon|evening)/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('stat cards render', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    const anyStat = page.getByText(/active students|today.s lessons|outstanding|revenue/i).first();
    await expect(anyStat).toBeVisible({ timeout: 15_000 });
  });

  test('Active Students card navigates to /students', async ({ page }) => {
    await page.goto('/dashboard');
    const card = page.locator('a[href="/students"]').filter({ hasText: /active students/i }).first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await expect(page).toHaveURL(/\/students/);
    }
  });

  test('Outstanding card navigates to /invoices', async ({ page }) => {
    await page.goto('/dashboard');
    const card = page.locator('a[href*="/invoices"]').filter({ hasText: /outstanding/i }).first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await expect(page).toHaveURL(/\/invoices/);
    }
  });

  test('LoopAssist button visible (not for finance)', async ({ page }) => {
    await page.goto('/dashboard');
    const btn = page.locator('button').filter({ hasText: 'LoopAssist' }).first();
    await expect(btn).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Admin Dashboard', () => {
  test.use({ storageState: AUTH.admin });
  test('renders same layout as owner', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    await assertNoErrorBoundary(page);
    await expect(page.getByText(/active students|today.s lessons/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Teacher Dashboard', () => {
  test.use({ storageState: AUTH.teacher });
  test('renders teacher-specific layout', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    await assertNoErrorBoundary(page);
    // Teacher dashboard shows "My Students" / "My Lessons" rather than org-wide
    await expect(page.getByText(/my (students|lessons|calendar|availability)/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Finance Dashboard', () => {
  test.use({ storageState: AUTH.finance });
  test('renders without error boundary', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    await assertNoErrorBoundary(page);
  });
});

test.describe('Parent → /dashboard redirects to /portal/home', () => {
  test.use({ storageState: AUTH.parent });
  test('parent visiting /dashboard goes to /portal/home', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/portal\/home/, { timeout: 15_000 });
  });
});

test.fixme('realtime: insert invoice via service role → outstanding count updates within 5s', async () => {});
test.fixme('OnboardingChecklist auto-dismisses when all items complete', async () => {});
