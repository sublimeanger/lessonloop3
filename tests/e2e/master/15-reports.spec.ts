/**
 * 15 — Reports (8 reports)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §15
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';
import {
  createTestInvoice,
  deleteInvoiceById,
  patchInvoiceStatus,
} from '../supabase-admin';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
});

const REPORTS = [
  { path: '/reports', name: 'Reports hub' },
  { path: '/reports/payroll', name: 'Payroll' },
  { path: '/reports/revenue', name: 'Revenue' },
  { path: '/reports/outstanding', name: 'Outstanding' },
  { path: '/reports/lessons', name: 'Lessons delivered' },
  { path: '/reports/cancellations', name: 'Cancellations' },
  { path: '/reports/attendance', name: 'Attendance' },
  { path: '/reports/utilisation', name: 'Utilisation' },
  { path: '/reports/teacher-performance', name: 'Teacher performance' },
];

test.describe('Reports — basic load', () => {
  test.use({ storageState: AUTH.owner });

  for (const r of REPORTS) {
    test(`${r.name} (${r.path}) loads without error`, async ({ page }) => {
      await goTo(page, r.path);
      await assertNoErrorBoundary(page);
    });
  }
});

// ────────────────────────────────────────────────────────────────────
// §15.4.7 — Data correctness for Outstanding report
// ────────────────────────────────────────────────────────────────────
//
// Outstanding is the highest-value report for Lauren's billing
// reconciliation per LESSONLOOP_V2_PLAN.md §3.1. `useAgeingReport`
// queries invoices.status IN ('sent', 'overdue') directly (no RPC),
// then computes aging buckets client-side from due_date. This test
// seeds a sent invoice with a known invoice_number and due_date 5
// days out, renders /reports/outstanding as owner, expands the
// "Current (0-7 days)" bucket, and asserts the invoice_number is
// in the rendered table — proving the data path end-to-end.

test.describe('§15.4 — Outstanding report data correctness', () => {
  test.use({ storageState: AUTH.owner });

  const E2E_PARENT_GUARDIAN_ID = '44821141-05be-4475-ad1f-a9532943a355';

  test('§15.4.7 — seeded sent invoice (due in 5 days) appears in "Current (0-7 days)" bucket', async ({
    page,
  }) => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const dueDate = new Date(Date.now() + 5 * 24 * 3600_000)
      .toISOString()
      .slice(0, 10);

    const invoice = createTestInvoice({
      dueDate,
      payerGuardianId: E2E_PARENT_GUARDIAN_ID,
      notes: `e2e_${testId}_outstanding`,
      items: [
        { description: `e2e_${testId}_item`, quantity: 1, unit_price_minor: 4200 },
      ],
    });
    if (!invoice?.id) {
      throw new Error(`createTestInvoice failed: ${JSON.stringify(invoice)}`);
    }

    // create_invoice_with_items returns status=draft. Flip to sent so
    // useAgeingReport's status IN ('sent', 'overdue') picks it up.
    patchInvoiceStatus(invoice.id, 'sent');

    try {
      await goTo(page, '/reports/outstanding');
      await assertNoErrorBoundary(page);

      // Outstanding.tsx initialises expandedBuckets as
      // `new Set(['Current (0-7 days)'])` — the bucket starts EXPANDED
      // by default. Don't click the trigger; clicking would toggle it
      // closed. Just wait for the bucket header to confirm the report
      // resolved, then assert on the rendered table content.
      await expect(
        page.getByRole('button', { name: /Current \(0-7 days\)/ }),
      ).toBeVisible({ timeout: 15_000 });

      // Our seeded invoice_number appears in the Table inside the
      // expanded Current bucket. Pagination is 10 rows per page; the
      // table is sorted by daysOverdue ascending in `useAgeingReport`,
      // and our seeded invoice (due in 5 days = 0 days overdue) lands
      // on page 1 alongside the other current invoices.
      await expect(
        page.getByText(invoice.invoice_number).first(),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      deleteInvoiceById(invoice.id);
    }
  });
});
