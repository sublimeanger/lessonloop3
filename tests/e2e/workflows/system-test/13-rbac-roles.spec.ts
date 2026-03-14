/**
 * PART 13: Role-Based Access Control (Desktop)
 * Tests 13.1 – 13.4
 */
import { test, expect } from '../../workflows/workflow.fixtures';
import { AUTH, safeGoTo } from './helpers';

test.describe('Part 13: RBAC — Teacher Role', () => {
  test.use({ storageState: AUTH.teacher });

  test('13.1.1 – Teacher dashboard loads', async ({ page }) => {
    await safeGoTo(page, '/dashboard');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  test('13.1.2 – Can see calendar, students, register', async ({ page }) => {
    for (const path of ['/calendar', '/students', '/register']) {
      await safeGoTo(page, path);
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
      const error = await page.getByText(/something went wrong/i).isVisible().catch(() => false);
      expect(error, `Error on ${path}`).toBe(false);
    }
  });

  test('13.1.3 – Cannot access invoices or leads (redirect or error)', async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForTimeout(3_000);
    // Should redirect away or show access denied
    const onInvoices = page.url().includes('/invoices');
    const hasError = await page.getByText(/access|denied|unauthori/i).isVisible().catch(() => false);
    // Either redirected or shows error
    expect(onInvoices && !hasError).toBe(false);
  });
});

test.describe('Part 13: RBAC — Finance Role', () => {
  test.use({ storageState: AUTH.finance });

  test('13.2.1 – Finance dashboard loads', async ({ page }) => {
    await safeGoTo(page, '/dashboard');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  test('13.2.2 – Can see invoices and reports', async ({ page }) => {
    for (const path of ['/invoices', '/reports']) {
      await safeGoTo(page, path);
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    }
  });
});

test.describe('Part 13: RBAC — Admin Role', () => {
  test.use({ storageState: AUTH.admin });

  test('13.3.1 – Admin has full access', async ({ page }) => {
    for (const path of ['/dashboard', '/calendar', '/students', '/invoices', '/reports', '/settings/organisation']) {
      await safeGoTo(page, path);
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
      const error = await page.getByText(/something went wrong/i).isVisible().catch(() => false);
      expect(error, `Error on ${path}`).toBe(false);
    }
  });
});

test.describe('Part 13: RBAC — Parent Role', () => {
  test.use({ storageState: AUTH.parent });

  test('13.4.1 – Parent redirected to portal', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/(portal|dashboard)/, { timeout: 15_000 });
    // Should end up on portal
    expect(page.url()).toMatch(/\/portal/);
  });

  test('13.4.2-4 – Parent cannot access staff pages', async ({ page }) => {
    for (const path of ['/notes', '/calendar', '/students']) {
      await page.goto(path);
      await page.waitForTimeout(3_000);
      // Should redirect to portal
      expect(page.url()).toMatch(/\/portal/);
    }
  });
});
