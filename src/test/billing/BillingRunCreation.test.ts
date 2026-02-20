/**
 * LL-BIL-P0-03: Billing Run Creation Logic Tests
 * Tests delivered vs upfront, already-billed exclusion, VAT, and credit offset.
 */
import { describe, it, expect } from 'vitest';

// ── Extracted pure billing logic ──

type LessonStatus = 'scheduled' | 'completed' | 'cancelled';

/** Determines which lesson statuses are billable per mode */
function getBillableStatuses(billingMode: 'delivered' | 'upfront'): LessonStatus[] {
  return billingMode === 'upfront' ? ['scheduled', 'completed'] : ['completed'];
}

/** Filters out already-billed lessons */
function excludeBilledLessons(
  lessons: Array<{ id: string }>,
  billedLessonIds: Set<string>
): Array<{ id: string }> {
  return lessons.filter(l => !billedLessonIds.has(l.id));
}

/** Groups lessons by payer, deduplicating lesson IDs */
function groupByPayer(
  lessons: Array<{
    id: string;
    participants: Array<{
      guardianId: string | null;
      studentId: string;
      isPrimaryPayer: boolean;
    }>;
  }>
): Map<string, { lessonCount: number; lessonIds: string[] }> {
  const groups = new Map<string, { lessonCount: number; lessonIds: string[]; seen: Set<string> }>();

  for (const lesson of lessons) {
    for (const p of lesson.participants) {
      const key = p.guardianId ? `guardian-${p.guardianId}` : `student-${p.studentId}`;
      if (!groups.has(key)) {
        groups.set(key, { lessonCount: 0, lessonIds: [], seen: new Set() });
      }
      const group = groups.get(key)!;
      if (!group.seen.has(lesson.id)) {
        group.lessonIds.push(lesson.id);
        group.lessonCount++;
        group.seen.add(lesson.id);
      }
    }
  }

  return new Map(
    [...groups.entries()].map(([k, v]) => [k, { lessonCount: v.lessonCount, lessonIds: v.lessonIds }])
  );
}

/** Calculates invoice totals */
function calculateInvoice(
  lessonCount: number,
  rateMinor: number,
  vatEnabled: boolean,
  vatRate: number,
  creditOffsetMinor: number
): { subtotal: number; tax: number; total: number } {
  const subtotal = lessonCount * rateMinor;
  const tax = vatEnabled ? Math.round(subtotal * (vatRate / 100)) : 0;
  const total = Math.max(0, subtotal + tax - creditOffsetMinor);
  return { subtotal, tax, total };
}

describe('LL-BIL-P0-03: Billing Run Creation', () => {
  describe('Delivered vs Upfront mode', () => {
    it('delivered mode only bills completed lessons', () => {
      const statuses = getBillableStatuses('delivered');
      expect(statuses).toEqual(['completed']);
      expect(statuses).not.toContain('scheduled');
    });

    it('upfront mode bills both scheduled and completed', () => {
      const statuses = getBillableStatuses('upfront');
      expect(statuses).toContain('scheduled');
      expect(statuses).toContain('completed');
    });

    it('neither mode bills cancelled lessons', () => {
      expect(getBillableStatuses('delivered')).not.toContain('cancelled');
      expect(getBillableStatuses('upfront')).not.toContain('cancelled');
    });

    it('filters lessons correctly per delivered mode', () => {
      const lessons = [
        { id: '1', status: 'completed' as const },
        { id: '2', status: 'scheduled' as const },
        { id: '3', status: 'cancelled' as const },
        { id: '4', status: 'completed' as const },
      ];
      const statuses = getBillableStatuses('delivered');
      const billable = lessons.filter(l => statuses.includes(l.status));
      expect(billable).toHaveLength(2);
      expect(billable.map(l => l.id)).toEqual(['1', '4']);
    });

    it('filters lessons correctly per upfront mode', () => {
      const lessons = [
        { id: '1', status: 'completed' as const },
        { id: '2', status: 'scheduled' as const },
        { id: '3', status: 'cancelled' as const },
      ];
      const statuses = getBillableStatuses('upfront');
      const billable = lessons.filter(l => statuses.includes(l.status));
      expect(billable).toHaveLength(2);
      expect(billable.map(l => l.id)).toEqual(['1', '2']);
    });
  });

  describe('Already-billed lesson exclusion', () => {
    it('excludes lessons that have existing invoice items', () => {
      const lessons = [{ id: 'L1' }, { id: 'L2' }, { id: 'L3' }, { id: 'L4' }];
      const billed = new Set(['L1', 'L3']);
      const unbilled = excludeBilledLessons(lessons, billed);

      expect(unbilled).toHaveLength(2);
      expect(unbilled.map(l => l.id)).toEqual(['L2', 'L4']);
    });

    it('returns all lessons when none are billed', () => {
      const lessons = [{ id: 'L1' }, { id: 'L2' }];
      const unbilled = excludeBilledLessons(lessons, new Set());
      expect(unbilled).toHaveLength(2);
    });

    it('returns empty when all lessons are billed', () => {
      const lessons = [{ id: 'L1' }, { id: 'L2' }];
      const billed = new Set(['L1', 'L2']);
      expect(excludeBilledLessons(lessons, billed)).toHaveLength(0);
    });

    it('handles empty lessons array', () => {
      expect(excludeBilledLessons([], new Set(['L1']))).toHaveLength(0);
    });
  });

  describe('VAT calculation', () => {
    it('calculates 20% VAT on £300 subtotal', () => {
      const result = calculateInvoice(10, 3000, true, 20, 0);
      expect(result.subtotal).toBe(30000); // £300
      expect(result.tax).toBe(6000);       // £60
      expect(result.total).toBe(36000);    // £360
    });

    it('zero VAT when VAT is disabled', () => {
      const result = calculateInvoice(10, 3000, false, 20, 0);
      expect(result.subtotal).toBe(30000);
      expect(result.tax).toBe(0);
      expect(result.total).toBe(30000);
    });

    it('zero VAT when rate is 0%', () => {
      const result = calculateInvoice(5, 2500, true, 0, 0);
      expect(result.tax).toBe(0);
      expect(result.total).toBe(12500);
    });

    it('rounds VAT to nearest penny', () => {
      // 3 × £33.33 = £99.99 = 9999 minor
      const result = calculateInvoice(3, 3333, true, 20, 0);
      expect(result.subtotal).toBe(9999);
      // 20% of 9999 = 1999.8 → 2000
      expect(result.tax).toBe(2000);
      expect(result.total).toBe(11999);
    });
  });

  describe('Credit offset calculation', () => {
    it('reduces total by credit amount', () => {
      const result = calculateInvoice(4, 3000, true, 20, 5000);
      // subtotal 12000, tax 2400, gross 14400, minus 5000 credit = 9400
      expect(result.total).toBe(9400);
    });

    it('total never goes below zero', () => {
      const result = calculateInvoice(1, 1000, false, 0, 99999);
      expect(result.total).toBe(0);
    });

    it('zero credit has no effect', () => {
      const result = calculateInvoice(2, 5000, false, 0, 0);
      expect(result.total).toBe(10000);
    });

    it('credit exactly equals total produces zero', () => {
      const result = calculateInvoice(2, 5000, true, 20, 12000);
      // subtotal 10000, tax 2000, total 12000, credit 12000 = 0
      expect(result.total).toBe(0);
    });
  });

  describe('Payer grouping and deduplication', () => {
    it('groups lessons by guardian payer', () => {
      const lessons = [
        { id: 'L1', participants: [{ guardianId: 'G1', studentId: 'S1', isPrimaryPayer: true }] },
        { id: 'L2', participants: [{ guardianId: 'G1', studentId: 'S2', isPrimaryPayer: true }] },
        { id: 'L3', participants: [{ guardianId: 'G2', studentId: 'S3', isPrimaryPayer: true }] },
      ];

      const groups = groupByPayer(lessons);
      expect(groups.size).toBe(2);
      expect(groups.get('guardian-G1')!.lessonCount).toBe(2);
      expect(groups.get('guardian-G2')!.lessonCount).toBe(1);
    });

    it('deduplicates when same lesson has multiple students with same payer', () => {
      const lessons = [
        {
          id: 'L1',
          participants: [
            { guardianId: 'G1', studentId: 'S1', isPrimaryPayer: true },
            { guardianId: 'G1', studentId: 'S2', isPrimaryPayer: true },
          ],
        },
      ];

      const groups = groupByPayer(lessons);
      expect(groups.get('guardian-G1')!.lessonCount).toBe(1); // Not 2
    });

    it('falls back to student payer when no guardian', () => {
      const lessons = [
        { id: 'L1', participants: [{ guardianId: null, studentId: 'S1', isPrimaryPayer: false }] },
      ];

      const groups = groupByPayer(lessons);
      expect(groups.has('student-S1')).toBe(true);
      expect(groups.get('student-S1')!.lessonCount).toBe(1);
    });
  });
});
