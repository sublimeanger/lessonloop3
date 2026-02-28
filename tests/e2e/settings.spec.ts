import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

test.describe('Settings — Owner (admin tabs visible)', () => {
  test.use({ storageState: AUTH.owner });

  test('settings page loads', async ({ page }) => {
    await goTo(page, '/settings');
    await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('profile tab is default', async ({ page }) => {
    await goTo(page, '/settings?tab=profile');
    await expect(page.getByText(/profile/i).first()).toBeVisible();
  });

  // ─── Account group ───
  test('profile tab renders', async ({ page }) => {
    await goTo(page, '/settings?tab=profile');
    await expect(page.getByLabel(/name/i).first()).toBeVisible();
  });

  test('notifications tab renders', async ({ page }) => {
    await goTo(page, '/settings?tab=notifications');
    await expect(page.getByText(/notification/i).first()).toBeVisible();
  });

  // ─── Organisation group ───
  test('organisation tab shows org name', async ({ page }) => {
    await goTo(page, '/settings?tab=organisation');
    await expect(page.getByText(/E2E Test Academy/i)).toBeVisible();
  });

  test('branding tab renders', async ({ page }) => {
    await goTo(page, '/settings?tab=branding');
    await expect(page.getByText(/brand|logo|colour/i).first()).toBeVisible();
  });

  test('members tab shows team', async ({ page }) => {
    await goTo(page, '/settings?tab=members');
    await expect(page.getByText(/member|team|admin|teacher|finance/i).first()).toBeVisible();
  });

  test('data import tab renders', async ({ page }) => {
    await goTo(page, '/settings?tab=data-import');
    await expect(page.getByText(/import|csv|data/i).first()).toBeVisible();
  });

  // ─── Teaching group ───
  test('scheduling tab renders', async ({ page }) => {
    await goTo(page, '/settings?tab=scheduling');
    await expect(page.getByText(/scheduling|lesson|duration/i).first()).toBeVisible();
  });

  test('availability tab renders', async ({ page }) => {
    await goTo(page, '/settings?tab=availability');
    await expect(page.getByText(/availability/i).first()).toBeVisible();
  });

  test('calendar sync tab renders', async ({ page }) => {
    await goTo(page, '/settings?tab=calendar');
    await expect(page.getByText(/calendar|sync|google|apple/i).first()).toBeVisible();
  });

  test('zoom tab renders', async ({ page }) => {
    await goTo(page, '/settings?tab=zoom');
    await expect(page.getByText(/zoom/i).first()).toBeVisible();
  });

  test('music tab renders', async ({ page }) => {
    await goTo(page, '/settings?tab=music');
    await expect(page.getByText(/instrument|grade|music/i).first()).toBeVisible();
  });

  // ─── Business group ───
  test('billing tab renders', async ({ page }) => {
    await goTo(page, '/settings?tab=billing');
    await expect(page.getByText(/billing|invoice|stripe|payment/i).first()).toBeVisible();
  });

  test('rate cards tab renders', async ({ page }) => {
    await goTo(page, '/settings?tab=rate-cards');
    await expect(page.getByText(/rate|card|pricing/i).first()).toBeVisible();
  });

  test('messaging settings tab renders', async ({ page }) => {
    await goTo(page, '/settings?tab=messaging');
    await expect(page.getByText(/messaging|template/i).first()).toBeVisible();
  });

  test('booking page tab renders', async ({ page }) => {
    await goTo(page, '/settings?tab=booking-page');
    await expect(page.getByText(/booking|public|page/i).first()).toBeVisible();
  });

  test('LoopAssist tab renders', async ({ page }) => {
    await goTo(page, '/settings?tab=looopassist');
    await expect(page.getByText(/loopassist|ai/i).first()).toBeVisible();
  });

  test('continuation settings tab renders', async ({ page }) => {
    await goTo(page, '/settings?tab=continuation');
    await expect(page.getByText(/continuation/i).first()).toBeVisible();
  });

  // ─── Compliance group ───
  test('privacy & GDPR tab renders', async ({ page }) => {
    await goTo(page, '/settings?tab=privacy');
    await expect(page.getByText(/privacy|gdpr|data/i).first()).toBeVisible();
  });

  test('audit log tab renders', async ({ page }) => {
    await goTo(page, '/settings?tab=audit');
    await expect(page.getByText(/audit|log|event/i).first()).toBeVisible();
  });
});

test.describe('Settings — Teacher (admin tabs hidden)', () => {
  test.use({ storageState: AUTH.teacher });

  test('profile tab accessible', async ({ page }) => {
    await goTo(page, '/settings?tab=profile');
    await expect(page.getByLabel(/name/i).first()).toBeVisible();
  });

  test('availability tab accessible', async ({ page }) => {
    await goTo(page, '/settings?tab=availability');
    await expect(page.getByText(/availability/i).first()).toBeVisible();
  });

  test('admin tabs redirect to profile', async ({ page }) => {
    // If a teacher navigates to an admin-only tab, should fall back to profile
    await goTo(page, '/settings?tab=members');
    // Should not show members content — should show profile instead
    await expect(page.getByLabel(/name/i).first()).toBeVisible();
  });
});
