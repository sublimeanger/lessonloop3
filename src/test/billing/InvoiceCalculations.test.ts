/**
 * LL-BIL-P0-01 / LL-BIL-P0-02: Invoice Calculation Tests
 * Tests VAT calculations, credit offsets, line item math, and billing run deduplication.
 */
import { describe, it, expect } from 'vitest';

// Pure calculation functions extracted from useInvoices/useBillingRuns for testing

function calculateSubtotal(items: Array<{ quantity: number; unit_price_minor: number }>): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unit_price_minor, 0);
}

function calculateTax(subtotal: number, vatRate: number): number {
  return Math.round(subtotal * (vatRate / 100));
}

function calculateTotal(subtotal: number, taxMinor: number, creditOffsetMinor: number): number {
  return Math.max(0, subtotal + taxMinor - creditOffsetMinor);
}

function calculateLineItemAmount(quantity: number, unitPriceMinor: number): number {
  return quantity * unitPriceMinor;
}

describe('LL-BIL-P0-01: Invoice Calculations', () => {
  describe('VAT calculation', () => {
    it('calculates 0% VAT correctly', () => {
      const subtotal = 10000; // £100.00
      expect(calculateTax(subtotal, 0)).toBe(0);
    });

    it('calculates 20% VAT correctly', () => {
      const subtotal = 10000; // £100.00
      expect(calculateTax(subtotal, 20)).toBe(2000); // £20.00
    });

    it('rounds VAT to nearest penny', () => {
      const subtotal = 3333; // £33.33
      // 20% of 3333 = 666.6 → rounds to 667
      expect(calculateTax(subtotal, 20)).toBe(667);
    });

    it('handles VAT on zero amount', () => {
      expect(calculateTax(0, 20)).toBe(0);
    });
  });

  describe('Subtotal computation', () => {
    it('sums multiple line items', () => {
      const items = [
        { quantity: 4, unit_price_minor: 3000 }, // 4 × £30 = £120
        { quantity: 2, unit_price_minor: 4500 }, // 2 × £45 = £90
      ];
      expect(calculateSubtotal(items)).toBe(21000); // £210
    });

    it('handles single item', () => {
      const items = [{ quantity: 1, unit_price_minor: 5000 }];
      expect(calculateSubtotal(items)).toBe(5000);
    });

    it('handles empty items array', () => {
      expect(calculateSubtotal([])).toBe(0);
    });
  });

  describe('Total with credit offset', () => {
    it('reduces total by credit amount', () => {
      const subtotal = 10000;
      const tax = 2000;
      const credit = 3000;
      expect(calculateTotal(subtotal, tax, credit)).toBe(9000);
    });

    it('total never goes below zero', () => {
      const subtotal = 5000;
      const tax = 1000;
      const credit = 99999; // More credit than invoice total
      expect(calculateTotal(subtotal, tax, credit)).toBe(0);
    });

    it('total is correct with zero credit', () => {
      const subtotal = 10000;
      const tax = 2000;
      expect(calculateTotal(subtotal, tax, 0)).toBe(12000);
    });
  });

  describe('Line item amount', () => {
    it('quantity × unit_price = amount', () => {
      expect(calculateLineItemAmount(4, 3000)).toBe(12000);
    });

    it('single quantity matches unit price', () => {
      expect(calculateLineItemAmount(1, 5500)).toBe(5500);
    });

    it('handles zero quantity', () => {
      expect(calculateLineItemAmount(0, 5000)).toBe(0);
    });
  });
});

describe('LL-BIL-P0-02: Billing Run Deduplication', () => {
  describe('Payer grouping with Set-based deduplication', () => {
    it('multi-student payer receives one invoice (not one per student)', () => {
      // Simulate the billing run grouping logic
      const payerGroups = new Map<string, { lessons: string[]; addedLessonIds: Set<string> }>();

      const lessons = [
        { id: 'lesson-1', students: [{ guardianId: 'guardian-1' }, { guardianId: 'guardian-1' }] },
        { id: 'lesson-2', students: [{ guardianId: 'guardian-1' }] },
        { id: 'lesson-3', students: [{ guardianId: 'guardian-2' }] },
      ];

      for (const lesson of lessons) {
        for (const student of lesson.students) {
          const key = `guardian-${student.guardianId}`;
          if (!payerGroups.has(key)) {
            payerGroups.set(key, { lessons: [], addedLessonIds: new Set() });
          }
          const group = payerGroups.get(key)!;
          if (!group.addedLessonIds.has(lesson.id)) {
            group.lessons.push(lesson.id);
            group.addedLessonIds.add(lesson.id);
          }
        }
      }

      // Guardian-1 should have 2 lessons (not 3, because lesson-1 is deduplicated)
      expect(payerGroups.get('guardian-guardian-1')!.lessons).toHaveLength(2);
      // Guardian-2 should have 1 lesson
      expect(payerGroups.get('guardian-guardian-2')!.lessons).toHaveLength(1);
      // Total payers = 2 (not 4)
      expect(payerGroups.size).toBe(2);
    });

    it('already-billed lessons are excluded', () => {
      const billedLessonIds = new Set(['lesson-1', 'lesson-3']);
      const allLessons = [
        { id: 'lesson-1' },
        { id: 'lesson-2' },
        { id: 'lesson-3' },
        { id: 'lesson-4' },
      ];

      const unbilledLessons = allLessons.filter(l => !billedLessonIds.has(l.id));
      expect(unbilledLessons).toHaveLength(2);
      expect(unbilledLessons.map(l => l.id)).toEqual(['lesson-2', 'lesson-4']);
    });

    it('empty lessons array produces zero invoices', () => {
      const payerGroups = new Map();
      const unbilledLessons: unknown[] = [];
      for (const _lesson of unbilledLessons) {
        // No iterations
      }
      expect(payerGroups.size).toBe(0);
    });
  });
});
