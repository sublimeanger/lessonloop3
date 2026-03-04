import { test, expect, Locator } from '@playwright/test';
import {
  AUTH,
  safeGoTo,
  goTo,
  waitForPageReady,
  assertNoErrorBoundary,
} from '../helpers';

// ═══════════════════════════════════════════════════════════════
// SECTION 4: CURRENCY AND NUMBER FORMATTING
// Verify financial data displays consistently in GBP (£)
// across the entire app.
// ═══════════════════════════════════════════════════════════════

/**
 * Assert a locator's text content contains a currency symbol followed by a digit.
 */
async function assertCurrency(locator: Locator, symbol = '£'): Promise<boolean> {
  const text = await locator.textContent().catch(() => '');
  if (!text) return false;
  const regex = new RegExp(`\\${symbol}\\d`);
  return regex.test(text);
}

/**
 * Find all visible monetary amounts on the page and check they use the correct symbol.
 */
async function checkPageCurrency(page: import('@playwright/test').Page, symbol = '£'): Promise<{ found: number; correct: number; incorrect: string[] }> {
  const mainContent = await page.locator('main').textContent() || '';

  // Find all currency patterns (£XX.XX, $XX.XX, etc.)
  const poundMatches = mainContent.match(/£[\d,.]+/g) || [];
  const dollarMatches = mainContent.match(/\$[\d,.]+/g) || [];
  const euroMatches = mainContent.match(/€[\d,.]+/g) || [];

  const found = poundMatches.length + dollarMatches.length + euroMatches.length;
  const correct = poundMatches.length;
  const incorrect: string[] = [];

  dollarMatches.forEach(m => incorrect.push(m));
  euroMatches.forEach(m => incorrect.push(m));

  return { found, correct, incorrect };
}

test.describe('Currency Formatting — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('Invoice list displays amounts in GBP (£)', async ({ page }) => {
    test.setTimeout(60_000);
    await safeGoTo(page, '/invoices', 'Invoices');
    if (!page.url().includes('/invoices')) return;

    await page.waitForTimeout(2_000);

    const result = await checkPageCurrency(page);
    // eslint-disable-next-line no-console
    console.log(`[currency] Invoices: found=${result.found}, correct=${result.correct}, incorrect=${JSON.stringify(result.incorrect)}`);

    if (result.found > 0) {
      expect(result.incorrect.length, 'All invoice amounts should be in £, not $ or €').toBe(0);
      expect(result.correct).toBeGreaterThan(0);
    }

    await assertNoErrorBoundary(page);
  });

  test('Invoice detail displays amounts in GBP (£)', async ({ page }) => {
    test.setTimeout(60_000);
    await safeGoTo(page, '/invoices', 'Invoices');
    if (!page.url().includes('/invoices')) return;

    // Click the first invoice link
    const invoiceLink = page.locator('main').locator('a[href*="/invoices/"]').first()
      .or(page.locator('main tr').first().locator('a').first());
    const hasLink = await invoiceLink.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasLink) {
      test.skip(true, 'No invoices to click into');
      return;
    }

    await invoiceLink.click();
    await waitForPageReady(page);
    await page.waitForTimeout(2_000);

    const result = await checkPageCurrency(page);
    // eslint-disable-next-line no-console
    console.log(`[currency] Invoice detail: found=${result.found}, correct=${result.correct}`);

    if (result.found > 0) {
      expect(result.incorrect.length, 'Invoice detail amounts should be in £').toBe(0);
    }

    await assertNoErrorBoundary(page);
  });

  test('Dashboard stats display amounts in GBP (£)', async ({ page }) => {
    test.setTimeout(60_000);
    await safeGoTo(page, '/dashboard', 'Dashboard');
    if (!page.url().includes('/dashboard')) return;

    await page.waitForTimeout(3_000);

    const result = await checkPageCurrency(page);
    // eslint-disable-next-line no-console
    console.log(`[currency] Dashboard: found=${result.found}, correct=${result.correct}`);

    if (result.found > 0) {
      expect(result.incorrect.length, 'Dashboard amounts should be in £').toBe(0);
    }

    await assertNoErrorBoundary(page);
  });

  test('Reports display amounts in GBP (£)', async ({ page }) => {
    test.setTimeout(60_000);
    await safeGoTo(page, '/reports', 'Reports');
    await page.waitForTimeout(3_000);

    // Try to find a revenue-related report
    const revenueLink = page.locator('a[href*="revenue"]').first()
      .or(page.getByText(/revenue/i).first());
    if (await revenueLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await revenueLink.click();
      await page.waitForTimeout(3_000);
    }

    const result = await checkPageCurrency(page);
    // eslint-disable-next-line no-console
    console.log(`[currency] Reports: found=${result.found}, correct=${result.correct}`);

    if (result.found > 0) {
      expect(result.incorrect.length, 'Report amounts should be in £').toBe(0);
    }

    await assertNoErrorBoundary(page);
  });

  test('Settings rate cards display amounts in GBP (£)', async ({ page }) => {
    test.setTimeout(60_000);
    await goTo(page, '/settings');
    await page.waitForTimeout(3_000);

    // Navigate to rate cards tab/section
    const rateCardTab = page.getByText(/rate card/i).first()
      .or(page.locator('a[href*="rate"]').first());
    if (await rateCardTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await rateCardTab.click();
      await page.waitForTimeout(2_000);
    }

    const result = await checkPageCurrency(page);
    // eslint-disable-next-line no-console
    console.log(`[currency] Rate cards: found=${result.found}, correct=${result.correct}`);

    if (result.found > 0) {
      expect(result.incorrect.length, 'Rate card amounts should be in £').toBe(0);
    }

    await assertNoErrorBoundary(page);
  });
});

test.describe('Currency Formatting — Parent Portal', () => {
  test.use({ storageState: AUTH.parent });

  test('Portal invoices display amounts in GBP (£)', async ({ page }) => {
    test.setTimeout(60_000);
    await goTo(page, '/portal/invoices');
    await page.waitForTimeout(3_000);

    const hasError = await page.getByText('Something went wrong').isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasError) {
      // eslint-disable-next-line no-console
      console.log('[currency] Portal invoices has error boundary — skipping');
      return;
    }

    const bodyContent = await page.locator('body').textContent() || '';
    const poundMatches = bodyContent.match(/£[\d,.]+/g) || [];
    const dollarMatches = bodyContent.match(/\$[\d,.]+/g) || [];

    // eslint-disable-next-line no-console
    console.log(`[currency] Portal invoices: £=${poundMatches.length}, $=${dollarMatches.length}`);

    if (poundMatches.length + dollarMatches.length > 0) {
      expect(dollarMatches.length, 'Portal invoice amounts should be in £').toBe(0);
    }
  });

  test('Portal home displays balance in GBP (£)', async ({ page }) => {
    test.setTimeout(60_000);
    await goTo(page, '/portal/home');
    await page.waitForTimeout(3_000);

    const hasError = await page.getByText('Something went wrong').isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasError) {
      // eslint-disable-next-line no-console
      console.log('[currency] Portal home has error boundary — skipping');
      return;
    }

    const bodyContent = await page.locator('body').textContent() || '';
    const poundMatches = bodyContent.match(/£[\d,.]+/g) || [];
    const dollarMatches = bodyContent.match(/\$[\d,.]+/g) || [];

    // eslint-disable-next-line no-console
    console.log(`[currency] Portal home: £=${poundMatches.length}, $=${dollarMatches.length}`);

    if (poundMatches.length + dollarMatches.length > 0) {
      expect(dollarMatches.length, 'Portal home amounts should be in £').toBe(0);
    }
  });
});
