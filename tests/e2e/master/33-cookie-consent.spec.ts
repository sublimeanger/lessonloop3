/**
 * 33 — Cookie consent banner (GDPR / UK DPA)
 * Maps to: cross-cutting Cookie consent banner row in audit/MASTER.md.
 *
 * Verifies the s25 cookie consent banner renders + writes the ll-consent
 * cookie + dismisses on user action. Native (Capacitor) builds skip the
 * banner per Apple/Google ToS handling consent in store flow — these tests
 * run on the desktop-chrome / mobile-safari (web) projects only.
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('§33 — Cookie consent banner (s25 launch blocker close)', () => {
  test('cookie banner visible on cold visit (no prior consent)', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const banner = page.locator('[data-testid="cookie-consent-banner"]');
    await expect(banner).toBeVisible({ timeout: 10000 });
    const text = (await banner.textContent()) ?? '';
    expect(text.toLowerCase()).toContain('cookie');
    expect(text.toLowerCase()).toMatch(/accept all|essential only|manage/);
  });

  test('Accept all sets ll-consent cookie + dismisses banner', async ({ page, context }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await page.locator('[data-testid="cookie-consent-accept-all"]').click();
    await page.waitForTimeout(500);
    const banner = page.locator('[data-testid="cookie-consent-banner"]');
    await expect(banner).toBeHidden();
    const cookies = await context.cookies();
    const consent = cookies.find((c) => c.name === 'll-consent');
    expect(consent).toBeDefined();
    expect(decodeURIComponent(consent?.value ?? '')).toContain('analytics');
  });

  test('Essential only sets analytics=false + marketing=false', async ({ page, context }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await page.locator('[data-testid="cookie-consent-essential"]').click();
    await page.waitForTimeout(500);
    const cookies = await context.cookies();
    const consent = cookies.find((c) => c.name === 'll-consent');
    expect(consent).toBeDefined();
    const decoded = decodeURIComponent(consent?.value ?? '');
    expect(decoded).toContain('"analytics":false');
    expect(decoded).toContain('"marketing":false');
  });
});
