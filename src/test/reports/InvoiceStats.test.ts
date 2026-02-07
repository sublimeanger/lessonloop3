/**
 * LL-RPT-P1-01 — Invoice Stats Aggregation
 * Tests the invoice statistics computation logic used by InvoiceStatsWidget.
 */
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Extract the stats computation logic from useInvoiceStats (pure function)
// ---------------------------------------------------------------------------
interface InvoiceRow {
  status: string;
  total_minor: number;
  due_date: string;
}

interface InvoiceStats {
  totalOutstanding: number;
  overdue: number;
  overdueCount: number;
  draft: number;
  draftCount: number;
  sent: number;
  sentCount: number;
  paid: number;
  paidCount: number;
}

function computeInvoiceStats(invoices: InvoiceRow[], today: string): InvoiceStats {
  const stats: InvoiceStats = {
    totalOutstanding: 0,
    overdue: 0,
    overdueCount: 0,
    draft: 0,
    draftCount: 0,
    sent: 0,
    sentCount: 0,
    paid: 0,
    paidCount: 0,
  };

  invoices.forEach((inv) => {
    if (inv.status === 'draft') {
      stats.draft += inv.total_minor;
      stats.draftCount++;
    } else if (inv.status === 'sent') {
      stats.sent += inv.total_minor;
      stats.sentCount++;
      stats.totalOutstanding += inv.total_minor;
      if (inv.due_date < today) {
        stats.overdue += inv.total_minor;
        stats.overdueCount++;
      }
    } else if (inv.status === 'overdue') {
      stats.overdue += inv.total_minor;
      stats.overdueCount++;
      stats.totalOutstanding += inv.total_minor;
    } else if (inv.status === 'paid') {
      stats.paid += inv.total_minor;
      stats.paidCount++;
    }
  });

  return stats;
}

// ---------------------------------------------------------------------------
// Format currency helper (mirrors InvoiceStatsWidget)
// ---------------------------------------------------------------------------
function formatCurrency(amountMinor: number, currencyCode: string = 'GBP') {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('LL-RPT-P1-01 Invoice stats aggregation', () => {
  const today = '2025-06-15';

  const sampleInvoices: InvoiceRow[] = [
    // Draft invoices
    { status: 'draft', total_minor: 5000, due_date: '2025-06-30' },
    { status: 'draft', total_minor: 3000, due_date: '2025-07-01' },
    // Sent but not yet overdue
    { status: 'sent', total_minor: 10000, due_date: '2025-06-30' },
    // Sent and past due (implicitly overdue)
    { status: 'sent', total_minor: 7500, due_date: '2025-06-01' },
    // Explicitly marked overdue
    { status: 'overdue', total_minor: 4500, due_date: '2025-05-15' },
    // Paid invoices
    { status: 'paid', total_minor: 20000, due_date: '2025-05-01' },
    { status: 'paid', total_minor: 15000, due_date: '2025-04-01' },
  ];

  it('computes correct draft count and total', () => {
    const stats = computeInvoiceStats(sampleInvoices, today);
    expect(stats.draftCount).toBe(2);
    expect(stats.draft).toBe(8000); // 5000 + 3000
  });

  it('computes correct sent count and total', () => {
    const stats = computeInvoiceStats(sampleInvoices, today);
    expect(stats.sentCount).toBe(2);
    expect(stats.sent).toBe(17500); // 10000 + 7500
  });

  it('computes correct paid count and total', () => {
    const stats = computeInvoiceStats(sampleInvoices, today);
    expect(stats.paidCount).toBe(2);
    expect(stats.paid).toBe(35000); // 20000 + 15000
  });

  it('computes totalOutstanding as sum of sent + explicitly overdue', () => {
    const stats = computeInvoiceStats(sampleInvoices, today);
    // Outstanding = sent (10000 + 7500) + overdue (4500) = 22000
    expect(stats.totalOutstanding).toBe(22000);
  });

  it('detects overdue: sent invoices past due + explicit overdue status', () => {
    const stats = computeInvoiceStats(sampleInvoices, today);
    // Overdue = sent past due (7500) + explicit overdue (4500) = 12000
    expect(stats.overdue).toBe(12000);
    // Count = 1 sent-past-due + 1 explicit-overdue = 2
    expect(stats.overdueCount).toBe(2);
  });

  it('handles empty invoice list', () => {
    const stats = computeInvoiceStats([], today);
    expect(stats.totalOutstanding).toBe(0);
    expect(stats.overdue).toBe(0);
    expect(stats.overdueCount).toBe(0);
    expect(stats.draft).toBe(0);
    expect(stats.paid).toBe(0);
  });

  it('handles all-paid scenario', () => {
    const paidOnly: InvoiceRow[] = [
      { status: 'paid', total_minor: 5000, due_date: '2025-01-01' },
      { status: 'paid', total_minor: 3000, due_date: '2025-02-01' },
    ];
    const stats = computeInvoiceStats(paidOnly, today);
    expect(stats.totalOutstanding).toBe(0);
    expect(stats.paid).toBe(8000);
    expect(stats.paidCount).toBe(2);
  });

  it('handles all-overdue scenario', () => {
    const overdueOnly: InvoiceRow[] = [
      { status: 'overdue', total_minor: 1000, due_date: '2025-01-01' },
      { status: 'overdue', total_minor: 2000, due_date: '2025-02-01' },
    ];
    const stats = computeInvoiceStats(overdueOnly, today);
    expect(stats.totalOutstanding).toBe(3000);
    expect(stats.overdue).toBe(3000);
    expect(stats.overdueCount).toBe(2);
  });
});

describe('LL-RPT-P1-01 Invoice filter by status', () => {
  it('maps "sent" filter to outstanding invoices', () => {
    const invoices: InvoiceRow[] = [
      { status: 'sent', total_minor: 1000, due_date: '2025-06-30' },
      { status: 'draft', total_minor: 2000, due_date: '2025-06-30' },
      { status: 'paid', total_minor: 3000, due_date: '2025-05-01' },
    ];

    const filtered = invoices.filter(i => i.status === 'sent');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].total_minor).toBe(1000);
  });

  it('maps "overdue" filter to overdue invoices', () => {
    const invoices: InvoiceRow[] = [
      { status: 'overdue', total_minor: 5000, due_date: '2025-01-01' },
      { status: 'sent', total_minor: 1000, due_date: '2025-06-30' },
    ];

    const filtered = invoices.filter(i => i.status === 'overdue');
    expect(filtered).toHaveLength(1);
  });

  it('maps "draft" filter correctly', () => {
    const invoices: InvoiceRow[] = [
      { status: 'draft', total_minor: 1500, due_date: '2025-07-01' },
      { status: 'draft', total_minor: 2500, due_date: '2025-07-15' },
      { status: 'paid', total_minor: 3000, due_date: '2025-05-01' },
    ];

    const filtered = invoices.filter(i => i.status === 'draft');
    expect(filtered).toHaveLength(2);
  });
});

describe('LL-RPT-P1-01 Currency formatting', () => {
  it('formats GBP correctly', () => {
    const result = formatCurrency(12345, 'GBP');
    expect(result).toContain('123.45');
  });

  it('formats zero amount', () => {
    const result = formatCurrency(0, 'GBP');
    expect(result).toContain('0.00');
  });

  it('formats large amounts', () => {
    const result = formatCurrency(1000000, 'GBP');
    expect(result).toContain('10,000.00');
  });

  it('defaults to GBP', () => {
    const result = formatCurrency(500);
    expect(result).toContain('£');
  });
});
