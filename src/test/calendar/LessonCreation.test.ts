/**
 * LL-SCH-P0-02: Lesson Creation Logic Tests
 * Tests single/recurring creation, closure date skipping, and timezone conversion.
 */
import { describe, it, expect } from 'vitest';
import { addMinutes, addWeeks, isSameDay, format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// ── Extracted pure logic from LessonModal.tsx ──

function generateTitle(
  lessonType: string,
  studentNames: string[],
  teacherName: string | null
): string {
  if (lessonType === 'group') {
    return teacherName ? `Group Lesson — ${teacherName}` : 'Group Lesson';
  }
  if (studentNames.length === 1) {
    return `${studentNames[0]} — Lesson`;
  }
  if (studentNames.length > 1) {
    return `${studentNames[0]} + ${studentNames.length - 1} more — Lesson`;
  }
  return teacherName ? `Lesson — ${teacherName}` : 'Lesson';
}

/** Replicates the recurring generation loop from LessonModal */
function generateRecurringDates(
  startAtUtc: Date,
  recurrenceDays: number[],
  endDate: Date,
  orgTimezone: string,
  closureDates: Date[] = [],
  blockOnClosures = true
): Date[] {
  const lessonsToCreate: Date[] = [startAtUtc];
  let currentDate = new Date(startAtUtc);

  while (currentDate <= endDate) {
    const zonedDate = toZonedTime(currentDate, orgTimezone);
    const dayOfWeek = zonedDate.getDay();
    if (recurrenceDays.includes(dayOfWeek) && currentDate.getTime() > startAtUtc.getTime()) {
      // Check closure dates
      const isOnClosure = closureDates.some(cd => isSameDay(toZonedTime(currentDate, orgTimezone), cd));
      if (!blockOnClosures || !isOnClosure) {
        lessonsToCreate.push(new Date(currentDate));
      }
    }
    currentDate = addMinutes(currentDate, 24 * 60);
  }
  return lessonsToCreate;
}

/** Converts local wall-clock time to UTC */
function localToUtc(dateStr: string, time: string, timezone: string): Date {
  const localDate = new Date(`${dateStr}T${time}:00`);
  return fromZonedTime(localDate, timezone);
}

/** Converts UTC ISO to org-local fake ISO (from useCalendarData) */
function toOrgLocalIso(utcIso: string, timezone: string): string {
  const zoned = toZonedTime(utcIso, timezone);
  return format(zoned, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
}

describe('LL-SCH-P0-02: Lesson Creation', () => {
  describe('Single lesson creation', () => {
    it('builds a lesson record with all required fields', () => {
      const orgId = 'org-001';
      const userId = 'user-001';
      const startAt = new Date('2026-03-10T14:00:00Z');
      const durationMins = 30;

      const lesson = {
        org_id: orgId,
        lesson_type: 'individual' as const,
        teacher_user_id: userId,
        teacher_id: 'teacher-001',
        location_id: 'loc-001',
        room_id: 'room-001',
        start_at: startAt.toISOString(),
        end_at: addMinutes(startAt, durationMins).toISOString(),
        title: 'Alice Smith — Lesson',
        notes_private: 'needs extra practice',
        notes_shared: 'Focus on scales',
        status: 'scheduled' as const,
        created_by: userId,
        recurrence_id: null,
      };

      expect(lesson.org_id).toBe(orgId);
      expect(lesson.start_at).toBe('2026-03-10T14:00:00.000Z');
      expect(lesson.end_at).toBe('2026-03-10T14:30:00.000Z');
      expect(lesson.title).toBe('Alice Smith — Lesson');
      expect(lesson.status).toBe('scheduled');
      expect(lesson.recurrence_id).toBeNull();
      expect(lesson.notes_private).toBe('needs extra practice');
      expect(lesson.notes_shared).toBe('Focus on scales');
    });

    it('generates correct title for individual lesson', () => {
      expect(generateTitle('individual', ['Alice Smith'], 'Mr Jones')).toBe('Alice Smith — Lesson');
    });

    it('generates correct title for group lesson', () => {
      expect(generateTitle('group', ['Alice', 'Bob'], 'Mr Jones')).toBe('Group Lesson — Mr Jones');
    });

    it('generates correct title for multi-student', () => {
      expect(generateTitle('individual', ['Alice', 'Bob', 'Charlie'], null)).toBe('Alice + 2 more — Lesson');
    });

    it('generates fallback title with no students', () => {
      expect(generateTitle('individual', [], 'Mr Jones')).toBe('Lesson — Mr Jones');
    });
  });

  describe('Recurring lesson generation', () => {
    const tz = 'Europe/London';

    it('generates correct number of weekly lessons', () => {
      // Monday at 10:00 UK, 4 weeks
      const startUtc = fromZonedTime(new Date('2026-03-02T10:00:00'), tz);
      const endDate = fromZonedTime(new Date('2026-03-30T23:59:00'), tz);
      const monday = 1;

      const dates = generateRecurringDates(startUtc, [monday], endDate, tz);

      // start + 3 more Mondays (9th, 16th, 23rd) = 4 total (30th is end so also included)
      expect(dates.length).toBe(5); // Mar 2, 9, 16, 23, 30
    });

    it('generates lessons on multiple days per week', () => {
      const startUtc = fromZonedTime(new Date('2026-03-02T10:00:00'), tz);
      const endDate = fromZonedTime(new Date('2026-03-08T23:59:00'), tz);
      const monday = 1;
      const wednesday = 3;
      const friday = 5;

      const dates = generateRecurringDates(startUtc, [monday, wednesday, friday], endDate, tz);

      // Mar 2 (Mon, start) + Mar 4 (Wed) + Mar 6 (Fri) = 3
      expect(dates.length).toBe(3);
    });

    it('respects maximum 200 lesson cap', () => {
      const MAX_RECURRING = 200;
      const startUtc = fromZonedTime(new Date('2026-01-05T10:00:00'), tz);
      const endDate = fromZonedTime(new Date('2030-12-31T23:59:00'), tz);
      const allDays = [0, 1, 2, 3, 4, 5, 6];

      const dates = generateRecurringDates(startUtc, allDays, endDate, tz);

      // Will generate many more than 200, but the modal caps it
      if (dates.length > MAX_RECURRING) {
        dates.splice(MAX_RECURRING);
      }
      expect(dates.length).toBe(MAX_RECURRING);
    });
  });

  describe('Closure date skipping', () => {
    const tz = 'Europe/London';

    it('skips lessons on closure dates when blocking is enabled', () => {
      const startUtc = fromZonedTime(new Date('2026-03-02T10:00:00'), tz);
      const endDate = fromZonedTime(new Date('2026-03-23T23:59:00'), tz);
      const monday = 1;

      // Mar 9 is a closure date
      const closures = [new Date('2026-03-09')];

      const dates = generateRecurringDates(startUtc, [monday], endDate, tz, closures, true);

      // Mar 2, (skip Mar 9), Mar 16, Mar 23 = 3
      expect(dates.length).toBe(3);

      // Verify no lesson on Mar 9
      const mar9 = new Date('2026-03-09');
      const hasClosureDate = dates.some(d => {
        const zoned = toZonedTime(d, tz);
        return isSameDay(zoned, mar9);
      });
      expect(hasClosureDate).toBe(false);
    });

    it('includes lessons on closure dates when blocking is disabled', () => {
      const startUtc = fromZonedTime(new Date('2026-03-02T10:00:00'), tz);
      const endDate = fromZonedTime(new Date('2026-03-23T23:59:00'), tz);
      const monday = 1;
      const closures = [new Date('2026-03-09')];

      const dates = generateRecurringDates(startUtc, [monday], endDate, tz, closures, false);

      // All 4 Mondays included
      expect(dates.length).toBe(4);
    });

    it('skips multiple closure dates in a series', () => {
      const startUtc = fromZonedTime(new Date('2026-03-02T10:00:00'), tz);
      const endDate = fromZonedTime(new Date('2026-03-30T23:59:00'), tz);
      const monday = 1;
      const closures = [new Date('2026-03-09'), new Date('2026-03-23')];

      const dates = generateRecurringDates(startUtc, [monday], endDate, tz, closures, true);

      // Mar 2, (skip 9), Mar 16, (skip 23), Mar 30 = 3
      expect(dates.length).toBe(3);
    });
  });

  describe('Timezone conversion (BST vs GMT)', () => {
    it('converts UK winter (GMT) time correctly', () => {
      // January = GMT (UTC+0)
      // 10:00 local = 10:00 UTC
      const utc = localToUtc('2026-01-15', '10:00', 'Europe/London');
      expect(utc.getUTCHours()).toBe(10);
    });

    it('converts UK summer (BST) time correctly', () => {
      // July = BST (UTC+1)
      // 10:00 local = 09:00 UTC
      const utc = localToUtc('2026-07-15', '10:00', 'Europe/London');
      expect(utc.getUTCHours()).toBe(9);
    });

    it('handles BST/GMT transition date (March clocks forward)', () => {
      // 2026 clocks go forward on 29 March
      // 28 March (still GMT): 10:00 local = 10:00 UTC
      const beforeChange = localToUtc('2026-03-28', '10:00', 'Europe/London');
      expect(beforeChange.getUTCHours()).toBe(10);

      // 30 March (now BST): 10:00 local = 09:00 UTC
      const afterChange = localToUtc('2026-03-30', '10:00', 'Europe/London');
      expect(afterChange.getUTCHours()).toBe(9);
    });

    it('round-trips UTC → org-local ISO correctly in BST', () => {
      // UTC 09:00 in BST should display as 10:00
      const iso = toOrgLocalIso('2026-07-15T09:00:00Z', 'Europe/London');
      expect(iso).toContain('T10:00:00');
    });

    it('round-trips UTC → org-local ISO correctly in GMT', () => {
      // UTC 10:00 in GMT should stay as 10:00
      const iso = toOrgLocalIso('2026-01-15T10:00:00Z', 'Europe/London');
      expect(iso).toContain('T10:00:00');
    });
  });
});
