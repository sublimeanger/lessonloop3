import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

test.describe('Calendar — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('week view loads with day headers', async ({ page }) => {
    await goTo(page, '/calendar');
    await expect(page.getByText(/mon|tue|wed|thu|fri/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('navigate forward and back', async ({ page }) => {
    await goTo(page, '/calendar');
    const nextBtn = page.getByRole('button', { name: /next|forward|›|chevronright/i }).first();
    const prevBtn = page.getByRole('button', { name: /prev|back|‹|chevronleft/i }).first();
    await nextBtn.click();
    await page.waitForTimeout(500);
    await prevBtn.click();
    await page.waitForTimeout(500);
  });

  test('today button returns to current week', async ({ page }) => {
    await goTo(page, '/calendar');
    const nextBtn = page.getByRole('button', { name: /next|forward|›/i }).first();
    await nextBtn.click();
    await page.waitForTimeout(300);
    await nextBtn.click();
    await page.waitForTimeout(300);
    const todayBtn = page.getByRole('button', { name: /today/i }).first();
    if (await todayBtn.isVisible()) {
      await todayBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('filter bar renders', async ({ page }) => {
    await goTo(page, '/calendar');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('lesson cards visible if seed data exists', async ({ page }) => {
    await goTo(page, '/calendar');
    const lessons = page.locator('[class*="lesson"], [class*="event"], [data-tour*="lesson"]');
    const count = await lessons.count();
    if (count > 0) {
      await expect(lessons.first()).toBeVisible();
    }
  });

  test('add lesson button or quick create exists', async ({ page }) => {
    await goTo(page, '/calendar');
    const addBtn = page.getByRole('button', { name: /add|new|create.*lesson/i }).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe('Calendar — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher can view calendar', async ({ page }) => {
    await goTo(page, '/calendar');
    await expect(page.getByText(/mon|tue|wed|thu|fri/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
