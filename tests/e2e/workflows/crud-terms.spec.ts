import { test, expect, Page, Locator } from '@playwright/test';
import { AUTH, goTo } from '../helpers';
import { supabaseDelete, getOrgId } from '../supabase-admin';

const testId = `e2e-${Date.now()}`;

/**
 * Tab-label map for navigating settings via sidebar button clicks.
 */
const TAB_LABELS: Record<string, string> = {
  scheduling: 'Scheduling',
  'rate-cards': 'Rate Cards',
  availability: 'Availability',
  music: 'Music',
  notifications: 'Notifications',
  members: 'Members',
  audit: 'Audit Log',
  privacy: 'Privacy & GDPR',
  messaging: 'Messaging',
};

/**
 * Reliably navigate to a settings tab using client-side navigation only.
 * page.goto() triggers a full page reload which races with the RouteGuard,
 * so we click through the UI sidebar and settings nav instead.
 */
async function goToSettingsTab(page: Page, tab: string) {
  await goTo(page, '/dashboard');
  await page.waitForTimeout(2_000);
  // Click the Settings sidebar link (client-side nav preserves auth/org state)
  await page.getByRole('link', { name: 'Settings' }).first().click();
  await page.waitForTimeout(3_000);
  // Click the specific tab button in the settings sidebar nav
  const tabLabel = TAB_LABELS[tab] || tab;
  const tabBtn = page.getByRole('button', { name: tabLabel, exact: true }).first();
  if (await tabBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await tabBtn.click();
    await page.waitForTimeout(2_000);
  }
}

/**
 * Scope locator to the visible desktop settings content area.
 * The settings layout renders content twice (mobile + desktop);
 * .first() would match the hidden mobile copy.
 */
function desktopContent(page: Page): Locator {
  return page.locator('div.hidden.md\\:block');
}

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
    await goToSettingsTab(page, 'scheduling');
    const content = desktopContent(page);

    // Scheduling Settings card should be visible at the top
    await expect(content.getByText('Scheduling Settings').first()).toBeVisible({ timeout: 15_000 });

    // TermManagementCard renders "Terms" heading — scroll into view (below the fold)
    const termsHeading = content.getByRole('heading', { name: 'Terms' });
    await termsHeading.scrollIntoViewIfNeeded();
    await expect(termsHeading).toBeVisible({ timeout: 10_000 });
    await expect(content.getByRole('button', { name: /Add Term/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('create a new term', async ({ page }) => {
    await goToSettingsTab(page, 'scheduling');
    const content = desktopContent(page);

    // Scroll to the Terms section (below the fold)
    const addTermBtn = content.getByRole('button', { name: /Add Term/i }).first();
    await addTermBtn.scrollIntoViewIfNeeded();
    await addTermBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Labels aren't linked via htmlFor — use placeholder/position locators
    await dialog.getByPlaceholder(/Autumn Term/).fill(createdTermName);
    await dialog.locator('input[type="date"]').first().fill(startDate);
    await dialog.locator('input[type="date"]').last().fill(endDate);
    await dialog.getByRole('button', { name: /Create Term/i }).click();

    await expect(dialog).toBeHidden({ timeout: 10_000 });
    const termText = content.getByText(createdTermName).first();
    await termText.scrollIntoViewIfNeeded();
    await expect(termText).toBeVisible({ timeout: 10_000 });
  });

  test('edit the created term', async ({ page }) => {
    await goToSettingsTab(page, 'scheduling');
    const content = desktopContent(page);

    const termText = content.getByText(createdTermName).first();
    await termText.scrollIntoViewIfNeeded();
    await expect(termText).toBeVisible({ timeout: 15_000 });
    await content.getByRole('button', { name: `Edit term ${createdTermName}` }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Labels aren't linked via htmlFor — use first textbox (term name)
    const nameInput = dialog.getByRole('textbox').first();
    await nameInput.clear();
    await nameInput.fill(updatedTermName);

    await dialog.getByRole('button', { name: /Save changes/i }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    const updatedText = content.getByText(updatedTermName).first();
    await updatedText.scrollIntoViewIfNeeded();
    await expect(updatedText).toBeVisible({ timeout: 10_000 });
    createdTermName = updatedTermName;
  });

  test('add closure date', async ({ page }) => {
    await goToSettingsTab(page, 'scheduling');
    const content = desktopContent(page);

    const addClosureBtn = content.getByRole('button', { name: /Add Closure/i }).first();
    await addClosureBtn.scrollIntoViewIfNeeded();
    await addClosureBtn.click();

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

    const closureText = content.getByText(`E2E Closure ${testId}`).first();
    await closureText.scrollIntoViewIfNeeded();
    await expect(closureText).toBeVisible({ timeout: 10_000 });
  });

  test('delete the created term', async ({ page }) => {
    await goToSettingsTab(page, 'scheduling');
    const content = desktopContent(page);

    const termText = content.getByText(createdTermName).first();
    await termText.scrollIntoViewIfNeeded();
    await expect(termText).toBeVisible({ timeout: 15_000 });
    await content.getByRole('button', { name: `Delete term ${createdTermName}` }).click();

    // Confirm in AlertDialog
    const alertDialog = page.getByRole('alertdialog');
    await expect(alertDialog).toBeVisible({ timeout: 5_000 });
    await alertDialog.getByRole('button', { name: /Delete/i }).click();

    await page.waitForTimeout(2_000);
    const stillVisible = await content.getByText(createdTermName).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);
    expect(stillVisible).toBe(false);
  });
});
