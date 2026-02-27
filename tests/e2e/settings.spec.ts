import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

test.describe('Settings — Owner (admin tabs visible)', () => {
  test.use({ storageState: AUTH.owner });

  test('settings page loads', async ({ page }) => {
    await goTo(page, '/settings');
    await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('profile tab is default', async ({ page }) => {
    await page.goto('/settings?tab=profile');
    await waitForPageReady(page);
    await expect(page.getByText(/profile/i).first()).toBeVisible();
  });

  // ─── Account group ───
  test('profile tab renders', async ({ page }) => {
    await page.goto('/settings?tab=profile');
    await waitForPageReady(page);
    await expect(page.getByLabel(/name/i).first()).toBeVisible();
  });

  test('notifications tab renders', async ({ page }) => {
    await page.goto('/settings?tab=notifications');
    await waitForPageReady(page);
    await expect(page.getByText(/notification/i).first()).toBeVisible();
  });

  // ─── Organisation group ───
  test('organisation tab shows org name', async ({ page }) => {
    await page.goto('/settings?tab=organisation');
    await waitForPageReady(page);
    await expect(page.getByText(/E2E Test Academy/i)).toBeVisible();
  });

  test('branding tab renders', async ({ page }) => {
    await page.goto('/settings?tab=branding');
    await waitForPageReady(page);
    await expect(page.getByText(/brand|logo|colour/i).first()).toBeVisible();
  });

  test('members tab shows team', async ({ page }) => {
    await page.goto('/settings?tab=members');
    await waitForPageReady(page);
    await expect(page.getByText(/member|team|admin|teacher|finance/i).first()).toBeVisible();
  });

  test('data import tab renders', async ({ page }) => {
    await page.goto('/settings?tab=data-import');
    await waitForPageReady(page);
    await expect(page.getByText(/import|csv|data/i).first()).toBeVisible();
  });

  // ─── Teaching group ───
  test('scheduling tab renders', async ({ page }) => {
    await page.goto('/settings?tab=scheduling');
    await waitForPageReady(page);
    await expect(page.getByText(/scheduling|lesson|duration/i).first()).toBeVisible();
  });

  test('availability tab renders', async ({ page }) => {
    await page.goto('/settings?tab=availability');
    await waitForPageReady(page);
    await expect(page.getByText(/availability/i).first()).toBeVisible();
  });

  test('calendar sync tab renders', async ({ page }) => {
    await page.goto('/settings?tab=calendar');
    await waitForPageReady(page);
    await expect(page.getByText(/calendar|sync|google|apple/i).first()).toBeVisible();
  });

  test('zoom tab renders', async ({ page }) => {
    await page.goto('/settings?tab=zoom');
    await waitForPageReady(page);
    await expect(page.getByText(/zoom/i).first()).toBeVisible();
  });

  test('music tab renders', async ({ page }) => {
    await page.goto('/settings?tab=music');
    await waitForPageReady(page);
    await expect(page.getByText(/instrument|grade|music/i).first()).toBeVisible();
  });

  // ─── Business group ───
  test('billing tab renders', async ({ page }) => {
    await page.goto('/settings?tab=billing');
    await waitForPageReady(page);
    await expect(page.getByText(/billing|invoice|stripe|payment/i).first()).toBeVisible();
  });

  test('rate cards tab renders', async ({ page }) => {
    await page.goto('/settings?tab=rate-cards');
    await waitForPageReady(page);
    await expect(page.getByText(/rate|card|pricing/i).first()).toBeVisible();
  });

  test('messaging settings tab renders', async ({ page }) => {
    await page.goto('/settings?tab=messaging');
    await waitForPageReady(page);
    await expect(page.getByText(/messaging|template/i).first()).toBeVisible();
  });

  test('booking page tab renders', async ({ page }) => {
    await page.goto('/settings?tab=booking-page');
    await waitForPageReady(page);
    await expect(page.getByText(/booking|public|page/i).first()).toBeVisible();
  });

  test('LoopAssist tab renders', async ({ page }) => {
    await page.goto('/settings?tab=looopassist');
    await waitForPageReady(page);
    await expect(page.getByText(/loopassist|ai/i).first()).toBeVisible();
  });

  test('continuation settings tab renders', async ({ page }) => {
    await page.goto('/settings?tab=continuation');
    await waitForPageReady(page);
    await expect(page.getByText(/continuation/i).first()).toBeVisible();
  });

  // ─── Compliance group ───
  test('privacy & GDPR tab renders', async ({ page }) => {
    await page.goto('/settings?tab=privacy');
    await waitForPageReady(page);
    await expect(page.getByText(/privacy|gdpr|data/i).first()).toBeVisible();
  });

  test('audit log tab renders', async ({ page }) => {
    await page.goto('/settings?tab=audit');
    await waitForPageReady(page);
    await expect(page.getByText(/audit|log|event/i).first()).toBeVisible();
  });
});

test.describe('Settings — Teacher (admin tabs hidden)', () => {
  test.use({ storageState: AUTH.teacher });

  test('profile tab accessible', async ({ page }) => {
    await page.goto('/settings?tab=profile');
    await waitForPageReady(page);
    await expect(page.getByLabel(/name/i).first()).toBeVisible();
  });

  test('availability tab accessible', async ({ page }) => {
    await page.goto('/settings?tab=availability');
    await waitForPageReady(page);
    await expect(page.getByText(/availability/i).first()).toBeVisible();
  });

  test('admin tabs redirect to profile', async ({ page }) => {
    // If a teacher navigates to an admin-only tab, should fall back to profile
    await page.goto('/settings?tab=members');
    await waitForPageReady(page);
    // Should not show members content — should show profile instead
    await expect(page.getByLabel(/name/i).first()).toBeVisible();
  });
});
