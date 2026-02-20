/**
 * LL-SCH-P0-03: Drag Reschedule & Resize Logic Tests
 * Tests move (updates start+end), recurring scope, and resize (updates end only).
 */
import { describe, it, expect } from 'vitest';
import { addMinutes, differenceInMinutes } from 'date-fns';

// ── Extracted pure logic from CalendarPage/useDragLesson/useResizeLesson ──

interface LessonSlot {
  id: string;
  start_at: string;
  end_at: string;
  recurrence_id: string | null;
}

/** Computes new start and end after dragging a lesson to a new time */
function computeMove(lesson: LessonSlot, newStart: Date): { start_at: string; end_at: string } {
  const originalStart = new Date(lesson.start_at);
  const originalEnd = new Date(lesson.end_at);
  const durationMs = originalEnd.getTime() - originalStart.getTime();

  const newEnd = new Date(newStart.getTime() + durationMs);

  return {
    start_at: newStart.toISOString(),
    end_at: newEnd.toISOString(),
  };
}

/** Computes new end time after resizing (start stays fixed) */
function computeResize(lesson: LessonSlot, newEnd: Date): { start_at: string; end_at: string } {
  return {
    start_at: lesson.start_at, // unchanged
    end_at: newEnd.toISOString(),
  };
}

/** Determines which lessons to update based on scope */
function getLessonIdsForScope(
  scope: 'this_only' | 'this_and_future',
  targetLesson: LessonSlot,
  allLessons: LessonSlot[]
): string[] {
  if (scope === 'this_only') {
    return [targetLesson.id];
  }

  // This and future: same recurrence_id, start_at >= target's start_at
  if (!targetLesson.recurrence_id) {
    return [targetLesson.id];
  }

  return allLessons
    .filter(
      l =>
        l.recurrence_id === targetLesson.recurrence_id &&
        l.start_at >= targetLesson.start_at
    )
    .map(l => l.id);
}

/** Calculates the time delta to apply to future lessons in a series */
function computeSeriesDelta(
  originalStart: Date,
  newStart: Date
): { deltaMs: number } {
  return { deltaMs: newStart.getTime() - originalStart.getTime() };
}

/** Applies a time delta to a lesson */
function applyDelta(lesson: LessonSlot, deltaMs: number): { start_at: string; end_at: string } {
  return {
    start_at: new Date(new Date(lesson.start_at).getTime() + deltaMs).toISOString(),
    end_at: new Date(new Date(lesson.end_at).getTime() + deltaMs).toISOString(),
  };
}

describe('LL-SCH-P0-03: Drag Reschedule', () => {
  describe('Move lesson updates start_at and end_at', () => {
    it('preserves duration when moving to a new time', () => {
      const lesson: LessonSlot = {
        id: 'L1',
        start_at: '2026-03-10T14:00:00.000Z',
        end_at: '2026-03-10T14:30:00.000Z',
        recurrence_id: null,
      };

      const newStart = new Date('2026-03-11T10:00:00.000Z');
      const result = computeMove(lesson, newStart);

      expect(result.start_at).toBe('2026-03-11T10:00:00.000Z');
      expect(result.end_at).toBe('2026-03-11T10:30:00.000Z');
    });

    it('preserves 60-minute duration', () => {
      const lesson: LessonSlot = {
        id: 'L1',
        start_at: '2026-03-10T09:00:00.000Z',
        end_at: '2026-03-10T10:00:00.000Z',
        recurrence_id: null,
      };

      const newStart = new Date('2026-03-12T15:00:00.000Z');
      const result = computeMove(lesson, newStart);

      const duration = differenceInMinutes(new Date(result.end_at), new Date(result.start_at));
      expect(duration).toBe(60);
    });

    it('moves across days correctly', () => {
      const lesson: LessonSlot = {
        id: 'L1',
        start_at: '2026-03-10T16:00:00.000Z',
        end_at: '2026-03-10T16:45:00.000Z',
        recurrence_id: null,
      };

      const newStart = new Date('2026-03-13T09:00:00.000Z');
      const result = computeMove(lesson, newStart);

      expect(result.start_at).toBe('2026-03-13T09:00:00.000Z');
      expect(result.end_at).toBe('2026-03-13T09:45:00.000Z');
    });
  });

  describe('Recurring lesson scope: this only vs this and future', () => {
    const seriesLessons: LessonSlot[] = [
      { id: 'L1', start_at: '2026-03-02T14:00:00Z', end_at: '2026-03-02T14:30:00Z', recurrence_id: 'R1' },
      { id: 'L2', start_at: '2026-03-09T14:00:00Z', end_at: '2026-03-09T14:30:00Z', recurrence_id: 'R1' },
      { id: 'L3', start_at: '2026-03-16T14:00:00Z', end_at: '2026-03-16T14:30:00Z', recurrence_id: 'R1' },
      { id: 'L4', start_at: '2026-03-23T14:00:00Z', end_at: '2026-03-23T14:30:00Z', recurrence_id: 'R1' },
    ];

    it('"this_only" returns only the target lesson', () => {
      const ids = getLessonIdsForScope('this_only', seriesLessons[1], seriesLessons);
      expect(ids).toEqual(['L2']);
    });

    it('"this_and_future" returns target and all future in series', () => {
      const ids = getLessonIdsForScope('this_and_future', seriesLessons[1], seriesLessons);
      expect(ids).toEqual(['L2', 'L3', 'L4']);
    });

    it('"this_and_future" on first lesson returns entire series', () => {
      const ids = getLessonIdsForScope('this_and_future', seriesLessons[0], seriesLessons);
      expect(ids).toEqual(['L1', 'L2', 'L3', 'L4']);
    });

    it('"this_and_future" on last lesson returns only that lesson', () => {
      const ids = getLessonIdsForScope('this_and_future', seriesLessons[3], seriesLessons);
      expect(ids).toEqual(['L4']);
    });

    it('"this_and_future" on non-recurring lesson returns only that lesson', () => {
      const standalone: LessonSlot = {
        id: 'S1',
        start_at: '2026-03-10T10:00:00Z',
        end_at: '2026-03-10T10:30:00Z',
        recurrence_id: null,
      };
      const ids = getLessonIdsForScope('this_and_future', standalone, [standalone]);
      expect(ids).toEqual(['S1']);
    });

    it('does not include lessons from a different series', () => {
      const mixedLessons: LessonSlot[] = [
        ...seriesLessons,
        { id: 'X1', start_at: '2026-03-09T14:00:00Z', end_at: '2026-03-09T14:30:00Z', recurrence_id: 'R2' },
      ];
      const ids = getLessonIdsForScope('this_and_future', seriesLessons[1], mixedLessons);
      expect(ids).not.toContain('X1');
    });
  });

  describe('Series delta application', () => {
    it('computes correct positive delta (move forward 1 hour)', () => {
      const orig = new Date('2026-03-09T14:00:00Z');
      const newStart = new Date('2026-03-09T15:00:00Z');
      const { deltaMs } = computeSeriesDelta(orig, newStart);
      expect(deltaMs).toBe(60 * 60 * 1000); // 1 hour
    });

    it('computes correct negative delta (move back 30 mins)', () => {
      const orig = new Date('2026-03-09T14:00:00Z');
      const newStart = new Date('2026-03-09T13:30:00Z');
      const { deltaMs } = computeSeriesDelta(orig, newStart);
      expect(deltaMs).toBe(-30 * 60 * 1000);
    });

    it('applies delta correctly to a future lesson', () => {
      const lesson: LessonSlot = {
        id: 'L3',
        start_at: '2026-03-16T14:00:00.000Z',
        end_at: '2026-03-16T14:30:00.000Z',
        recurrence_id: 'R1',
      };
      const deltaMs = 60 * 60 * 1000; // +1 hour

      const result = applyDelta(lesson, deltaMs);
      expect(result.start_at).toBe('2026-03-16T15:00:00.000Z');
      expect(result.end_at).toBe('2026-03-16T15:30:00.000Z');
    });
  });

  describe('Resize updates end_at but NOT start_at', () => {
    it('keeps start_at unchanged', () => {
      const lesson: LessonSlot = {
        id: 'L1',
        start_at: '2026-03-10T14:00:00.000Z',
        end_at: '2026-03-10T14:30:00.000Z',
        recurrence_id: null,
      };

      const newEnd = new Date('2026-03-10T15:00:00.000Z');
      const result = computeResize(lesson, newEnd);

      expect(result.start_at).toBe('2026-03-10T14:00:00.000Z'); // unchanged
      expect(result.end_at).toBe('2026-03-10T15:00:00.000Z');   // updated
    });

    it('extends duration from 30 to 60 minutes', () => {
      const lesson: LessonSlot = {
        id: 'L1',
        start_at: '2026-03-10T14:00:00.000Z',
        end_at: '2026-03-10T14:30:00.000Z',
        recurrence_id: null,
      };

      const newEnd = new Date('2026-03-10T15:00:00.000Z');
      const result = computeResize(lesson, newEnd);

      const duration = differenceInMinutes(new Date(result.end_at), new Date(result.start_at));
      expect(duration).toBe(60);
    });

    it('shrinks duration from 60 to 15 minutes', () => {
      const lesson: LessonSlot = {
        id: 'L1',
        start_at: '2026-03-10T14:00:00.000Z',
        end_at: '2026-03-10T15:00:00.000Z',
        recurrence_id: null,
      };

      const newEnd = new Date('2026-03-10T14:15:00.000Z');
      const result = computeResize(lesson, newEnd);

      const duration = differenceInMinutes(new Date(result.end_at), new Date(result.start_at));
      expect(duration).toBe(15);
    });
  });
});
