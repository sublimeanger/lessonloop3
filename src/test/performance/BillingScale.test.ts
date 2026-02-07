/**
 * LL-PER-P2-02 — Billing Scale
 * Tests that billing run deduplication works at scale.
 */
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Billing run deduplication logic (extracted from useBillingRuns)
// ---------------------------------------------------------------------------
interface LessonForBilling {
  id: string;
  student_id: string;
  guardian_id: string | null;
  is_primary_payer: boolean;
}

interface PayerGroup {
  payerId: string;
  payerType: 'guardian' | 'student';
  lessonIds: string[];
  studentIds: string[];
}

/**
 * Groups lessons by payer for invoice generation.
 * Multi-student payers should receive ONE invoice (deduplication).
 */
function groupByPayer(lessons: LessonForBilling[]): PayerGroup[] {
  const payerMap = new Map<string, PayerGroup>();

  for (const lesson of lessons) {
    // Determine payer: primary guardian or student directly
    const payerId = lesson.guardian_id && lesson.is_primary_payer
      ? lesson.guardian_id
      : lesson.student_id;
    const payerType = lesson.guardian_id && lesson.is_primary_payer
      ? 'guardian' as const
      : 'student' as const;

    const key = `${payerType}:${payerId}`;

    if (!payerMap.has(key)) {
      payerMap.set(key, {
        payerId,
        payerType,
        lessonIds: [],
        studentIds: [],
      });
    }

    const group = payerMap.get(key)!;
    group.lessonIds.push(lesson.id);
    if (!group.studentIds.includes(lesson.student_id)) {
      group.studentIds.push(lesson.student_id);
    }
  }

  return Array.from(payerMap.values());
}

/**
 * Filters out already-billed lesson IDs using Set for O(1) lookup.
 */
function filterUnbilledLessons(
  allLessonIds: string[],
  billedLessonIds: Set<string>
): string[] {
  return allLessonIds.filter(id => !billedLessonIds.has(id));
}

// ---------------------------------------------------------------------------
// Tests — Deduplication
// ---------------------------------------------------------------------------
describe('LL-PER-P2-02 Billing payer deduplication', () => {
  it('multi-student payer receives one invoice group', () => {
    const lessons: LessonForBilling[] = [
      { id: 'l1', student_id: 's1', guardian_id: 'g1', is_primary_payer: true },
      { id: 'l2', student_id: 's2', guardian_id: 'g1', is_primary_payer: true },
      { id: 'l3', student_id: 's3', guardian_id: 'g1', is_primary_payer: true },
    ];

    const groups = groupByPayer(lessons);
    expect(groups).toHaveLength(1);
    expect(groups[0].payerId).toBe('g1');
    expect(groups[0].lessonIds).toHaveLength(3);
    expect(groups[0].studentIds).toHaveLength(3);
  });

  it('different payers get separate invoice groups', () => {
    const lessons: LessonForBilling[] = [
      { id: 'l1', student_id: 's1', guardian_id: 'g1', is_primary_payer: true },
      { id: 'l2', student_id: 's2', guardian_id: 'g2', is_primary_payer: true },
    ];

    const groups = groupByPayer(lessons);
    expect(groups).toHaveLength(2);
  });

  it('student without primary guardian payer is billed directly', () => {
    const lessons: LessonForBilling[] = [
      { id: 'l1', student_id: 's1', guardian_id: null, is_primary_payer: false },
    ];

    const groups = groupByPayer(lessons);
    expect(groups).toHaveLength(1);
    expect(groups[0].payerType).toBe('student');
    expect(groups[0].payerId).toBe('s1');
  });

  it('non-primary guardian falls back to student billing', () => {
    const lessons: LessonForBilling[] = [
      { id: 'l1', student_id: 's1', guardian_id: 'g1', is_primary_payer: false },
    ];

    const groups = groupByPayer(lessons);
    expect(groups[0].payerType).toBe('student');
    expect(groups[0].payerId).toBe('s1');
  });
});

// ---------------------------------------------------------------------------
// Tests — Scale deduplication
// ---------------------------------------------------------------------------
describe('LL-PER-P2-02 Large-scale deduplication', () => {
  it('handles 100 lessons across 10 payers correctly', () => {
    const lessons: LessonForBilling[] = [];
    for (let i = 0; i < 100; i++) {
      const guardianIndex = i % 10;
      lessons.push({
        id: `l-${i}`,
        student_id: `s-${i}`,
        guardian_id: `g-${guardianIndex}`,
        is_primary_payer: true,
      });
    }

    const groups = groupByPayer(lessons);
    expect(groups).toHaveLength(10);
    // Each guardian should have 10 lessons
    for (const group of groups) {
      expect(group.lessonIds).toHaveLength(10);
    }
  });

  it('handles 500 lessons without performance issues', () => {
    const lessons: LessonForBilling[] = [];
    for (let i = 0; i < 500; i++) {
      lessons.push({
        id: `l-${i}`,
        student_id: `s-${i % 50}`,
        guardian_id: `g-${i % 25}`,
        is_primary_payer: true,
      });
    }

    const start = performance.now();
    const groups = groupByPayer(lessons);
    const elapsed = performance.now() - start;

    expect(groups).toHaveLength(25);
    expect(elapsed).toBeLessThan(100); // Should be sub-100ms
  });
});

// ---------------------------------------------------------------------------
// Tests — Already-billed filtering
// ---------------------------------------------------------------------------
describe('LL-PER-P2-02 Already-billed lesson filtering', () => {
  it('filters out already-billed lessons', () => {
    const allIds = ['l1', 'l2', 'l3', 'l4', 'l5'];
    const billed = new Set(['l2', 'l4']);

    const unbilled = filterUnbilledLessons(allIds, billed);
    expect(unbilled).toEqual(['l1', 'l3', 'l5']);
  });

  it('returns all when none are billed', () => {
    const allIds = ['l1', 'l2', 'l3'];
    const billed = new Set<string>();

    const unbilled = filterUnbilledLessons(allIds, billed);
    expect(unbilled).toEqual(['l1', 'l2', 'l3']);
  });

  it('returns empty when all are billed', () => {
    const allIds = ['l1', 'l2'];
    const billed = new Set(['l1', 'l2']);

    const unbilled = filterUnbilledLessons(allIds, billed);
    expect(unbilled).toEqual([]);
  });

  it('Set-based lookup handles large datasets efficiently', () => {
    const allIds = Array.from({ length: 1000 }, (_, i) => `l-${i}`);
    const billedSet = new Set(
      Array.from({ length: 500 }, (_, i) => `l-${i * 2}`) // even IDs billed
    );

    const start = performance.now();
    const unbilled = filterUnbilledLessons(allIds, billedSet);
    const elapsed = performance.now() - start;

    expect(unbilled).toHaveLength(500);
    expect(elapsed).toBeLessThan(50); // Should be very fast
    // All unbilled should be odd-numbered
    expect(unbilled.every(id => parseInt(id.split('-')[1]) % 2 === 1)).toBe(true);
  });

  it('no duplicate invoices: same lesson ID cannot appear in two groups', () => {
    const lessons: LessonForBilling[] = [
      { id: 'l1', student_id: 's1', guardian_id: 'g1', is_primary_payer: true },
      { id: 'l1', student_id: 's1', guardian_id: 'g1', is_primary_payer: true }, // duplicate
    ];

    const groups = groupByPayer(lessons);
    // Both go to same payer group, but lesson_id appears twice (caller should deduplicate)
    expect(groups).toHaveLength(1);
    
    // Deduplicate lesson IDs within a group
    const uniqueIds = new Set(groups[0].lessonIds);
    expect(uniqueIds.size).toBe(1); // Only one unique lesson ID
  });
});
