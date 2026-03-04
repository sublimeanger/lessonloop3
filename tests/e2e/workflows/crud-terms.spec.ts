import { test, expect } from '@playwright/test';
import { AUTH, goTo } from '../helpers';
import { supabaseDelete, getOrgId } from '../supabase-admin';

const testId = `e2e-${Date.now()}`;

test.describe('Term Management — Owner', () => {
  test.use({ storageState: AUTH.owner });
  test.describe.configure({ mode: 'serial' });

  let createdTermName = `E2E Term ${testId}`;
  const updatedTermName = `E2E Term ${testId} Updated`;

  // Calculate dates: 1st of next month, 3 months later
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const threeMonthsLater = new Date(now.getFullYear(), now.getMonth() + 4, 1);
  const startDate = nextMonth.toISOString().split('T')[0];
  const endDate = threeMonthsLater.toISOString().split('T')[0];

  test.afterAll(() => {
    const orgId = getOrgId();
    if (!orgId) return;
    const encodedPrefix = encodeURIComponent(`%${testId}%`);
    supabaseDelete('terms', `org_id=eq.${orgId}&name=like.${encodedPrefix}`);
    supabaseDelete('closure_dates', `org_id=eq.${orgId}&reason=like.${encodedPrefix}`);
  });

  test('view terms list on scheduling tab', async ({ page }) => {
    await goTo(page, '/settings?tab=scheduling');
    await page.waitForTimeout(2_000);

    // TermManagementCard renders "Terms" heading
    await expect(page.getByText('Terms').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Add Term/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('create a new term', async ({ page }) => {
    await goTo(page, '/settings?tab=scheduling');
    await page.waitForTimeout(2_000);

    await page.getByRole('button', { name: /Add Term/i }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await dialog.getByLabel('Term Name').fill(createdTermName);
    await dialog.getByLabel('Start Date').fill(startDate);
    await dialog.getByLabel('End Date').fill(endDate);
    await dialog.getByRole('button', { name: /Create Term/i }).click();

    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(createdTermName).first()).toBeVisible({ timeout: 10_000 });
  });

  test('edit the created term', async ({ page }) => {
    await goTo(page, '/settings?tab=scheduling');
    await page.waitForTimeout(2_000);

    await expect(page.getByText(createdTermName).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: `Edit term ${createdTermName}` }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const nameInput = dialog.getByLabel('Term Name');
    await nameInput.clear();
    await nameInput.fill(updatedTermName);

    await dialog.getByRole('button', { name: /Save changes/i }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(updatedTermName).first()).toBeVisible({ timeout: 10_000 });
    createdTermName = updatedTermName;
  });

  test('add closure date', async ({ page }) => {
    await goTo(page, '/settings?tab=scheduling');
    await page.waitForTimeout(2_000);

    await page.getByRole('button', { name: /Add Closure/i }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Pick a date from the calendar popover
    const datePickerBtn = dialog.getByRole('button', { name: /Pick a date/i }).first();
    if (await datePickerBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await datePickerBtn.click();
      await page.waitForTimeout(500);
      const day = page.getByRole('gridcell', { name: '15' }).first();
      if (await day.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await day.click();
      }
      await page.waitForTimeout(300);
    }

    // Fill reason
    await dialog.getByLabel('Reason')
      .or(dialog.getByPlaceholder(/Bank Holiday|Staff Training/i))
      .first().fill(`E2E Closure ${testId}`);

    await dialog.getByRole('button', { name: /Add Closures/i }).click();
    await page.waitForTimeout(2_000);

    await expect(page.getByText(`E2E Closure ${testId}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test('delete the created term', async ({ page }) => {
    await goTo(page, '/settings?tab=scheduling');
    await page.waitForTimeout(2_000);

    await expect(page.getByText(createdTermName).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: `Delete term ${createdTermName}` }).click();

    // Confirm in AlertDialog
    const alertDialog = page.getByRole('alertdialog');
    await expect(alertDialog).toBeVisible({ timeout: 5_000 });
    await alertDialog.getByRole('button', { name: /Delete/i }).click();

    await page.waitForTimeout(2_000);
    const stillVisible = await page.getByText(createdTermName).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);
    expect(stillVisible).toBe(false);
  });
});
