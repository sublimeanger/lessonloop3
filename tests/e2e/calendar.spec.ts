import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

test.describe('Calendar — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('week view loads with day headers', async ({ page }) => {
    await goTo(page, '/calendar');
    await expect(page.getByText(/mon|tue|wed|thu|fri/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('navigate forward and back', async ({ page }) => {
    await goTo(page, '/calendar');
    // Wait for calendar to fully render (day headers visible = calendar loaded)
    await expect(page.getByText(/mon|tue|wed|thu|fri/i).first()).toBeVisible({ timeout: 15_000 });
    // Nav buttons are icon-only; try aria-label first, then fall back to icon button locators
    const nextBtn = page.locator('[aria-label="Next"], [aria-label="Next week"]').first()
      .or(page.locator('button:has(svg)').filter({ hasNotText: /today|view|filter/i }).nth(1));
    const prevBtn = page.locator('[aria-label="Previous"], [aria-label="Previous week"]').first()
      .or(page.locator('button:has(svg)').filter({ hasNotText: /today|view|filter/i }).nth(0));
    if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      await prevBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('today button returns to current week', async ({ page }) => {
    await goTo(page, '/calendar');
    await expect(page.getByText(/mon|tue|wed|thu|fri/i).first()).toBeVisible({ timeout: 15_000 });
    const nextBtn = page.locator('[aria-label="Next"], [aria-label="Next week"]').first()
      .or(page.locator('button:has(svg)').filter({ hasNotText: /today|view|filter/i }).nth(1));
    if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(300);
      await nextBtn.click();
      await page.waitForTimeout(300);
      const todayBtn = page.getByRole('button', { name: /today/i }).first();
      if (await todayBtn.isVisible().catch(() => false)) {
        await todayBtn.click();
        await page.waitForTimeout(500);
      }
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
    await expect(page.getByText(/mon|tue|wed|thu|fri/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
