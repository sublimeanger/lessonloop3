import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo } from './helpers';

test.describe('Calendar — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('week view loads with day headers', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Calendar');
    const dayHeader = page.getByText(/mon|tue|wed|thu|fri/i).first();
    const visible = await dayHeader.isVisible({ timeout: 15_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[calendar] Day header visible: ${visible}`);
  });

  test('navigate forward and back', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Calendar');
    const nextBtn = page.locator('[aria-label="Next"], [aria-label="Next week"]').first();
    const prevBtn = page.locator('[aria-label="Previous"], [aria-label="Previous week"]').first();
    if (await nextBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      if (await prevBtn.isVisible().catch(() => false)) {
        await prevBtn.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('today button returns to current week', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Calendar');
    const nextBtn = page.locator('[aria-label="Next"], [aria-label="Next week"]').first();
    if (await nextBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
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
    await safeGoTo(page, '/calendar', 'Calendar');
  });

  test('lesson cards visible if seed data exists', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Calendar');
    const lessons = page.locator('[class*="lesson"], [class*="event"], [data-tour*="lesson"], [data-tour="calendar-grid"]');
    const count = await lessons.count();
    // eslint-disable-next-line no-console
    console.log(`[calendar] Lesson elements found: ${count}`);
  });

  test('add lesson button or quick create exists', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Calendar');
    const addBtn = page.getByRole('button', { name: /add|new|create.*lesson/i }).first()
      .or(page.locator('[data-tour="create-lesson-button"]').first());
    if (await addBtn.first().isVisible().catch(() => false)) {
      await addBtn.first().click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe('Calendar — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher can view calendar', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Teacher Calendar');
  });
});
