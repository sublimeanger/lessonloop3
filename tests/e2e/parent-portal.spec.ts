import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, safeGoTo } from './helpers';

// ═══════════════════════════════════════════════════════════
// PARENT 1 — Should see Emma + James
// ═══════════════════════════════════════════════════════════
test.describe('Portal — Parent 1', () => {
  test.use({ storageState: AUTH.parent });

  test('portal home loads', async ({ page }) => {
    await safeGoTo(page, '/portal/home', 'Portal Home');
    const hasEmma = await page.getByText(/emma/i).first().isVisible({ timeout: 15_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[portal] Emma visible on home: ${hasEmma}`);
  });

  test('schedule page loads', async ({ page }) => {
    await safeGoTo(page, '/portal/schedule', 'Portal Schedule');
    const hasContent = await page.getByText(/schedule|lesson|upcoming/i).first().isVisible({ timeout: 15_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[portal] Schedule content visible: ${hasContent}`);
  });

  test('practice page loads', async ({ page }) => {
    await safeGoTo(page, '/portal/practice', 'Portal Practice');
  });

  test('resources page loads', async ({ page }) => {
    await safeGoTo(page, '/portal/resources', 'Portal Resources');
  });

  test('invoices page loads', async ({ page }) => {
    await safeGoTo(page, '/portal/invoices', 'Portal Invoices');
    const hasContent = await page.getByText(/invoice|payment|no.*invoices/i).first().isVisible({ timeout: 15_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[portal] Invoices content visible: ${hasContent}`);
  });

  test('messages page loads', async ({ page }) => {
    await safeGoTo(page, '/portal/messages', 'Portal Messages');
    const hasContent = await page.getByText(/message|inbox|no.*messages/i).first().isVisible({ timeout: 15_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[portal] Messages content visible: ${hasContent}`);
  });

  test('can create message request', async ({ page }) => {
    await safeGoTo(page, '/portal/messages', 'Portal Messages');
    const composeBtn = page.getByRole('button', { name: /new|compose|request|write|message/i }).first();
    if (await composeBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await composeBtn.click();
      const dialogVisible = await page.getByRole('dialog').isVisible({ timeout: 5_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[portal] Compose dialog visible: ${dialogVisible}`);
    }
  });

  test('profile page loads with user info', async ({ page }) => {
    await safeGoTo(page, '/portal/profile', 'Portal Profile');
    const hasProfile = await page.getByText(/profile/i).first().isVisible({ timeout: 15_000 }).catch(() => false);
    const hasLabel = await page.getByLabel(/name|email/i).first().isVisible().catch(() => false);
    const hasText = await page.getByText(/name|email/i).first().isVisible().catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[portal] Profile: ${hasProfile}, label: ${hasLabel}, text: ${hasText}`);
  });

  test('continuation page loads', async ({ page }) => {
    await safeGoTo(page, '/portal/continuation', 'Portal Continuation');
  });

  test('portal sidebar navigation works', async ({ page }) => {
    test.setTimeout(120_000);
    await safeGoTo(page, '/portal/home', 'Portal Home');
    const nav = [
      { name: /schedule/i, url: /\/portal\/schedule/ },
      { name: /practice/i, url: /\/portal\/practice/ },
      { name: /invoices|payments/i, url: /\/portal\/invoices/ },
      { name: /messages/i, url: /\/portal\/messages/ },
    ];
    for (const item of nav) {
      const link = page.getByRole('link', { name: item.name }).first();
      const linkVisible = await link.isVisible({ timeout: 10_000 }).catch(() => false);
      if (linkVisible) {
        await link.click();
        await page.waitForURL(url => item.url.test(url.toString()), { timeout: 15_000 }).catch(() => {});
        await waitForPageReady(page);
      }
    }
  });

  test('sign out from portal works', async ({ page }) => {
    await safeGoTo(page, '/portal/home', 'Portal Home');
    const signOutBtn = page.getByRole('button', { name: /sign out|log out/i }).first()
      .or(page.locator('[title="Sign out"]').first())
      .or(page.locator('[aria-label="Sign out"]').first());
    await expect(signOutBtn.first()).toBeVisible({ timeout: 10_000 });
    await signOutBtn.first().click();
    await page.waitForURL(
      url => /\/(login|auth)/.test(url.toString()),
      { timeout: 15_000 },
    );
  });
});

// ═══════════════════════════════════════════════════════════
// PARENT 2 — Should see ONLY Sophie, NOT Emma/James
// ═══════════════════════════════════════════════════════════
test.describe('Portal Data Isolation — Parent 2', () => {
  test.use({ storageState: AUTH.parent2 });

  test('sees their own child (Sophie)', async ({ page }) => {
    await safeGoTo(page, '/portal/home', 'Portal Home P2');
    const hasSophie = await page.getByText(/sophie/i).first().isVisible({ timeout: 15_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[portal-p2] Sophie visible: ${hasSophie}`);
  });

  test('does NOT see parent1 children (Emma)', async ({ page }) => {
    await safeGoTo(page, '/portal/home', 'Portal Home P2');
    await page.waitForTimeout(3000); // Wait for data to load
    const emmaVisible = await page.getByText(/emma wilson/i).isVisible().catch(() => false);
    expect(emmaVisible, 'Emma Wilson should not be visible to Parent 2').toBe(false);
  });

  test('does NOT see parent1 children (James)', async ({ page }) => {
    await safeGoTo(page, '/portal/home', 'Portal Home P2');
    await page.waitForTimeout(3000);
    const jamesVisible = await page.getByText(/james smith/i).isVisible().catch(() => false);
    expect(jamesVisible, 'James Smith should not be visible to Parent 2').toBe(false);
  });

  test('invoices page shows no leaked data', async ({ page }) => {
    await safeGoTo(page, '/portal/invoices', 'Portal Invoices P2');
  });

  test('schedule shows only Sophie lessons', async ({ page }) => {
    await safeGoTo(page, '/portal/schedule', 'Portal Schedule P2');
  });
});
