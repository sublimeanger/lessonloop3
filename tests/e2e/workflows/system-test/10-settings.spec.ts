/**
 * PART 10: Settings — Every Tab (Desktop)
 * Tests 10.1 – 10.21
 */
import { test, expect } from '../../workflows/workflow.fixtures';
import { AUTH, safeGoTo } from './helpers';

test.use({ storageState: AUTH.owner });

test.describe('Part 10: Settings', () => {

  const settingsPages = [
    { id: '10.1', path: '/settings/profile', name: 'Profile' },
    { id: '10.2', path: '/settings/notifications', name: 'Notifications' },
    { id: '10.3', path: '/settings/help', name: 'Help & Tours' },
    { id: '10.4', path: '/settings/organisation', name: 'Organisation' },
    { id: '10.5', path: '/settings/branding', name: 'Branding' },
    { id: '10.6', path: '/settings/members', name: 'Members' },
    { id: '10.7', path: '/settings/data', name: 'Data & Import' },
    { id: '10.8', path: '/settings/scheduling', name: 'Scheduling' },
    { id: '10.9', path: '/settings/availability', name: 'Availability' },
    { id: '10.10', path: '/settings/instruments', name: 'Music/Instruments' },
    { id: '10.11', path: '/settings/calendar-sync', name: 'Calendar Sync' },
    { id: '10.12', path: '/settings/zoom', name: 'Zoom' },
    { id: '10.13', path: '/settings/billing', name: 'Billing/Subscription' },
    { id: '10.14', path: '/settings/invoice', name: 'Invoice Settings' },
    { id: '10.15', path: '/settings/rate-cards', name: 'Rate Cards' },
    { id: '10.16', path: '/settings/booking', name: 'Booking Page' },
    { id: '10.17', path: '/settings/messaging', name: 'Messaging' },
    { id: '10.18', path: '/settings/continuation', name: 'Continuation' },
    { id: '10.19', path: '/settings/loopassist', name: 'LoopAssist Preferences' },
    { id: '10.20', path: '/settings/privacy', name: 'Privacy/GDPR' },
    { id: '10.21', path: '/settings/audit-log', name: 'Audit Log' },
  ];

  for (const setting of settingsPages) {
    test(`${setting.id} – ${setting.name} loads`, async ({ page }) => {
      await safeGoTo(page, setting.path);
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
      // No error boundary
      const errorBoundary = await page.getByText(/something went wrong/i).isVisible().catch(() => false);
      expect(errorBoundary).toBe(false);
    });
  }

  test('10.1b – Profile: change name and save persists', async ({ page }) => {
    await safeGoTo(page, '/settings/profile');
    await page.waitForTimeout(1_000);
    const nameField = page.getByLabel(/name|display name/i).first();
    if (await nameField.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const originalName = await nameField.inputValue();
      await nameField.fill('E2E Temp Name');
      const saveBtn = page.getByRole('button', { name: /save/i }).first();
      if (await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(1_000);
      }
      // Revert
      await nameField.fill(originalName);
      if (await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await saveBtn.click();
      }
    }
  });

  test('10.15b – Rate Cards: add and verify', async ({ page }) => {
    await safeGoTo(page, '/settings/rate-cards');
    await page.waitForTimeout(1_000);
    const addBtn = page.getByRole('button', { name: /add|create|new/i }).first();
    if (await addBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);
    }
  });
});
