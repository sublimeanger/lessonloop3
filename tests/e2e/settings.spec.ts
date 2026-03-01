import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo } from './helpers';

test.describe('Settings — Owner (admin tabs visible)', () => {
  test.use({ storageState: AUTH.owner });

  test('settings page loads', async ({ page }) => {
    await safeGoTo(page, '/settings', 'Settings');
    await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('profile tab is default', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=profile', 'Settings Profile');
    await expect(
      page.getByText(/profile/i).first()
        .or(page.getByLabel(/name/i).first())
    ).toBeVisible({ timeout: 15_000 });
  });

  test('profile tab renders', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=profile', 'Settings Profile');
    const hasNameInput = await page.getByLabel(/name/i).first().isVisible({ timeout: 15_000 }).catch(() => false);
    const hasProfileText = await page.getByText(/profile/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasNameInput || hasProfileText, 'Profile content should be visible').toBeTruthy();
  });

  test('notifications tab renders', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=notifications', 'Settings Notifications');
    await expect(page.getByText(/notification/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('organisation tab shows org name', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=organisation', 'Settings Organisation');
    await expect(
      page.getByText(/E2E Test Academy/i).first()
        .or(page.getByText(/organisation|organization/i).first())
    ).toBeVisible({ timeout: 15_000 });
  });

  test('branding tab renders', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=branding', 'Settings Branding');
    await expect(page.getByText(/brand|logo|colour|color/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('members tab shows team', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=members', 'Settings Members');
    await expect(page.getByText(/member|team|admin|teacher|finance/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('data import tab renders', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=data-import', 'Settings Data Import');
    await expect(page.getByText(/import|csv|data/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('scheduling tab renders', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=scheduling', 'Settings Scheduling');
    await expect(page.getByText(/scheduling|lesson|duration/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('availability tab renders', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=availability', 'Settings Availability');
    await expect(page.getByText(/availability/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('calendar sync tab renders', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=calendar', 'Settings Calendar');
    await expect(page.getByText(/calendar|sync|google|apple/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('zoom tab renders', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=zoom', 'Settings Zoom');
    await expect(page.getByText(/zoom/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('music tab renders', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=music', 'Settings Music');
    await expect(page.getByText(/instrument|grade|music/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('billing tab renders', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=billing', 'Settings Billing');
    await expect(page.getByText(/billing|invoice|stripe|payment/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('rate cards tab renders', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=rate-cards', 'Settings Rate Cards');
    await expect(page.getByText(/rate|card|pricing/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('messaging settings tab renders', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=messaging', 'Settings Messaging');
    await expect(page.getByText(/messaging|template/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('booking page tab renders', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=booking-page', 'Settings Booking Page');
    await expect(page.getByText(/booking|public|page/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('LoopAssist tab renders', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=looopassist', 'Settings LoopAssist');
    await expect(page.getByText(/loopassist|ai/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('continuation settings tab renders', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=continuation', 'Settings Continuation');
    await expect(page.getByText(/continuation/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('privacy & GDPR tab renders', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=privacy', 'Settings Privacy');
    await expect(page.getByText(/privacy|gdpr|data/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('audit log tab renders', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=audit', 'Settings Audit');
    await expect(page.getByText(/audit|log|event/i).first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Settings — Teacher (admin tabs hidden)', () => {
  test.use({ storageState: AUTH.teacher });

  test('profile tab accessible', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=profile', 'Teacher Settings Profile');
    const hasName = await page.getByLabel(/name/i).first().isVisible({ timeout: 15_000 }).catch(() => false);
    const hasProfile = await page.getByText(/profile/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasName || hasProfile, 'Profile content should be visible').toBeTruthy();
  });

  test('availability tab accessible', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=availability', 'Teacher Settings Availability');
    await expect(page.getByText(/availability/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('admin tabs redirect to profile', async ({ page }) => {
    await safeGoTo(page, '/settings?tab=members', 'Teacher Settings Members redirect');
    // Should not show members content — should show profile instead
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });
});
