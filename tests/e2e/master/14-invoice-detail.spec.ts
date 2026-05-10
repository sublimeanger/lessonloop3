/**
 * 14 — Invoice detail (send, pay, refund, plan, dispute, PDF)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §14
 *
 * Like §13, most tests drive the backend (RPCs + service-role) so the
 * assertions are robust under parallel runs. UI smokes only verify the
 * detail page renders without the section error boundary.
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';
import {
  createTestInvoice,
  deleteInvoiceById,
  getFirstGuardianId,
  patchInvoiceStatus,
  supabaseDelete,
  supabaseRpc,
  supabaseSelect,
} from '../supabase-admin';
import { resetE2ERateLimits } from './_fixtures/stripe-test-helpers';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

function genTestId() {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.parent);
  resetE2ERateLimits();
});

test.describe('§14 — Invoice detail page (UI smoke)', () => {
  test.use({ storageState: AUTH.owner });

  test('renders for a seeded invoice without error boundary', async ({ page }) => {
    const testId = genTestId();
    const guardianId = getFirstGuardianId();
    expect(guardianId).toBeTruthy();

    const inv = createTestInvoice({
      dueDate: new Date(Date.now() + 14 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: guardianId,
      notes: `${testId}_detail`,
      items: [{ description: `${testId}_item`, quantity: 1, unit_price_minor: 2000 }],
    });

    try {
      await goTo(page, `/invoices/${inv.id}`);
      await assertNoErrorBoundary(page);
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
      // Invoice number should appear on the page somewhere.
      await expect(page.getByText(inv.invoice_number).first()).toBeVisible({ timeout: 10_000 });
    } finally {
      deleteInvoiceById(inv.id);
    }
  });
});

test.describe('§14.5 — Record manual payment', () => {
  test('full payment via record_manual_payment RPC → status=paid', async () => {
    const testId = genTestId();
    const guardianId = getFirstGuardianId();
    expect(guardianId).toBeTruthy();

    const inv = createTestInvoice({
      dueDate: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: guardianId,
      notes: `${testId}_pay`,
      items: [{ description: `${testId}_i`, quantity: 1, unit_price_minor: 4000 }],
    });

    try {
      patchInvoiceStatus(inv.id, 'sent');
      const before = supabaseSelect('invoices', `id=eq.${inv.id}&select=total_minor,status`);
      const total = before[0].total_minor as number;
      expect(before[0].status).toBe('sent');

      supabaseRpc('record_manual_payment', {
        p_invoice_id: inv.id,
        p_amount_minor: total,
        p_method: 'bank_transfer',
        p_paid_at: new Date().toISOString(),
        p_reference: `${testId}_pay_ref`,
        p_installment_id: null,
      });

      const after = supabaseSelect('invoices', `id=eq.${inv.id}&select=status,paid_minor`);
      expect(after[0].status).toBe('paid');
      expect(after[0].paid_minor).toBe(total);

      const payments = supabaseSelect(
        'payments',
        `invoice_id=eq.${inv.id}&select=amount_minor,method,provider`,
      );
      expect(payments.length).toBe(1);
      expect(payments[0].amount_minor).toBe(total);
      expect(payments[0].method).toBe('bank_transfer');
      expect(payments[0].provider).toBe('manual');
    } finally {
      supabaseDelete('payments', `invoice_id=eq.${inv.id}`);
      deleteInvoiceById(inv.id);
    }
  });

  test('partial payment → status stays sent, paid_minor accumulates', async () => {
    const testId = genTestId();
    const guardianId = getFirstGuardianId();
    expect(guardianId).toBeTruthy();

    const inv = createTestInvoice({
      dueDate: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: guardianId,
      notes: `${testId}_partial`,
      items: [{ description: `${testId}_i`, quantity: 1, unit_price_minor: 10_000 }],
    });

    try {
      patchInvoiceStatus(inv.id, 'sent');
      const before = supabaseSelect('invoices', `id=eq.${inv.id}&select=total_minor`);
      const total = before[0].total_minor as number;

      // Half payment.
      const half = Math.floor(total / 2);
      supabaseRpc('record_manual_payment', {
        p_invoice_id: inv.id,
        p_amount_minor: half,
        p_method: 'cash',
        p_paid_at: new Date().toISOString(),
        p_reference: null,
        p_installment_id: null,
      });

      const after = supabaseSelect('invoices', `id=eq.${inv.id}&select=status,paid_minor`);
      expect(after[0].status).toBe('sent');
      expect(after[0].paid_minor).toBe(half);

      // Second partial covering the remainder → flips to paid.
      supabaseRpc('record_manual_payment', {
        p_invoice_id: inv.id,
        p_amount_minor: total - half,
        p_method: 'cash',
        p_paid_at: new Date().toISOString(),
        p_reference: null,
        p_installment_id: null,
      });

      const final = supabaseSelect('invoices', `id=eq.${inv.id}&select=status,paid_minor`);
      expect(final[0].status).toBe('paid');
      expect(final[0].paid_minor).toBe(total);

      const payments = supabaseSelect(
        'payments',
        `invoice_id=eq.${inv.id}&select=amount_minor`,
      );
      expect(payments.length).toBe(2);
    } finally {
      supabaseDelete('payments', `invoice_id=eq.${inv.id}`);
      deleteInvoiceById(inv.id);
    }
  });
});

test.describe('§14.6 — Manual refund', () => {
  test('record_manual_refund → refund row + paid_minor decreases + status flips back to sent', async () => {
    const testId = genTestId();
    const guardianId = getFirstGuardianId();
    expect(guardianId).toBeTruthy();

    const inv = createTestInvoice({
      dueDate: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: guardianId,
      notes: `${testId}_refund`,
      items: [{ description: `${testId}_i`, quantity: 1, unit_price_minor: 8000 }],
    });

    try {
      patchInvoiceStatus(inv.id, 'sent');
      const totalRow = supabaseSelect('invoices', `id=eq.${inv.id}&select=total_minor`);
      const total = totalRow[0].total_minor as number;

      // Pay in full.
      supabaseRpc('record_manual_payment', {
        p_invoice_id: inv.id,
        p_amount_minor: total,
        p_method: 'cash',
        p_paid_at: new Date().toISOString(),
        p_reference: null,
        p_installment_id: null,
      });

      const paymentRows = supabaseSelect('payments', `invoice_id=eq.${inv.id}&select=id`);
      expect(paymentRows.length).toBe(1);
      const paymentId = paymentRows[0].id as string;

      // Partial manual refund. RPC takes payment_id + invoice_id + org_id + amount + reason.
      const refundAmt = Math.floor(total / 4);
      supabaseRpc('record_manual_refund', {
        _payment_id: paymentId,
        _invoice_id: inv.id,
        _org_id: '25b57950-6c4e-42d8-8089-4942d2bba959',
        _amount_minor: refundAmt,
        _reason: `${testId}_refund_reason`,
      });

      const refunds = supabaseSelect(
        'refunds',
        `payment_id=eq.${paymentId}&select=id,amount_minor,status,reason`,
      );
      expect(refunds.length).toBe(1);
      expect(refunds[0].amount_minor).toBe(refundAmt);
      expect(refunds[0].status).toBe('succeeded');
      expect(refunds[0].reason).toBe(`${testId}_refund_reason`);

      // Invoice paid_minor should now be total - refundAmt; status flips
      // back to sent because outstanding > 0.
      const after = supabaseSelect('invoices', `id=eq.${inv.id}&select=status,paid_minor`);
      expect(after[0].paid_minor).toBe(total - refundAmt);
      expect(['sent', 'overdue']).toContain(after[0].status);
    } finally {
      // Cleanup: delete refunds + payments, then invoice.
      const ps = supabaseSelect('payments', `invoice_id=eq.${inv.id}&select=id`);
      for (const p of ps) {
        supabaseDelete('refunds', `payment_id=eq.${p.id}`);
      }
      supabaseDelete('payments', `invoice_id=eq.${inv.id}`);
      deleteInvoiceById(inv.id);
    }
  });
});

test.describe('§14.7 — Payment plan post-send', () => {
  test('generate_installments after sent → 4 installments summing to total', async () => {
    const testId = genTestId();
    const guardianId = getFirstGuardianId();
    expect(guardianId).toBeTruthy();

    const inv = createTestInvoice({
      dueDate: new Date(Date.now() + 90 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: guardianId,
      notes: `${testId}_plan`,
      items: [{ description: `${testId}_i`, quantity: 1, unit_price_minor: 20_000 }],
    });

    try {
      patchInvoiceStatus(inv.id, 'sent');
      const totalRow = supabaseSelect('invoices', `id=eq.${inv.id}&select=total_minor`);
      const total = totalRow[0].total_minor as number;

      supabaseRpc('generate_installments', {
        _invoice_id: inv.id,
        _org_id: '25b57950-6c4e-42d8-8089-4942d2bba959',
        _count: 4,
        _frequency: 'monthly',
        _start_date: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
        _custom_schedule: null,
      });

      const installments = supabaseSelect(
        'invoice_installments',
        `invoice_id=eq.${inv.id}&select=installment_number,amount_minor,status&order=installment_number`,
      );
      expect(installments.length).toBe(4);
      const sum = installments.reduce(
        (acc: number, i: Record<string, number>) => acc + (i.amount_minor ?? 0),
        0,
      );
      expect(sum).toBe(total);
      expect(installments.every((i: Record<string, string>) => i.status === 'pending')).toBe(true);
    } finally {
      supabaseDelete('invoice_installments', `invoice_id=eq.${inv.id}`);
      deleteInvoiceById(inv.id);
    }
  });
});

test.describe('§14 — Status transitions (enforce_invoice_status_transition)', () => {
  test('paid → draft is blocked by trigger', async () => {
    const testId = genTestId();
    const guardianId = getFirstGuardianId();
    expect(guardianId).toBeTruthy();

    const inv = createTestInvoice({
      dueDate: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: guardianId,
      notes: `${testId}_block`,
      items: [{ description: `${testId}_i`, quantity: 1, unit_price_minor: 1000 }],
    });

    try {
      patchInvoiceStatus(inv.id, 'sent');
      const totalRow = supabaseSelect('invoices', `id=eq.${inv.id}&select=total_minor`);
      const total = totalRow[0].total_minor as number;
      supabaseRpc('record_manual_payment', {
        p_invoice_id: inv.id,
        p_amount_minor: total,
        p_method: 'cash',
        p_paid_at: new Date().toISOString(),
        p_reference: null,
        p_installment_id: null,
      });

      const paid = supabaseSelect('invoices', `id=eq.${inv.id}&select=status`);
      expect(paid[0].status).toBe('paid');

      // Try paid → draft. Trigger should reject (or coerce to NEW := OLD).
      let threw = false;
      try {
        patchInvoiceStatus(inv.id, 'draft');
      } catch {
        threw = true;
      }
      const after = supabaseSelect('invoices', `id=eq.${inv.id}&select=status`);
      // The protect trigger may either throw or silently coerce — either way,
      // the visible state must remain 'paid'.
      expect(after[0].status).toBe('paid');
      void threw; // either branch is acceptable
    } finally {
      supabaseDelete('payments', `invoice_id=eq.${inv.id}`);
      deleteInvoiceById(inv.id);
    }
  });
});

test.describe('§14.10.14 — PDF rev bump trigger', () => {
  // Catalog §14.10.14: "PDF download — first call generates, second uses
  // cache, modify line item → bump_invoice_pdf_rev_* trigger increments
  // rev → next download regenerates."
  // We assert the trigger half (DB-shape): seed an invoice, assert pdf_rev
  // starts at 0, mutate an item, assert pdf_rev incremented. The cache
  // half is in InvoiceDetail.tsx PDF download flow (UI heavy; not in
  // scope here).
  test('mutating a line item bumps invoices.pdf_rev (cache invalidation)', async () => {
    const testId = genTestId();
    const guardianId = getFirstGuardianId();
    expect(guardianId).toBeTruthy();

    const inv = createTestInvoice({
      dueDate: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: guardianId,
      notes: `${testId}_pdfrev`,
      items: [{ description: `${testId}_item`, quantity: 1, unit_price_minor: 1000 }],
    });

    try {
      // bump_invoice_pdf_rev_from_items_ins fires on item INSERT, so the
      // baseline after createTestInvoice is already > 0. Capture and
      // compare delta — the contract under test is "mutating bumps it",
      // not "starts at 0".
      const baseline = supabaseSelect('invoices', `id=eq.${inv.id}&select=pdf_rev`);
      expect(baseline[0].pdf_rev).toBeGreaterThanOrEqual(1);
      const startRev = baseline[0].pdf_rev as number;

      // UPDATE the item — bump_invoice_pdf_rev_from_items_upd should fire.
      const items = supabaseSelect('invoice_items', `invoice_id=eq.${inv.id}&select=id`);
      expect(items.length).toBe(1);
      const itemId = items[0].id;
      execSync(
        `curl -s -X PATCH "${process.env.E2E_SUPABASE_URL}/rest/v1/invoice_items?id=eq.${itemId}" ` +
          `-H "apikey: ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
          `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
          `-H "Content-Type: application/json" ` +
          `-d '{"description":"${testId}_item_mutated"}'`,
        { encoding: 'utf-8', timeout: 15_000 },
      );

      const after = supabaseSelect('invoices', `id=eq.${inv.id}&select=pdf_rev`);
      expect(after[0].pdf_rev, `pdf_rev should bump on item UPDATE: ${startRev} → ${after[0].pdf_rev}`).toBeGreaterThan(startRev);
    } finally {
      deleteInvoiceById(inv.id);
    }
  });
});

test.describe('§14.10.16 — apply_lost_dispute_cascade', () => {
  // Service-role-curl SELECT — replaces supabaseSelect's owner JWT path
  // which returned non-array shapes under parallel contention in s14
  // (PostgREST proxy timeout). Same pattern as §27 / §26.11. Always
  // returns an array even if PostgREST responded with an error object
  // (e.g. transient timeout) so callers can rely on `.length`.
  function selectServiceRole(table: string, query: string): any[] {
    const url = process.env.E2E_SUPABASE_URL!;
    const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
    if (!key) throw new Error('E2E_SUPABASE_SERVICE_ROLE_KEY required');
    const result = execSync(
      `curl -s "${url}/rest/v1/${table}?${query}" ` +
        `-H "apikey: ${key}" -H "Authorization: Bearer ${key}"`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    try {
      const parsed = JSON.parse(result);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  // Poll-with-backoff wrapper — used for assertions on rows the RPC
  // writes inside its transaction body (audit_log is the common case).
  // The row IS committed by the time the RPC returns, but PostgREST
  // visibility under cross-file parallel contention occasionally lags
  // by 1-3s as the proxy fans out fresh reads against an overloaded
  // pool. 10s deadline gives plenty of headroom for the worst-case
  // contention seen in baselines without slowing the happy path
  // (which returns on the first poll).
  function selectServiceRoleWithPoll(
    table: string, query: string, predicate: (rows: any[]) => boolean,
  ): any[] {
    const deadline = Date.now() + 10_000;
    let last: any[] = [];
    while (Date.now() < deadline) {
      last = selectServiceRole(table, query);
      if (predicate(last)) return last;
      execSync('sleep 0.25');
    }
    return last;
  }

  // Catalog §14.10.16: "apply_lost_dispute_cascade cascades correctly."
  // The RPC is service-role only (rejects auth.uid() != NULL — see
  // pg_proc body verified 2026-05-10). Stripe webhook calls it when
  // a dispute closes with outcome='lost'. Tests:
  //   - happy path: paid invoice + dispute + RPC → refund row + invoice
  //     transitions back from paid + audit_log row
  //   - idempotency: second call returns already_applied:true
  test('paid invoice + lost dispute → cascade inserts refund + invoice no longer "paid" + audit_log dispute_lost_cascade_applied', async () => {
    const testId = genTestId();
    const guardianId = getFirstGuardianId();
    const orgId = process.env.E2E_ORG_ID!;
    expect(guardianId).toBeTruthy();

    const inv = createTestInvoice({
      dueDate: new Date(Date.now() + 14 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: guardianId,
      notes: `${testId}_dispute`,
      items: [{ description: `${testId}_i`, quantity: 1, unit_price_minor: 5000 }],
    });

    try {
      patchInvoiceStatus(inv.id, 'sent');
      const totalRow = selectServiceRole('invoices', `id=eq.${inv.id}&select=total_minor`);
      expect(Array.isArray(totalRow) && totalRow.length === 1, `total_minor select shape: ${JSON.stringify(totalRow).slice(0, 200)}`).toBe(true);
      const total = totalRow[0].total_minor as number;

      // Pay it via record_manual_payment so paid_minor reflects + status=paid.
      supabaseRpc('record_manual_payment', {
        p_invoice_id: inv.id,
        p_amount_minor: total,
        p_method: 'card',
        p_paid_at: new Date().toISOString(),
        p_reference: `${testId}_pay_ref`,
        p_installment_id: null,
      });
      const paid = selectServiceRole('invoices', `id=eq.${inv.id}&select=status`);
      expect(Array.isArray(paid) && paid.length === 1, `paid select shape: ${JSON.stringify(paid).slice(0, 200)}`).toBe(true);
      expect(paid[0].status).toBe('paid');

      const payments = selectServiceRole('payments', `invoice_id=eq.${inv.id}&select=id`);
      expect(payments.length).toBe(1);
      const paymentId = payments[0].id;

      // Insert a payment_disputes row directly (mirrors what
      // stripe-webhook would do on charge.dispute.closed).
      const disputeReqFile = `/tmp/sb-dispute-${Date.now()}.json`;
      fs.writeFileSync(
        disputeReqFile,
        JSON.stringify({
          payment_id: paymentId,
          invoice_id: inv.id,
          org_id: orgId,
          stripe_dispute_id: `dp_test_${testId}`,
          stripe_charge_id: `ch_test_${testId}`,
          amount_minor: total,
          currency_code: 'GBP',
          reason: 'unrecognized',
          status: 'lost',
          outcome: 'lost',
          opened_at: new Date(Date.now() - 7 * 24 * 3600_000).toISOString(),
          closed_at: new Date().toISOString(),
        }),
      );
      let disputeId: string;
      try {
        const dRaw = execSync(
          `curl -s -X POST "${process.env.E2E_SUPABASE_URL}/rest/v1/payment_disputes" ` +
            `-H "apikey: ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
            `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
            `-H "Content-Type: application/json" ` +
            `-H "Prefer: return=representation" ` +
            `-d @${disputeReqFile}`,
          { encoding: 'utf-8', timeout: 15_000 },
        );
        const rows = JSON.parse(dRaw);
        expect(Array.isArray(rows) && rows[0]?.id, `payment_disputes insert failed: ${dRaw.slice(0, 200)}`).toBeTruthy();
        disputeId = rows[0].id;
      } finally {
        try { fs.unlinkSync(disputeReqFile); } catch { /* ignore */ }
      }

      // Apply the cascade RPC — service-role only (validated in pg_proc).
      const cascadeRaw = execSync(
        `curl -s -X POST "${process.env.E2E_SUPABASE_URL}/rest/v1/rpc/apply_lost_dispute_cascade" ` +
          `-H "apikey: ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
          `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
          `-H "Content-Type: application/json" ` +
          `-d '{"_dispute_id": "${disputeId}"}'`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const cascadeResult = JSON.parse(cascadeRaw);
      expect(cascadeResult.already_applied).toBe(false);
      expect(cascadeResult.refund_id).toBeTruthy();

      // Refund row exists with status=succeeded + linked to dispute.
      const refunds = selectServiceRole(
        'refunds',
        `payment_id=eq.${paymentId}&select=amount_minor,status,refund_from_dispute_id`,
      );
      expect(refunds.length).toBe(1);
      expect(refunds[0].amount_minor).toBe(total);
      expect(refunds[0].status).toBe('succeeded');
      expect(refunds[0].refund_from_dispute_id).toBe(disputeId);

      // Invoice no longer 'paid' (recalculate_invoice_paid runs inside the
      // RPC). Should be 'sent' or 'overdue' depending on due_date.
      const after = selectServiceRole('invoices', `id=eq.${inv.id}&select=status`);
      expect(Array.isArray(after) && after.length === 1, `invoice select after cascade: ${JSON.stringify(after).slice(0, 200)}`).toBe(true);
      expect(['sent', 'overdue'], `invoice status after cascade: ${after[0].status}`).toContain(after[0].status);

      // Audit log: dispute_lost_cascade_applied row keyed on the invoice.
      // Poll briefly — the RPC writes audit_log inside its body; PostgREST
      // visibility under proxy contention occasionally lags by 100-300ms.
      const audit = selectServiceRoleWithPoll(
        'audit_log',
        `org_id=eq.${orgId}&entity_type=eq.invoice&entity_id=eq.${inv.id}&action=eq.dispute_lost_cascade_applied&select=action,after`,
        (rows) => rows.length >= 1,
      );
      expect(audit.length, `audit_log dispute_lost_cascade_applied not visible after 3s; got: ${JSON.stringify(audit).slice(0, 200)}`).toBeGreaterThanOrEqual(1);
      expect(audit[0].after?.dispute_id).toBe(disputeId);

      // Idempotency: second call returns already_applied:true.
      const second = JSON.parse(execSync(
        `curl -s -X POST "${process.env.E2E_SUPABASE_URL}/rest/v1/rpc/apply_lost_dispute_cascade" ` +
          `-H "apikey: ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
          `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
          `-H "Content-Type: application/json" ` +
          `-d '{"_dispute_id": "${disputeId}"}'`,
        { encoding: 'utf-8', timeout: 15_000 },
      ));
      expect(second.already_applied).toBe(true);
      expect(second.refund_id).toBe(cascadeResult.refund_id);

      // Cleanup
      supabaseDelete('audit_log', `entity_id=eq.${inv.id}&action=eq.dispute_lost_cascade_applied`);
      supabaseDelete('refunds', `id=eq.${cascadeResult.refund_id}`);
      supabaseDelete('payment_disputes', `id=eq.${disputeId}`);
    } finally {
      supabaseDelete('payments', `invoice_id=eq.${inv.id}`);
      deleteInvoiceById(inv.id);
    }
  });
});

test.describe('§14 — RBAC negative', () => {
  test('parent cannot access /invoices/:id (admin-only route)', async ({ browser }) => {
    const testId = genTestId();
    const guardianId = getFirstGuardianId();
    expect(guardianId).toBeTruthy();
    const inv = createTestInvoice({
      dueDate: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: guardianId,
      notes: `${testId}_rbac`,
      items: [{ description: `${testId}_i`, quantity: 1, unit_price_minor: 1000 }],
    });

    try {
      const ctx = await browser.newContext({ storageState: AUTH.parent });
      const page = await ctx.newPage();
      await page.goto(`/invoices/${inv.id}`);
      await page.waitForTimeout(2_000);
      // Parent role is /portal/* only. Should redirect away from /invoices/:id.
      expect(page.url()).not.toMatch(new RegExp(`/invoices/${inv.id}`));
      await ctx.close();
    } finally {
      deleteInvoiceById(inv.id);
    }
  });
});
