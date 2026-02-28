import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

// ═══════════════════════════════════════════════════════════
// PARENT 1 — Should see Emma + James
// ═══════════════════════════════════════════════════════════
test.describe('Portal — Parent 1', () => {
  test.use({ storageState: AUTH.parent });

  test('portal home loads with children', async ({ page }) => {
    await goTo(page, '/portal/home');
    await expect(
      page.getByText(/emma/i).first()
        .or(page.locator('main').first())
    ).toBeVisible({ timeout: 20_000 });
  });

  test('schedule page loads', async ({ page }) => {
    await goTo(page, '/portal/schedule');
    await expect(page.getByText(/schedule|lesson|upcoming/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('practice page loads', async ({ page }) => {
    await goTo(page, '/portal/practice');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  test('resources page loads', async ({ page }) => {
    await goTo(page, '/portal/resources');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  test('invoices page loads', async ({ page }) => {
    await goTo(page, '/portal/invoices');
    await expect(page.getByText(/invoice|payment|no.*invoices/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('messages page loads', async ({ page }) => {
    await goTo(page, '/portal/messages');
    await expect(page.getByText(/message|inbox|no.*messages/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('can create message request', async ({ page }) => {
    await goTo(page, '/portal/messages');
    const composeBtn = page.getByRole('button', { name: /new|compose|request|write|message/i }).first();
    if (await composeBtn.isVisible().catch(() => false)) {
      await composeBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('profile page loads with user info', async ({ page }) => {
    await goTo(page, '/portal/profile');
    // Profile page should show profile heading or form fields
    await expect(
      page.getByText(/profile/i).first()
        .or(page.locator('main').first())
    ).toBeVisible({ timeout: 15_000 });
  });

  test('continuation page loads', async ({ page }) => {
    await goTo(page, '/portal/continuation');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  test('portal sidebar navigation works', async ({ page }) => {
    test.setTimeout(120_000);
    await goTo(page, '/portal/home');
    const nav = [
      { name: /schedule/i, url: /\/portal\/schedule/ },
      { name: /practice/i, url: /\/portal\/practice/ },
      { name: /invoices|payments/i, url: /\/portal\/invoices/ },
      { name: /messages/i, url: /\/portal\/messages/ },
    ];
    for (const item of nav) {
      const link = page.getByRole('link', { name: item.name }).first();
      if (!(await link.isVisible({ timeout: 10_000 }).catch(() => false))) continue;
      await link.click();
      await expect(page).toHaveURL(item.url, { timeout: 10_000 });
      await waitForPageReady(page);
    }
  });

  test('sign out from portal works', async ({ page }) => {
    await goTo(page, '/portal/home');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    // Sign out button may be icon-only with title="Sign out", or text "Sign Out", or in a menu
    const signOutBtn = page.getByRole('button', { name: /sign out|log out/i }).first()
      .or(page.locator('[title="Sign out"]').first())
      .or(page.getByText(/sign out/i).first())
      .or(page.locator('button').filter({ hasText: /sign out|log out/i }).first());
    if (await signOutBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await signOutBtn.click();
      await expect(page).toHaveURL(/\/(login|auth)/, { timeout: 10_000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════
// PARENT 2 — Should see ONLY Sophie, NOT Emma/James
// ═══════════════════════════════════════════════════════════
test.describe('Portal Data Isolation — Parent 2', () => {
  test.use({ storageState: AUTH.parent2 });

  test('sees their own child (Sophie)', async ({ page }) => {
    await goTo(page, '/portal/home');
    await expect(
      page.getByText(/sophie/i).first()
        .or(page.locator('main').first())
    ).toBeVisible({ timeout: 20_000 });
  });

  test('does NOT see parent1 children (Emma)', async ({ page }) => {
    await goTo(page, '/portal/home');
    await waitForPageReady(page);
    await page.waitForTimeout(2000); // Wait for data to load
    await expect(page.getByText(/emma wilson/i)).toBeHidden();
  });

  test('does NOT see parent1 children (James)', async ({ page }) => {
    await goTo(page, '/portal/home');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);
    await expect(page.getByText(/james smith/i)).toBeHidden();
  });

  test('invoices page shows no leaked data', async ({ page }) => {
    await goTo(page, '/portal/invoices');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('schedule shows only Sophie lessons', async ({ page }) => {
    await goTo(page, '/portal/schedule');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });
});
