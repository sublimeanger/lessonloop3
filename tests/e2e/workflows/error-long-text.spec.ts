import { test, expect, Page } from '@playwright/test';
import {
  AUTH,
  safeGoTo,
  waitForPageReady,
  assertNoErrorBoundary,
} from '../helpers';
import { cleanupTestData, supabaseInsert, getOrgId } from '../supabase-admin';

// ═══════════════════════════════════════════════════════════════
// SECTION 6: LONG TEXT AND OVERFLOW
// Test that the UI handles extremely long text without breaking layout.
// ═══════════════════════════════════════════════════════════════

const testId = `e2e-${Date.now()}`;
const suffix = testId.slice(-6);

/**
 * Check that no horizontal scrollbar exists on the page body.
 */
async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    return {
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.body.clientWidth,
    };
  });
  expect(
    overflow.scrollWidth,
    `Body scrollWidth (${overflow.scrollWidth}) should be <= clientWidth (${overflow.clientWidth}) + 50px margin`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 50);
}

/**
 * Navigate via sidebar link click (SPA navigation, preserves auth).
 */
async function clickNav(page: Page, href: string) {
  const link = page.locator(`a[href="${href}"]`).first();
  await expect(link).toBeVisible({ timeout: 10_000 });
  await link.click();
  await page.waitForURL((url) => url.pathname.startsWith(href), { timeout: 15_000 });
  await waitForPageReady(page);
}

test.describe('Long Text Overflow — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test.afterAll(() => {
    try { cleanupTestData(testId); } catch { /* best-effort */ }
  });

  test('Long student name does not break layout', async ({ page }) => {
    test.setTimeout(120_000);

    const orgId = getOrgId();
    if (!orgId) { test.skip(true, 'No org ID'); return; }

    // Create student with very long first name via API
    const longName = 'A'.repeat(100);
    const student = supabaseInsert('students', {
      org_id: orgId,
      first_name: `${longName} ${suffix}`,
      last_name: `${testId} LongName`,
      status: 'active',
    });
    expect(student?.id, 'Long name student created').toBeTruthy();

    // Navigate to students
    await safeGoTo(page, '/students', 'Students');
    if (!page.url().includes('/students')) return;

    await page.waitForTimeout(2_000);

    // Verify: student list doesn't break (no horizontal scrollbar)
    await assertNoHorizontalOverflow(page);
    await assertNoErrorBoundary(page);

    // Search for the student
    const searchInput = page.getByPlaceholder('Search students...');
    if (await searchInput.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await searchInput.fill(suffix);
      await page.waitForTimeout(2_000);

      // Should find the student
      const mainContent = await page.locator('main').textContent() || '';
      expect(mainContent).toContain('LongName');

      // No overflow after search
      await assertNoHorizontalOverflow(page);
    }

    // Click into student detail
    if (student?.id) {
      const detailLink = page.locator(`a[href*="${student.id}"]`).first()
        .or(page.locator('main').getByText('LongName').first());
      const hasLink = await detailLink.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasLink) {
        await detailLink.click();
        await waitForPageReady(page);
        await page.waitForTimeout(2_000);

        await assertNoErrorBoundary(page);
        await assertNoHorizontalOverflow(page);
      }
    }
  });

  test('Long invoice description does not break layout', async ({ page }) => {
    test.setTimeout(60_000);

    await safeGoTo(page, '/invoices', 'Invoices');
    if (!page.url().includes('/invoices')) return;

    // Open Create Invoice
    const addBtn = page.locator('[data-tour="create-invoice-button"]').first()
      .or(page.getByRole('button', { name: /create invoice|new invoice/i }).first());
    const hasBtn = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) {
      test.skip(true, 'Create Invoice button not found');
      return;
    }
    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Fill description with very long text
    const longDesc = 'B'.repeat(500);
    const descInput = dialog.locator('input[placeholder="Description"]').first();
    const hasDesc = await descInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasDesc) {
      await descInput.fill(longDesc);
      // Verify value was accepted (may be truncated by maxLength)
      const value = await descInput.inputValue();
      expect(value.length).toBeGreaterThan(0);
    }

    // Check dialog doesn't overflow
    const dialogOverflow = await dialog.evaluate(el => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(dialogOverflow.scrollWidth).toBeLessThanOrEqual(dialogOverflow.clientWidth + 50);

    await page.keyboard.press('Escape');
    await assertNoErrorBoundary(page);
  });

  test('Long teacher display name does not break layout', async ({ page }) => {
    test.setTimeout(60_000);

    const orgId = getOrgId();
    if (!orgId) { test.skip(true, 'No org ID'); return; }

    // Create teacher with long name via API
    const longName = 'C'.repeat(150);
    const teacher = supabaseInsert('teachers', {
      org_id: orgId,
      display_name: `${longName} ${suffix} ${testId}`,
      status: 'active',
      employment_type: 'contractor',
    });
    // eslint-disable-next-line no-console
    console.log(`[long-text] Created teacher: ${teacher?.id}`);

    await safeGoTo(page, '/teachers', 'Teachers');
    if (!page.url().includes('/teachers')) return;

    await page.waitForTimeout(2_000);

    await assertNoHorizontalOverflow(page);
    await assertNoErrorBoundary(page);
  });

  test('Long location name and address does not break layout', async ({ page }) => {
    test.setTimeout(60_000);

    const orgId = getOrgId();
    if (!orgId) { test.skip(true, 'No org ID'); return; }

    const longName = 'D'.repeat(150);
    const loc = supabaseInsert('locations', {
      org_id: orgId,
      name: `${longName} ${suffix} ${testId}`,
      location_type: 'studio',
      address_line_1: 'E'.repeat(200),
      city: 'F'.repeat(100),
      country_code: 'GB',
    });
    // eslint-disable-next-line no-console
    console.log(`[long-text] Created location: ${loc?.id}`);

    await safeGoTo(page, '/locations', 'Locations');
    if (!page.url().includes('/locations')) return;

    await page.waitForTimeout(2_000);

    await assertNoHorizontalOverflow(page);
    await assertNoErrorBoundary(page);
  });

  test('Long lead name does not break layout', async ({ page }) => {
    test.setTimeout(60_000);

    const orgId = getOrgId();
    if (!orgId) { test.skip(true, 'No org ID'); return; }

    const longName = 'G'.repeat(150);
    const lead = supabaseInsert('leads', {
      org_id: orgId,
      contact_name: `${longName} ${suffix} ${testId}`,
      source: 'manual',
      status: 'new',
    });
    // eslint-disable-next-line no-console
    console.log(`[long-text] Created lead: ${lead?.id}`);

    await safeGoTo(page, '/leads', 'Leads');
    if (!page.url().includes('/leads')) return;

    await page.waitForTimeout(2_000);

    await assertNoHorizontalOverflow(page);
    await assertNoErrorBoundary(page);
  });
});
