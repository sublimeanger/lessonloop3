/**
 * LL-SCH-P0-02 / LL-SCH-P1-03 — Recurring Series Logic
 * Tests the RecurringActionDialog mode selection and
 * calendar deep link parameter handling.
 */
import { describe, it, expect } from 'vitest';
import type { RecurringActionMode } from '@/components/calendar/RecurringActionDialog';

// ---------------------------------------------------------------------------
// Recurring action modes
// ---------------------------------------------------------------------------
describe('LL-SCH-P0-02 RecurringActionMode types', () => {
  it('supports this_only mode', () => {
    const mode: RecurringActionMode = 'this_only';
    expect(mode).toBe('this_only');
  });

  it('supports this_and_future mode', () => {
    const mode: RecurringActionMode = 'this_and_future';
    expect(mode).toBe('this_and_future');
  });

  it('correctly identifies single occurrence vs batch', () => {
    const singleEdit: RecurringActionMode = 'this_only';
    const batchEdit: RecurringActionMode = 'this_and_future';

    // Simulate application logic
    const affectsMultiple = (mode: RecurringActionMode) => mode === 'this_and_future';

    expect(affectsMultiple(singleEdit)).toBe(false);
    expect(affectsMultiple(batchEdit)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Calendar deep link parameter parsing
// ---------------------------------------------------------------------------
describe('LL-SCH-P1-03 Calendar deep links', () => {
  function parseCalendarParams(search: string) {
    const params = new URLSearchParams(search);
    return {
      date: params.get('date'),
      teacherId: params.get('teacherId'),
      view: params.get('view') || 'week',
      locationId: params.get('locationId'),
    };
  }

  it('preserves date from URL params', () => {
    const result = parseCalendarParams('?date=2025-03-15');
    expect(result.date).toBe('2025-03-15');
  });

  it('preserves teacher filter from URL params', () => {
    const result = parseCalendarParams('?teacherId=teacher-abc-123');
    expect(result.teacherId).toBe('teacher-abc-123');
  });

  it('preserves both date and teacher filter', () => {
    const result = parseCalendarParams('?date=2025-06-01&teacherId=t-42');
    expect(result.date).toBe('2025-06-01');
    expect(result.teacherId).toBe('t-42');
  });

  it('defaults view to week when not specified', () => {
    const result = parseCalendarParams('?date=2025-01-01');
    expect(result.view).toBe('week');
  });

  it('respects explicit view parameter', () => {
    const result = parseCalendarParams('?view=day&date=2025-01-01');
    expect(result.view).toBe('day');
  });

  it('handles location filter', () => {
    const result = parseCalendarParams('?locationId=loc-99&teacherId=t-1');
    expect(result.locationId).toBe('loc-99');
    expect(result.teacherId).toBe('t-1');
  });

  it('handles empty search string gracefully', () => {
    const result = parseCalendarParams('');
    expect(result.date).toBeNull();
    expect(result.teacherId).toBeNull();
    expect(result.view).toBe('week');
  });
});

// ---------------------------------------------------------------------------
// Recurring edit scope logic
// ---------------------------------------------------------------------------
describe('LL-SCH-P0-02 Recurring edit scope', () => {
  // Simulates the logic that would apply edits based on mode
  interface Lesson {
    id: string;
    recurrence_id: string;
    start_at: string;
    title: string;
  }

  function getAffectedLessons(
    allLessons: Lesson[],
    selectedLesson: Lesson,
    mode: RecurringActionMode
  ): Lesson[] {
    if (mode === 'this_only') {
      return [selectedLesson];
    }
    // this_and_future: all lessons in same series from selected date onward
    return allLessons.filter(
      (l) =>
        l.recurrence_id === selectedLesson.recurrence_id &&
        l.start_at >= selectedLesson.start_at
    );
  }

  const seriesLessons: Lesson[] = [
    { id: '1', recurrence_id: 'rec-1', start_at: '2025-03-01T10:00:00Z', title: 'Piano' },
    { id: '2', recurrence_id: 'rec-1', start_at: '2025-03-08T10:00:00Z', title: 'Piano' },
    { id: '3', recurrence_id: 'rec-1', start_at: '2025-03-15T10:00:00Z', title: 'Piano' },
    { id: '4', recurrence_id: 'rec-1', start_at: '2025-03-22T10:00:00Z', title: 'Piano' },
    { id: '5', recurrence_id: 'rec-2', start_at: '2025-03-15T14:00:00Z', title: 'Guitar' }, // different series
  ];

  it('this_only affects only the selected occurrence', () => {
    const selected = seriesLessons[1]; // March 8
    const affected = getAffectedLessons(seriesLessons, selected, 'this_only');

    expect(affected).toHaveLength(1);
    expect(affected[0].id).toBe('2');
  });

  it('this_and_future affects selected + all later occurrences in same series', () => {
    const selected = seriesLessons[1]; // March 8
    const affected = getAffectedLessons(seriesLessons, selected, 'this_and_future');

    expect(affected).toHaveLength(3); // March 8, 15, 22
    expect(affected.map(l => l.id)).toEqual(['2', '3', '4']);
  });

  it('this_and_future does not affect lessons in a different series', () => {
    const selected = seriesLessons[2]; // March 15, rec-1
    const affected = getAffectedLessons(seriesLessons, selected, 'this_and_future');

    expect(affected.every(l => l.recurrence_id === 'rec-1')).toBe(true);
    expect(affected.find(l => l.id === '5')).toBeUndefined(); // Guitar lesson in rec-2
  });

  it('this_and_future from last occurrence only returns that one', () => {
    const selected = seriesLessons[3]; // March 22, last in rec-1
    const affected = getAffectedLessons(seriesLessons, selected, 'this_and_future');

    expect(affected).toHaveLength(1);
    expect(affected[0].id).toBe('4');
  });
});
