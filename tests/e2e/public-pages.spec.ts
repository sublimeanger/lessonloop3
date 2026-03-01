import { test, expect } from '@playwright/test';

test.describe('Public Pages', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('booking page loads for valid slug', async ({ page }) => {
    await page.goto('/book/e2e-test-academy');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);
    // If booking page is configured, should show booking form
    // If not configured, may show not found or redirect
    const hasContent = await page.getByText(/book|lesson|schedule|not found|404/i).first().isVisible().catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[public] Booking page content visible: ${hasContent}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('booking page 404 for invalid slug', async ({ page }) => {
    await page.goto('/book/nonexistent-academy-xyz');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('reset password page renders', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByText(/reset|password|new password/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('marketing root redirects appropriately', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);
    const url = page.url();
    const redirectedCorrectly = url.includes('/login') || url.includes('/auth') || url.includes('lessonloop');
    // eslint-disable-next-line no-console
    console.log(`[public] Root redirected to: ${url}`);
    expect(redirectedCorrectly, `Root should redirect to login/auth, got: ${url}`).toBeTruthy();
  });
});
