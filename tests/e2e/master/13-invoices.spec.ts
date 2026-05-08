/**
 * 13 — Invoices (list, billing run, recurring, plans)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §13
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';
import { seedInvoice, getFirstGuardianId, supabaseSelect, supabaseDelete } from '../supabase-admin';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.finance);
});

test.describe('Invoices list', () => {
  test.use({ storageState: AUTH.owner });

  test('renders without error', async ({ page }) => {
    await goTo(page, '/invoices');
    await assertNoErrorBoundary(page);
  });

  test('?status=overdue filter persists in URL', async ({ page }) => {
    await goTo(page, '/invoices?status=overdue');
    await expect(page).toHaveURL(/status=overdue/);
  });

  test('?tab=payment-plans persists', async ({ page }) => {
    await goTo(page, '/invoices?tab=payment-plans');
    await expect(page).toHaveURL(/tab=payment-plans/);
  });
});

test.describe('Invoice DB-side seed verification', () => {
  test.use({ storageState: AUTH.owner });

  test.fixme('seed an invoice via RPC then it appears in list', async ({ page }) => {
    const testId = `inv_${Date.now()}`;
    const guardianId = getFirstGuardianId();
    if (!guardianId) {
      test.skip(true, 'No guardian in test org to invoice');
      return;
    }

    const { invoiceId, invoiceNumber } = seedInvoice({
      testId,
      payerGuardianId: guardianId,
      items: [{ description: `e2e_${testId}_item`, quantity: 1, unit_price_minor: 5000 }],
    });

    await goTo(page, '/invoices');
    await assertNoErrorBoundary(page);

    // Wait for list and search if there's a search box
    const search = page.getByPlaceholder(/search/i).first();
    if (await search.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await search.fill(invoiceNumber);
      await page.waitForTimeout(1000);
    }

    // Cleanup
    supabaseDelete('invoice_items', `invoice_id=eq.${invoiceId}`);
    supabaseDelete('invoices', `id=eq.${invoiceId}`);
  });
});

test.fixme('§13.5 — create invoice manual entry via UI', async () => {});
test.fixme('§13.5 — create invoice from unbilled lessons', async () => {});
test.fixme('§13.5 — create invoice with payment plan', async () => {});
test.fixme('§13.6 — billing run wizard for 5 students → 5 draft invoices', async () => {});
test.fixme('§13.3 — bulk send 3 drafts via send-invoice-email', async () => {});
test.fixme('§13.3 — bulk void via void_invoice RPC', async () => {});
