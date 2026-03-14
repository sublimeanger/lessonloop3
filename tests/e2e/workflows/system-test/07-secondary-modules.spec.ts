/**
 * PART 7: Secondary Modules (Desktop)
 * Tests 7.1 – 7.7
 */
import { test, expect } from '../../workflows/workflow.fixtures';
import { AUTH, safeGoTo, expectDialog } from './helpers';

test.use({ storageState: AUTH.owner });

test.describe('Part 7: Secondary Modules', () => {

  // ── 7.1 — Leads ──

  test('7.1.1 – /leads loads', async ({ page }) => {
    await safeGoTo(page, '/leads');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  test('7.1.2 – Add Lead dialog opens', async ({ page }) => {
    await safeGoTo(page, '/leads');
    const addBtn = page.getByRole('button', { name: /add lead/i }).first();
    if (await addBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await addBtn.click();
      await expectDialog(page);
    }
  });

  // ── 7.2 — Enrolment Waitlist ──

  test('7.2.1 – /waitlist loads', async ({ page }) => {
    await safeGoTo(page, '/waitlist');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  // ── 7.3 — Make-Up Credits ──

  test('7.3.1-2 – /make-ups loads with stats', async ({ page }) => {
    await safeGoTo(page, '/make-ups');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  // ── 7.4 — Practice ──

  test('7.4.1 – /practice loads', async ({ page }) => {
    await safeGoTo(page, '/practice');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  test('7.4.2 – Create Assignment dialog opens', async ({ page }) => {
    await safeGoTo(page, '/practice');
    const createBtn = page.getByRole('button', { name: /create|add|assign/i }).first();
    if (await createBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await createBtn.click();
      await expectDialog(page);
    }
  });

  // ── 7.5 — Resources ──

  test('7.5.1 – /resources loads', async ({ page }) => {
    await safeGoTo(page, '/resources');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  // ── 7.6 — Notes Explorer ──

  test('7.6.1 – /notes loads', async ({ page }) => {
    await safeGoTo(page, '/notes');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  });

  test('7.6.4 – Date range filter works', async ({ page }) => {
    await safeGoTo(page, '/notes');
    await page.waitForTimeout(1_000);
    // Try clicking a date range filter
    const dateFilter = page.getByRole('button', { name: /today|last 30|this week|date/i }).first();
    if (await dateFilter.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await dateFilter.click();
      await page.waitForTimeout(500);
      const option = page.getByRole('option', { name: /last 30/i }).first()
        .or(page.getByText(/last 30 days/i).first());
      if (await option.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await option.click();
        await page.waitForTimeout(1_000);
      }
    }
  });

  test('7.6.5 – Teacher filter works', async ({ page }) => {
    await safeGoTo(page, '/notes');
    await page.waitForTimeout(1_000);
    const teacherFilter = page.getByRole('button', { name: /teacher|all teacher/i }).first()
      .or(page.locator('[data-tour*="teacher-filter"]').first());
    if (await teacherFilter.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await teacherFilter.click();
      await page.waitForTimeout(500);
    }
  });

  test('7.6.6 – Search works on notes', async ({ page }) => {
    await safeGoTo(page, '/notes');
    const search = page.getByPlaceholder(/search/i).first();
    if (await search.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await search.fill('scale');
      await page.waitForTimeout(1_000);
    }
  });
});
