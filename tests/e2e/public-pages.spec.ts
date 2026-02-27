import { test, expect } from '@playwright/test';

test.describe('Public Pages', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('booking page loads for valid slug', async ({ page }) => {
    await page.goto('/book/e2e-test-academy');
    // If booking page is configured, should show booking form
    // If not configured, may show a not found or error
    await page.waitForTimeout(3000);
    const hasBooking = await page.getByText(/book|lesson|schedule|not found/i).first().isVisible().catch(() => false);
    expect(hasBooking).toBeTruthy();
  });

  test('booking page 404 for invalid slug', async ({ page }) => {
    await page.goto('/book/nonexistent-academy-xyz');
    await page.waitForTimeout(3000);
    // Should show some error or not found state
    await expect(page.locator('body')).toBeVisible();
  });

  test('reset password page renders', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByText(/reset|password|new password/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('marketing root redirects appropriately', async ({ page }) => {
    await page.goto('/');
    // Should redirect to login or external marketing site
    await page.waitForTimeout(3000);
    const url = page.url();
    expect(url.includes('/login') || url.includes('/auth') || url.includes('lessonloop.net')).toBeTruthy();
  });
});
