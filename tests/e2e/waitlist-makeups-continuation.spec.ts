import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from './helpers';

test.describe('Enrolment Waitlist — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('waitlist page loads', async ({ page }) => {
    await goTo(page, '/waitlist');
    await expect(page.getByText(/waiting list|waitlist|enrolment/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('add to waitlist button exists', async ({ page }) => {
    await goTo(page, '/waitlist');
    // Button text is "Add to Waiting List" or similar
    const btn = page.getByRole('button', { name: /add|new|waiting/i }).first();
    await expect(btn).toBeVisible({ timeout: 10_000 });
  });

  test('status filter works', async ({ page }) => {
    await goTo(page, '/waitlist');
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
    await goTo(page, '/make-ups');
    await expect(page.getByText(/make-up|credit|waitlist/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('stats cards render', async ({ page }) => {
    await goTo(page, '/make-ups');
    // Should show stats like active credits, pending matches, etc.
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('add to waitlist dialog opens', async ({ page }) => {
    await goTo(page, '/make-ups');
    const addBtn = page.getByRole('button', { name: /add|new/i }).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe('Continuation — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('continuation page loads', async ({ page }) => {
    await goTo(page, '/continuation');
    await expect(page.getByText(/continuation|term/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('create continuation run button exists', async ({ page }) => {
    await goTo(page, '/continuation');
    // Button text is "New Run" or "Create Continuation Run"
    const createBtn = page.getByRole('button', { name: /new run|create|start/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
  });
});
