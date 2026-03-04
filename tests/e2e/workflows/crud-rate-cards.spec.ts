import { test, expect, Page, Locator } from '@playwright/test';
import { AUTH, goTo } from '../helpers';
import { supabaseDelete, getOrgId } from '../supabase-admin';

const testId = `e2e-${Date.now()}`;

/** Navigate to a settings tab using client-side sidebar clicks. */
async function goToSettingsTab(page: Page, tab: string) {
  await goTo(page, '/dashboard');
  await page.waitForTimeout(2_000);
  await page.getByRole('link', { name: 'Settings' }).first().click();
  await page.waitForTimeout(3_000);
  const labels: Record<string, string> = {
    'rate-cards': 'Rate Cards', scheduling: 'Scheduling',
  };
  const btn = page.getByRole('button', { name: labels[tab] || tab, exact: true }).first();
  if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(2_000);
  }
}

/** Scope to the visible desktop content area (avoids hidden mobile duplicate). */
function desktopContent(page: Page): Locator {
  return page.locator('div.hidden.md\\:block');
}

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
    await goToSettingsTab(page, 'rate-cards');
    const content = desktopContent(page);

    await expect(content.getByText('Rate Cards').first()).toBeVisible({ timeout: 15_000 });
    await expect(
      content.getByRole('button', { name: /Add Rate Card/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('create a rate card', async ({ page }) => {
    await goToSettingsTab(page, 'rate-cards');
    const content = desktopContent(page);

    await content.getByRole('button', { name: /Add Rate Card/i }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await dialog.locator('#name').fill(cardName);
    await dialog.locator('#rate').fill('25');
    await dialog.getByRole('button', { name: /Create Rate Card/i }).click();

    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await expect(content.getByText(cardName).first()).toBeVisible({ timeout: 10_000 });
  });

  test('edit rate card amount', async ({ page }) => {
    await goToSettingsTab(page, 'rate-cards');
    const content = desktopContent(page);

    await expect(content.getByText(cardName).first()).toBeVisible({ timeout: 15_000 });
    await content.getByRole('button', { name: `Edit rate card ${cardName}` }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const rateInput = dialog.locator('#rate');
    await rateInput.clear();
    await rateInput.fill(updatedAmount);

    await dialog.getByRole('button', { name: /Save changes/i }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // formatCurrencyMinor renders whole amounts without decimals (£30 not £30.00)
    await expect(content.getByText(/£30/).first()).toBeVisible({ timeout: 10_000 });
  });

  test('delete rate card', async ({ page }) => {
    await goToSettingsTab(page, 'rate-cards');
    const content = desktopContent(page);

    await expect(content.getByText(cardName).first()).toBeVisible({ timeout: 15_000 });
    await content.getByRole('button', { name: `Delete rate card ${cardName}` }).click();

    const alertDialog = page.getByRole('alertdialog');
    await expect(alertDialog).toBeVisible({ timeout: 5_000 });
    await alertDialog.getByRole('button', { name: /Delete/i }).click();

    await page.waitForTimeout(2_000);
    const stillVisible = await content.getByText(cardName).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);
    expect(stillVisible).toBe(false);
  });
});
