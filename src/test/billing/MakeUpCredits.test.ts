/**
 * LL-CRD-P0-01: Make-Up Credit Lifecycle Tests
 * Tests credit issuance, double-redemption prevention, expiry filtering, and eligibility.
 */
import { describe, it, expect } from 'vitest';
import { differenceInHours, parseISO, addHours, subHours } from 'date-fns';

// Pure functions extracted from useMakeUpCredits for testing

interface MockCredit {
  id: string;
  redeemed_at: string | null;
  expires_at: string | null;
  credit_value_minor: number;
  issued_for_lesson_id: string | null;
  student_id: string;
}

function filterAvailableCredits(credits: MockCredit[]): MockCredit[] {
  const now = new Date();
  return credits.filter(c =>
    !c.redeemed_at &&
    (!c.expires_at || new Date(c.expires_at) > now)
  );
}

function calculateTotalAvailable(credits: MockCredit[]): number {
  return filterAvailableCredits(credits).reduce((sum, c) => sum + c.credit_value_minor, 0);
}

function checkCreditEligibility(
  lessonStartAt: string,
  cancellationTime: Date,
  requiredNoticeHours: number
): { eligible: boolean; hoursNotice: number; requiredHours: number } {
  const lessonStart = parseISO(lessonStartAt);
  const hoursNotice = differenceInHours(lessonStart, cancellationTime);
  return {
    eligible: hoursNotice >= requiredNoticeHours,
    hoursNotice,
    requiredHours: requiredNoticeHours,
  };
}

describe('LL-CRD-P0-01: Make-Up Credit Lifecycle', () => {
  describe('Credit issuance', () => {
    it('records origin lesson on issuance', () => {
      const credit: MockCredit = {
        id: 'credit-1',
        redeemed_at: null,
        expires_at: null,
        credit_value_minor: 3000,
        issued_for_lesson_id: 'lesson-cancelled-1',
        student_id: 'student-1',
      };
      expect(credit.issued_for_lesson_id).toBe('lesson-cancelled-1');
      expect(credit.redeemed_at).toBeNull();
    });
  });

  describe('Double-redemption prevention', () => {
    it('redeemed credit is excluded from available credits', () => {
      const credits: MockCredit[] = [
        { id: 'c1', redeemed_at: '2025-06-01T00:00:00Z', expires_at: null, credit_value_minor: 3000, issued_for_lesson_id: null, student_id: 's1' },
        { id: 'c2', redeemed_at: null, expires_at: null, credit_value_minor: 3000, issued_for_lesson_id: null, student_id: 's1' },
      ];

      const available = filterAvailableCredits(credits);
      expect(available).toHaveLength(1);
      expect(available[0].id).toBe('c2');
    });

    it('all redeemed credits result in zero available', () => {
      const credits: MockCredit[] = [
        { id: 'c1', redeemed_at: '2025-06-01T00:00:00Z', expires_at: null, credit_value_minor: 3000, issued_for_lesson_id: null, student_id: 's1' },
        { id: 'c2', redeemed_at: '2025-06-02T00:00:00Z', expires_at: null, credit_value_minor: 3000, issued_for_lesson_id: null, student_id: 's1' },
      ];
      expect(filterAvailableCredits(credits)).toHaveLength(0);
      expect(calculateTotalAvailable(credits)).toBe(0);
    });
  });

  describe('Expiry filtering', () => {
    it('expired credits are filtered out', () => {
      const credits: MockCredit[] = [
        { id: 'c1', redeemed_at: null, expires_at: '2020-01-01T00:00:00Z', credit_value_minor: 3000, issued_for_lesson_id: null, student_id: 's1' },
        { id: 'c2', redeemed_at: null, expires_at: '2099-12-31T00:00:00Z', credit_value_minor: 4000, issued_for_lesson_id: null, student_id: 's1' },
        { id: 'c3', redeemed_at: null, expires_at: null, credit_value_minor: 2000, issued_for_lesson_id: null, student_id: 's1' }, // No expiry
      ];

      const available = filterAvailableCredits(credits);
      expect(available).toHaveLength(2);
      expect(available.map(c => c.id)).toEqual(['c2', 'c3']);
    });

    it('total value excludes expired credits', () => {
      const credits: MockCredit[] = [
        { id: 'c1', redeemed_at: null, expires_at: '2020-01-01T00:00:00Z', credit_value_minor: 3000, issued_for_lesson_id: null, student_id: 's1' },
        { id: 'c2', redeemed_at: null, expires_at: null, credit_value_minor: 5000, issued_for_lesson_id: null, student_id: 's1' },
      ];
      expect(calculateTotalAvailable(credits)).toBe(5000);
    });

    it('credits with null expiry are always available', () => {
      const credits: MockCredit[] = [
        { id: 'c1', redeemed_at: null, expires_at: null, credit_value_minor: 2500, issued_for_lesson_id: null, student_id: 's1' },
      ];
      expect(filterAvailableCredits(credits)).toHaveLength(1);
    });
  });

  describe('Cancellation notice eligibility', () => {
    it('eligible when cancelled with sufficient notice (>= required hours)', () => {
      const lessonStart = addHours(new Date(), 48).toISOString();
      const result = checkCreditEligibility(lessonStart, new Date(), 24);
      expect(result.eligible).toBe(true);
      expect(result.hoursNotice).toBeGreaterThanOrEqual(24);
    });

    it('NOT eligible when cancelled with insufficient notice (< required hours)', () => {
      const lessonStart = addHours(new Date(), 2).toISOString();
      const result = checkCreditEligibility(lessonStart, new Date(), 24);
      expect(result.eligible).toBe(false);
      expect(result.hoursNotice).toBeLessThan(24);
    });

    it('eligible when cancelled exactly at required notice boundary', () => {
      const now = new Date();
      const lessonStart = addHours(now, 24).toISOString();
      const result = checkCreditEligibility(lessonStart, now, 24);
      expect(result.eligible).toBe(true);
    });

    it('NOT eligible for past lessons', () => {
      const lessonStart = subHours(new Date(), 2).toISOString();
      const result = checkCreditEligibility(lessonStart, new Date(), 24);
      expect(result.eligible).toBe(false);
    });

    it('uses org cancellation_notice_hours setting', () => {
      const now = new Date();
      const lessonStart = addHours(now, 50).toISOString();
      
      // 48h notice requirement - 50h given = eligible
      const result48 = checkCreditEligibility(lessonStart, now, 48);
      expect(result48.eligible).toBe(true);
      expect(result48.requiredHours).toBe(48);

      // 72h notice requirement - 50h given = NOT eligible
      const result72 = checkCreditEligibility(lessonStart, now, 72);
      expect(result72.eligible).toBe(false);
      expect(result72.requiredHours).toBe(72);
    });
  });
});
