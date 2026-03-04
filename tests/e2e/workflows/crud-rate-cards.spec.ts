import { test, expect } from '@playwright/test';
import { AUTH, goTo } from '../helpers';
import { supabaseDelete, getOrgId } from '../supabase-admin';

const testId = `e2e-${Date.now()}`;

test.describe('Rate Card CRUD — Owner', () => {
  test.use({ storageState: AUTH.owner });
  test.describe.configure({ mode: 'serial' });

  const cardName = `E2E Rate ${testId}`;
  const updatedAmount = '30';

  test.afterAll(() => {
    const orgId = getOrgId();
    if (!orgId) return;
    const encodedPrefix = encodeURIComponent(`%${testId}%`);
    supabaseDelete('rate_cards', `org_id=eq.${orgId}&name=like.${encodedPrefix}`);
  });

  test('view rate cards page', async ({ page }) => {
    await goTo(page, '/settings?tab=rate-cards');
    await page.waitForTimeout(2_000);

    // RateCardsTab renders "Rate Cards" title
    await expect(page.getByText('Rate Cards').first()).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('button', { name: /Add Rate Card/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('create a rate card', async ({ page }) => {
    await goTo(page, '/settings?tab=rate-cards');
    await page.waitForTimeout(2_000);

    await page.getByRole('button', { name: /Add Rate Card/i }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Fill name (label "Name", id="name")
    await dialog.locator('#name').fill(cardName);

    // Duration select — default is 30 min, which is fine

    // Fill rate (label "Rate (£)", id="rate")
    await dialog.locator('#rate').fill('25');

    // Submit
    await dialog.getByRole('button', { name: /Create Rate Card/i }).click();

    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Verify card in list (table cell with card name)
    await expect(page.getByText(cardName).first()).toBeVisible({ timeout: 10_000 });
  });

  test('edit rate card amount', async ({ page }) => {
    await goTo(page, '/settings?tab=rate-cards');
    await page.waitForTimeout(2_000);

    await expect(page.getByText(cardName).first()).toBeVisible({ timeout: 15_000 });

    // Click edit button (aria-label="Edit rate card <name>")
    await page.getByRole('button', { name: `Edit rate card ${cardName}` }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Change rate to £30
    const rateInput = dialog.locator('#rate');
    await rateInput.clear();
    await rateInput.fill(updatedAmount);

    await dialog.getByRole('button', { name: /Save changes/i }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Verify the updated amount appears (formatted as £30.00)
    await expect(page.getByText('£30.00').first()).toBeVisible({ timeout: 10_000 });
  });

  test('delete rate card', async ({ page }) => {
    await goTo(page, '/settings?tab=rate-cards');
    await page.waitForTimeout(2_000);

    await expect(page.getByText(cardName).first()).toBeVisible({ timeout: 15_000 });

    // Click delete button (aria-label="Delete rate card <name>")
    await page.getByRole('button', { name: `Delete rate card ${cardName}` }).click();

    // AlertDialog confirmation
    const alertDialog = page.getByRole('alertdialog');
    await expect(alertDialog).toBeVisible({ timeout: 5_000 });
    await alertDialog.getByRole('button', { name: /Delete/i }).click();

    // Verify removed
    await page.waitForTimeout(2_000);
    const stillVisible = await page.getByText(cardName).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);
    expect(stillVisible).toBe(false);
  });
});
