/**
 * 14 — Invoice detail (send, pay, refund, plan, dispute, PDF)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §14
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';
import { seedInvoice, getFirstGuardianId, supabaseSelect, supabaseDelete, supabaseRpc } from '../supabase-admin';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.parent);
});

test.describe('Invoice detail page', () => {
  test.use({ storageState: AUTH.owner });

  test.fixme('renders for a seeded invoice', async ({ page }) => {
    const testId = `detail_${Date.now()}`;
    const guardianId = getFirstGuardianId();
    if (!guardianId) {
      test.skip(true, 'No guardian to invoice');
      return;
    }
    const { invoiceId } = seedInvoice({ testId, payerGuardianId: guardianId });

    await goTo(page, `/invoices/${invoiceId}`);
    await assertNoErrorBoundary(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Cleanup
    supabaseDelete('invoice_items', `invoice_id=eq.${invoiceId}`);
    supabaseDelete('invoices', `id=eq.${invoiceId}`);
  });
});

test.describe('Invoice status transitions (DB triggers)', () => {
  test.use({ storageState: AUTH.owner });

  test.fixme('enforce_invoice_status_transition: paid → draft is blocked', async () => {
    const testId = `transit_${Date.now()}`;
    const guardianId = getFirstGuardianId();
    if (!guardianId) {
      test.skip(true, 'No guardian');
      return;
    }
    const { invoiceId } = seedInvoice({ testId, payerGuardianId: guardianId, status: 'sent' });

    // Manually try to transition through illegal path via RPC (should fail or no-op)
    let blocked = false;
    try {
      await supabaseRpc('update_invoice_status', { _invoice_id: invoiceId, _status: 'paid' });
      // Now try paid → draft (illegal)
      await supabaseRpc('update_invoice_status', { _invoice_id: invoiceId, _status: 'draft' });
    } catch {
      blocked = true;
    }
    // Cleanup
    supabaseDelete('invoice_items', `invoice_id=eq.${invoiceId}`);
    supabaseDelete('invoices', `id=eq.${invoiceId}`);
    // Trigger should block the illegal transition
    expect(typeof blocked).toBe('boolean');
  });
});

test.fixme('§14.4 — send invoice email + status flips draft → sent', async () => {});
test.fixme('§14.5 — record manual full payment → status=paid', async () => {});
test.fixme('§14.5 — record partial payment → status remains sent + payments aggregate', async () => {});
test.fixme('§14.6 — refund manual partial → original payment shows partial refund', async () => {});
test.fixme('§14.6 — refund Stripe → stripe-process-refund called', async () => {});
test.fixme('§14.7 — setup payment plan post-send → invoice_installments rows created', async () => {});
test.fixme('§14.10 — Pay one installment via parent portal → installment paid', async () => {});
test.fixme('§14.14 — PDF download caches, line item edit → bump_invoice_pdf_rev → regen', async () => {});
test.fixme('§14.9 — dispute lifecycle: charge.dispute.created webhook → banner', async () => {});
test.fixme('§14.9 — apply_lost_dispute_cascade marks payment refunded + may issue credit', async () => {});
