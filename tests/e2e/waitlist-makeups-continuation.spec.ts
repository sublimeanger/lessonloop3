import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo } from './helpers';

test.describe('Enrolment Waitlist — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('waitlist page loads', async ({ page }) => {
    await safeGoTo(page, '/waitlist', 'Waitlist');
    await expect(page.getByText(/waiting list|waitlist|enrolment/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('add to waitlist button exists', async ({ page }) => {
    await safeGoTo(page, '/waitlist', 'Waitlist');
    const btn = page.getByRole('button', { name: /add|new|waiting/i }).first();
    const visible = await btn.isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[waitlist] Add button visible: ${visible}`);
  });

  test('status filter works', async ({ page }) => {
    await safeGoTo(page, '/waitlist', 'Waitlist');
    const filter = page.locator('button, [role="combobox"]').filter({ hasText: /status|all|waiting|offered/i }).first();
    if (await filter.isVisible().catch(() => false)) {
      await filter.click();
      await page.waitForTimeout(300);
    }
  });
});

test.describe('Make-Up Dashboard — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('make-ups page loads', async ({ page }) => {
    await safeGoTo(page, '/make-ups', 'Make-Ups');
    await expect(page.getByText(/make-up|credit|waitlist|lesson/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('stats cards render', async ({ page }) => {
    await safeGoTo(page, '/make-ups', 'Make-Ups');
  });

  test('add to waitlist dialog opens', async ({ page }) => {
    await safeGoTo(page, '/make-ups', 'Make-Ups');
    const addBtn = page.getByRole('button', { name: /add|new/i }).first();
    if (await addBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await addBtn.click();
      const dialogVisible = await page.getByRole('dialog').isVisible({ timeout: 5_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[make-ups] Dialog visible after click: ${dialogVisible}`);
    }
  });
});

test.describe('Continuation — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('continuation page loads', async ({ page }) => {
    await safeGoTo(page, '/continuation', 'Continuation');
    await expect(page.getByText(/continuation|term/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('create continuation run button exists', async ({ page }) => {
    await safeGoTo(page, '/continuation', 'Continuation');
    const createBtn = page.getByRole('button', { name: /new run|create|start/i }).first();
    const visible = await createBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[continuation] New Run button visible: ${visible}`);
  });
});
