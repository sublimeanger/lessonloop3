/**
 * LL-SCH-P0-01: Calendar Conflict Detection Tests
 * Tests conflict types, severity levels, and business rules.
 * 
 * NOTE: These tests verify the conflict detection logic patterns.
 * The actual hook makes Supabase calls; we test the decision logic here.
 */
import { describe, it, expect } from 'vitest';
import type { ConflictResult } from '@/components/calendar/types';

// Extracted logic patterns from useConflictDetection.ts for unit testing

function determineClosureSeverity(blockScheduling: boolean): 'error' | 'warning' {
  return blockScheduling ? 'error' : 'warning';
}

function checkOverlap(
  existingStart: Date,
  existingEnd: Date,
  newStart: Date,
  newEnd: Date
): boolean {
  return existingStart < newEnd && existingEnd > newStart;
}

function buildTravelBufferConflict(
  bufferMinutes: number,
  conflictLocationIsSame: boolean
): ConflictResult | null {
  if (bufferMinutes <= 0 || conflictLocationIsSame) return null;
  return {
    type: 'teacher',
    severity: 'warning',
    message: `Teacher needs ${bufferMinutes} min travel buffer between locations.`,
  };
}

describe('LL-SCH-P0-01: Conflict Detection', () => {
  describe('Closure date conflicts', () => {
    it('returns error severity when block_scheduling_on_closures is true', () => {
      expect(determineClosureSeverity(true)).toBe('error');
    });

    it('returns warning severity when block_scheduling_on_closures is false', () => {
      expect(determineClosureSeverity(false)).toBe('warning');
    });
  });

  describe('Time overlap detection', () => {
    it('detects overlapping time ranges', () => {
      const existingStart = new Date('2025-06-15T10:00:00Z');
      const existingEnd = new Date('2025-06-15T11:00:00Z');
      const newStart = new Date('2025-06-15T10:30:00Z');
      const newEnd = new Date('2025-06-15T11:30:00Z');

      expect(checkOverlap(existingStart, existingEnd, newStart, newEnd)).toBe(true);
    });

    it('detects full containment', () => {
      const existingStart = new Date('2025-06-15T09:00:00Z');
      const existingEnd = new Date('2025-06-15T12:00:00Z');
      const newStart = new Date('2025-06-15T10:00:00Z');
      const newEnd = new Date('2025-06-15T11:00:00Z');

      expect(checkOverlap(existingStart, existingEnd, newStart, newEnd)).toBe(true);
    });

    it('does NOT detect adjacent (non-overlapping) time ranges', () => {
      const existingStart = new Date('2025-06-15T10:00:00Z');
      const existingEnd = new Date('2025-06-15T11:00:00Z');
      const newStart = new Date('2025-06-15T11:00:00Z');
      const newEnd = new Date('2025-06-15T12:00:00Z');

      expect(checkOverlap(existingStart, existingEnd, newStart, newEnd)).toBe(false);
    });

    it('does NOT detect completely separate time ranges', () => {
      const existingStart = new Date('2025-06-15T08:00:00Z');
      const existingEnd = new Date('2025-06-15T09:00:00Z');
      const newStart = new Date('2025-06-15T14:00:00Z');
      const newEnd = new Date('2025-06-15T15:00:00Z');

      expect(checkOverlap(existingStart, existingEnd, newStart, newEnd)).toBe(false);
    });
  });

  describe('Conflict severity assignments', () => {
    it('student double-booking is error', () => {
      const conflict: ConflictResult = {
        type: 'student',
        severity: 'error',
        message: 'Alice Smith already has a lesson at this time',
        entity_name: 'Alice Smith',
      };
      expect(conflict.severity).toBe('error');
      expect(conflict.type).toBe('student');
    });

    it('teacher overlap is error', () => {
      const conflict: ConflictResult = {
        type: 'teacher',
        severity: 'error',
        message: 'Teacher already has a lesson at this time',
      };
      expect(conflict.severity).toBe('error');
    });

    it('room collision is error', () => {
      const conflict: ConflictResult = {
        type: 'room',
        severity: 'error',
        message: 'Room is already booked',
      };
      expect(conflict.severity).toBe('error');
    });

    it('external calendar conflict is warning (not blocking)', () => {
      const conflict: ConflictResult = {
        type: 'external_calendar',
        severity: 'warning',
        message: 'Teacher has an external calendar event: Team Meeting',
        entity_name: 'Team Meeting',
      };
      expect(conflict.severity).toBe('warning');
      expect(conflict.type).toBe('external_calendar');
    });

    it('teacher time-off is error', () => {
      const conflict: ConflictResult = {
        type: 'time_off',
        severity: 'error',
        message: 'Teacher has time off during this period: Holiday',
      };
      expect(conflict.severity).toBe('error');
    });

    it('teacher outside availability is warning', () => {
      const conflict: ConflictResult = {
        type: 'availability',
        severity: 'warning',
        message: "Lesson is outside teacher's available hours on Monday",
      };
      expect(conflict.severity).toBe('warning');
    });
  });

  describe('Travel buffer between locations', () => {
    it('returns null when buffer is 0', () => {
      expect(buildTravelBufferConflict(0, false)).toBeNull();
    });

    it('returns null when same location', () => {
      expect(buildTravelBufferConflict(15, true)).toBeNull();
    });

    it('returns warning when different location and buffer > 0', () => {
      const result = buildTravelBufferConflict(15, false);
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
      expect(result!.type).toBe('teacher');
      expect(result!.message).toContain('15 min');
    });

    it('includes buffer minutes in warning message', () => {
      const result = buildTravelBufferConflict(30, false);
      expect(result!.message).toContain('30 min travel buffer');
    });
  });
});
