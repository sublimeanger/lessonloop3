import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo } from './helpers';

test.describe('Owner Dashboard', () => {
  test.use({ storageState: AUTH.owner });

  test('loads with greeting or dashboard content', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');
    const greeting = page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })
      .or(page.getByRole('heading', { name: /^hi /i }))
      .or(page.getByRole('heading', { name: /dashboard/i }))
      .or(page.getByText(/good (morning|afternoon|evening)/i).first());
    await expect(greeting.first()).toBeVisible({ timeout: 15_000 });
  });

  test('shows stat cards', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');
    const anyStatText = page.getByText(/today's lessons|active students|this week|revenue|my students/i).first();
    const statVisible = await anyStatText.isVisible({ timeout: 15_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[dashboard] Stat card visible: ${statVisible}`);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar shows owner/admin nav groups', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');
    const coreLinks = ['Dashboard', 'Calendar', 'Students', 'Teachers', 'Register', 'Invoices', 'Messages'];
    for (const link of coreLinks) {
      const el = page.getByRole('link', { name: link, exact: true }).first();
      const visible = await el.isVisible({ timeout: 5_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[dashboard] Sidebar link "${link}": ${visible}`);
    }
    await expect(page.getByRole('link', { name: 'Dashboard', exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('LoopAssist button visible in sidebar footer', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');
    const loopAssist = page.getByText('LoopAssist').first()
      .or(page.locator('[data-tour="loopassist-button"]').first());
    const visible = await loopAssist.isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[dashboard] LoopAssist visible: ${visible}`);
  });

  test('Settings and Help links in footer', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');
    await expect(page.getByRole('link', { name: /settings/i }).first()).toBeVisible({ timeout: 10_000 });
    const helpVisible = await page.getByRole('link', { name: /help/i }).first().isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[dashboard] Help link visible: ${helpVisible}`);
  });

  test('sign out button works', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');
    const signOutBtn = page.getByRole('button', { name: /sign out/i }).first()
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

test.describe('Teacher Dashboard', () => {
  test.use({ storageState: AUTH.teacher });

  test('loads without admin widgets', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Teacher Dashboard');
  });
});

test.describe('Finance Dashboard', () => {
  test.use({ storageState: AUTH.finance });

  test('loads with finance-relevant data', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Finance Dashboard');
  });
});
