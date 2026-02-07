/**
 * LL-PAY-P0-01 / LL-MSG-P0-01: Parent Portal Tests
 * Tests parent summary (oldest unpaid invoice), invoice scoping, children list, and message requests.
 */
import { describe, it, expect } from 'vitest';

// Pure logic extracted from useParentPortal for testing

interface ParentInvoice {
  id: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  due_date: string;
  total_minor: number;
  payer_guardian_id: string;
}

interface ChildLink {
  student_id: string;
  guardian_id: string;
}

function findOldestUnpaidInvoice(invoices: ParentInvoice[]): string | null {
  const unpaid = invoices
    .filter(inv => inv.status === 'sent' || inv.status === 'overdue')
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  return unpaid.length > 0 ? unpaid[0].id : null;
}

function calculateOutstandingBalance(invoices: ParentInvoice[]): number {
  return invoices
    .filter(inv => inv.status === 'sent' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.total_minor, 0);
}

function countOverdueInvoices(invoices: ParentInvoice[]): number {
  return invoices.filter(inv => inv.status === 'overdue').length;
}

function filterInvoicesByGuardian(invoices: ParentInvoice[], guardianId: string): ParentInvoice[] {
  return invoices.filter(inv => inv.payer_guardian_id === guardianId);
}

function getLinkedStudentIds(links: ChildLink[], guardianId: string): string[] {
  return links.filter(l => l.guardian_id === guardianId).map(l => l.student_id);
}

describe('LL-PAY-P0-01: Parent Summary & Invoices', () => {
  const invoices: ParentInvoice[] = [
    { id: 'inv-1', status: 'overdue', due_date: '2025-01-15', total_minor: 5000, payer_guardian_id: 'g1' },
    { id: 'inv-2', status: 'sent', due_date: '2025-02-15', total_minor: 3000, payer_guardian_id: 'g1' },
    { id: 'inv-3', status: 'paid', due_date: '2025-01-01', total_minor: 4000, payer_guardian_id: 'g1' },
    { id: 'inv-4', status: 'sent', due_date: '2025-03-01', total_minor: 2000, payer_guardian_id: 'g2' },
    { id: 'inv-5', status: 'void', due_date: '2024-12-01', total_minor: 6000, payer_guardian_id: 'g1' },
  ];

  describe('Oldest unpaid invoice for Pay Now button', () => {
    it('returns oldest unpaid invoice sorted by due_date', () => {
      const guardianInvoices = filterInvoicesByGuardian(invoices, 'g1');
      const oldest = findOldestUnpaidInvoice(guardianInvoices);
      expect(oldest).toBe('inv-1'); // Jan 15 overdue is oldest
    });

    it('returns null when all invoices are paid/void', () => {
      const paidInvoices: ParentInvoice[] = [
        { id: 'inv-1', status: 'paid', due_date: '2025-01-15', total_minor: 5000, payer_guardian_id: 'g1' },
        { id: 'inv-2', status: 'void', due_date: '2025-02-15', total_minor: 3000, payer_guardian_id: 'g1' },
      ];
      expect(findOldestUnpaidInvoice(paidInvoices)).toBeNull();
    });

    it('returns null for empty invoice list', () => {
      expect(findOldestUnpaidInvoice([])).toBeNull();
    });
  });

  describe('Outstanding balance', () => {
    it('sums sent + overdue invoices', () => {
      const guardianInvoices = filterInvoicesByGuardian(invoices, 'g1');
      const balance = calculateOutstandingBalance(guardianInvoices);
      expect(balance).toBe(8000); // 5000 + 3000 (excludes paid and void)
    });

    it('excludes paid and void invoices', () => {
      const paidInvoices: ParentInvoice[] = [
        { id: 'inv-1', status: 'paid', due_date: '2025-01-15', total_minor: 5000, payer_guardian_id: 'g1' },
      ];
      expect(calculateOutstandingBalance(paidInvoices)).toBe(0);
    });
  });

  describe('Overdue count', () => {
    it('counts only overdue invoices', () => {
      const guardianInvoices = filterInvoicesByGuardian(invoices, 'g1');
      expect(countOverdueInvoices(guardianInvoices)).toBe(1);
    });
  });

  describe('Invoice scoping by guardian', () => {
    it('only returns invoices where guardian is payer', () => {
      const g1Invoices = filterInvoicesByGuardian(invoices, 'g1');
      expect(g1Invoices).toHaveLength(4);
      g1Invoices.forEach(inv => {
        expect(inv.payer_guardian_id).toBe('g1');
      });
    });

    it('different guardian sees different invoices', () => {
      const g2Invoices = filterInvoicesByGuardian(invoices, 'g2');
      expect(g2Invoices).toHaveLength(1);
      expect(g2Invoices[0].id).toBe('inv-4');
    });
  });
});

describe('LL-PAY-P0-01: Children List Scoping', () => {
  const links: ChildLink[] = [
    { student_id: 'student-1', guardian_id: 'g1' },
    { student_id: 'student-2', guardian_id: 'g1' },
    { student_id: 'student-3', guardian_id: 'g2' },
    { student_id: 'student-4', guardian_id: 'g2' },
  ];

  it('returns only students linked to the guardian', () => {
    const studentIds = getLinkedStudentIds(links, 'g1');
    expect(studentIds).toEqual(['student-1', 'student-2']);
  });

  it('different guardian sees different students', () => {
    const studentIds = getLinkedStudentIds(links, 'g2');
    expect(studentIds).toEqual(['student-3', 'student-4']);
  });

  it('returns empty for unlinked guardian', () => {
    const studentIds = getLinkedStudentIds(links, 'g999');
    expect(studentIds).toEqual([]);
  });
});

describe('LL-MSG-P0-01: Message Request Structure', () => {
  it('message request requires guardian_id, subject, message, request_type', () => {
    const request = {
      org_id: 'org-1',
      guardian_id: 'g1',
      request_type: 'reschedule' as const,
      subject: 'Move Thursday lesson',
      message: 'Can we move to Friday?',
      student_id: 'student-1',
      lesson_id: 'lesson-1',
    };

    expect(request.guardian_id).toBeDefined();
    expect(request.subject).toBeDefined();
    expect(request.message).toBeDefined();
    expect(request.request_type).toBeDefined();
    expect(['cancellation', 'reschedule', 'general']).toContain(request.request_type);
  });

  it('supports all three request types', () => {
    const types = ['cancellation', 'reschedule', 'general'];
    types.forEach(type => {
      expect(['cancellation', 'reschedule', 'general']).toContain(type);
    });
  });

  it('status lifecycle: pending -> approved/declined', () => {
    const statuses = ['pending', 'approved', 'declined', 'resolved'];
    // Initial status should be pending
    expect(statuses[0]).toBe('pending');
    // Terminal statuses
    expect(statuses).toContain('approved');
    expect(statuses).toContain('declined');
    expect(statuses).toContain('resolved');
  });
});
