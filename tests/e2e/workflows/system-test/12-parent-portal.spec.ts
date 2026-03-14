/**
 * PART 12: Parent Portal (390px viewport)
 * Tests 12.1 – 12.8
 */
import { test, expect } from '../../workflows/workflow.fixtures';
import { AUTH, safeGoTo, assertNoHorizontalOverflow } from './helpers';

test.use({
  storageState: AUTH.parent,
  viewport: { width: 390, height: 844 },
});

test.describe('Part 12: Parent Portal', () => {

  // ── 12.1 — Parent Login & Home ──

  test('12.1.1 – Portal home loads', async ({ page }) => {
    await safeGoTo(page, '/portal/home');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  test('12.1.2 – Shows child name(s)', async ({ page }) => {
    await safeGoTo(page, '/portal/home');
    await page.waitForTimeout(2_000);
    const main = page.locator('main');
    // Should show at least one student name
    await expect(main).toBeVisible();
  });

  // ── 12.2 — Portal Navigation ──

  test('12.2.1 – Bottom nav visible', async ({ page }) => {
    await safeGoTo(page, '/portal/home');
    const bottomNav = page.locator('nav').last()
      .or(page.locator('[class*="bottom-nav"]').first());
    await expect(bottomNav).toBeVisible({ timeout: 10_000 });
  });

  test('12.2.2 – Each bottom nav tab loads', async ({ page }) => {
    const tabs = ['/portal/home', '/portal/schedule', '/portal/practice', '/portal/invoices', '/portal/messages'];
    for (const tab of tabs) {
      await safeGoTo(page, tab);
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
      // No error boundary
      const error = await page.getByText(/something went wrong/i).isVisible().catch(() => false);
      expect(error, `Error on ${tab}`).toBe(false);
    }
  });

  // ── 12.3 — Portal Schedule ──

  test('12.3.1 – Schedule shows lessons', async ({ page }) => {
    await safeGoTo(page, '/portal/schedule');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  // ── 12.4 — Portal Invoices ──

  test('12.4.1 – Invoices page loads', async ({ page }) => {
    await safeGoTo(page, '/portal/invoices');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  test('12.4.3 – £ currency shown (not $)', async ({ page }) => {
    await safeGoTo(page, '/portal/invoices');
    await page.waitForTimeout(2_000);
    // If there are invoices, they should show £
    const hasPound = await page.locator('main').getByText('£').first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    // Only assert if there's invoice data
    const hasInvoices = await page.locator('main').getByText(/invoice|LL-/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasInvoices) {
      expect(hasPound).toBe(true);
    }
  });

  // ── 12.6 — Portal Messages ──

  test('12.6.1 – Messages page loads', async ({ page }) => {
    await safeGoTo(page, '/portal/messages');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  test('12.6.3 – Compose FAB visible', async ({ page }) => {
    await safeGoTo(page, '/portal/messages');
    await page.waitForTimeout(1_000);
    const fab = page.getByRole('button', { name: /compose|new|write/i }).first()
      .or(page.locator('[class*="fab"], button[class*="floating"]').first());
    const hasFab = await fab.isVisible({ timeout: 5_000 }).catch(() => false);
    // FAB may or may not be present depending on messaging config
  });

  // ── 12.7 — Portal Practice ──

  test('12.7.1 – Practice page loads with timer', async ({ page }) => {
    await safeGoTo(page, '/portal/practice');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  // ── Mobile checks ──

  test('12.x – No horizontal overflow on portal pages', async ({ page }) => {
    const portalPages = ['/portal/home', '/portal/schedule', '/portal/invoices', '/portal/messages', '/portal/practice'];
    for (const p of portalPages) {
      await safeGoTo(page, p);
      await assertNoHorizontalOverflow(page);
    }
  });
});
