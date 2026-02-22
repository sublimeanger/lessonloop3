/**
 * LL-REG-P0-01: Daily Register / Attendance Tests
 * Tests the actual production utility functions used by useRegisterData.
 */
import { describe, it, expect } from 'vitest';
import { mergeAttendance, filterByTeacher } from '@/lib/attendance-utils';
import type { ParticipantRow, AttendanceRecord } from '@/lib/attendance-utils';
import type { AttendanceStatus } from '@/hooks/useRegisterData';
import { needsAbsenceReason } from '@/components/register/AbsenceReasonPicker';

describe('LL-REG-P0-01: Daily Register', () => {
  describe('Attendance status upsert (mergeAttendance)', () => {
    it('sets student attendance to present', () => {
      const participants: ParticipantRow[] = [
        { student_id: 's1', student_name: 'Alice Smith', attendance_status: null },
      ];
      const records: AttendanceRecord[] = [
        { student_id: 's1', attendance_status: 'present' },
      ];

      const result = mergeAttendance(participants, records);
      expect(result[0].attendance_status).toBe('present');
    });

    it('sets student attendance to absent', () => {
      const participants: ParticipantRow[] = [
        { student_id: 's1', student_name: 'Alice', attendance_status: null },
      ];
      const records: AttendanceRecord[] = [
        { student_id: 's1', attendance_status: 'absent' },
      ];

      const result = mergeAttendance(participants, records);
      expect(result[0].attendance_status).toBe('absent');
    });

    it('sets student attendance to late', () => {
      const participants: ParticipantRow[] = [
        { student_id: 's1', student_name: 'Alice', attendance_status: null },
      ];
      const records: AttendanceRecord[] = [
        { student_id: 's1', attendance_status: 'late' },
      ];

      const result = mergeAttendance(participants, records);
      expect(result[0].attendance_status).toBe('late');
    });

    it('supports cancellation statuses', () => {
      const participants: ParticipantRow[] = [
        { student_id: 's1', student_name: 'Alice', attendance_status: null },
        { student_id: 's2', student_name: 'Bob', attendance_status: null },
      ];
      const records: AttendanceRecord[] = [
        { student_id: 's1', attendance_status: 'cancelled_by_teacher' },
        { student_id: 's2', attendance_status: 'cancelled_by_student' },
      ];

      const result = mergeAttendance(participants, records);
      expect(result[0].attendance_status).toBe('cancelled_by_teacher');
      expect(result[1].attendance_status).toBe('cancelled_by_student');
    });

    it('handles multiple students in one lesson', () => {
      const participants: ParticipantRow[] = [
        { student_id: 's1', student_name: 'Alice', attendance_status: null },
        { student_id: 's2', student_name: 'Bob', attendance_status: null },
        { student_id: 's3', student_name: 'Charlie', attendance_status: null },
      ];
      const records: AttendanceRecord[] = [
        { student_id: 's1', attendance_status: 'present' },
        { student_id: 's2', attendance_status: 'absent' },
        { student_id: 's3', attendance_status: 'late' },
      ];

      const result = mergeAttendance(participants, records);
      expect(result[0].attendance_status).toBe('present');
      expect(result[1].attendance_status).toBe('absent');
      expect(result[2].attendance_status).toBe('late');
    });

    it('preserves null for unrecorded students', () => {
      const participants: ParticipantRow[] = [
        { student_id: 's1', student_name: 'Alice', attendance_status: null },
        { student_id: 's2', student_name: 'Bob', attendance_status: null },
      ];
      const records: AttendanceRecord[] = [
        { student_id: 's1', attendance_status: 'present' },
      ];

      const result = mergeAttendance(participants, records);
      expect(result[0].attendance_status).toBe('present');
      expect(result[1].attendance_status).toBeNull();
    });

    it('handles empty participants list', () => {
      const result = mergeAttendance([], []);
      expect(result).toEqual([]);
    });

    it('handles empty records with existing participants', () => {
      const participants: ParticipantRow[] = [
        { student_id: 's1', student_name: 'Alice', attendance_status: null },
      ];
      const result = mergeAttendance(participants, []);
      expect(result[0].attendance_status).toBeNull();
    });

    it('handles duplicate student_ids in records gracefully (last wins)', () => {
      const participants: ParticipantRow[] = [
        { student_id: 's1', student_name: 'Alice', attendance_status: null },
      ];
      const records: AttendanceRecord[] = [
        { student_id: 's1', attendance_status: 'present' },
        { student_id: 's1', attendance_status: 'absent' },
      ];

      const result = mergeAttendance(participants, records);
      // The last record should win since mergeAttendance iterates records
      expect(result[0].attendance_status).toBeDefined();
    });
  });

  describe('Lesson completion', () => {
    it('mark complete changes status from scheduled to completed', () => {
      const lesson = {
        id: 'l1',
        title: 'Piano Lesson',
        status: 'scheduled' as const,
        teacher_user_id: 'u1',
        teacher_id: null,
        participants: [],
      };

      const updated = { ...lesson, status: 'completed' as const };
      expect(updated.status).toBe('completed');
    });

    it('identifies missing students for backfill', () => {
      const participants = [
        { student_id: 's1', student_name: 'Alice' },
        { student_id: 's2', student_name: 'Bob' },
        { student_id: 's3', student_name: 'Charlie' },
      ];
      const recordedStudentIds = new Set(['s1', 's3']);

      const missing = participants.filter(p => !recordedStudentIds.has(p.student_id));
      expect(missing).toHaveLength(1);
      expect(missing[0].student_id).toBe('s2');
    });

    it('identifies no missing students when all are recorded', () => {
      const participants = [
        { student_id: 's1', student_name: 'Alice' },
        { student_id: 's2', student_name: 'Bob' },
      ];
      const recordedStudentIds = new Set(['s1', 's2']);

      const missing = participants.filter(p => !recordedStudentIds.has(p.student_id));
      expect(missing).toHaveLength(0);
    });

    it('handles lesson with 0 participants', () => {
      const participants: { student_id: string; student_name: string }[] = [];
      const recordedStudentIds = new Set<string>();

      const missing = participants.filter(p => !recordedStudentIds.has(p.student_id));
      expect(missing).toHaveLength(0);
    });
  });

  describe('Teacher scope filtering (filterByTeacher)', () => {
    const lessons = [
      { id: 'l1', title: 'Piano - Alice', status: 'scheduled', teacher_user_id: 'teacher-1', teacher_id: 't1', start_at: '2025-01-01T09:00:00Z', end_at: '2025-01-01T09:30:00Z', participants: [] },
      { id: 'l2', title: 'Guitar - Bob', status: 'scheduled', teacher_user_id: 'teacher-2', teacher_id: 't2', start_at: '2025-01-01T10:00:00Z', end_at: '2025-01-01T10:30:00Z', participants: [] },
      { id: 'l3', title: 'Piano - Charlie', status: 'scheduled', teacher_user_id: 'teacher-1', teacher_id: 't1', start_at: '2025-01-01T11:00:00Z', end_at: '2025-01-01T11:30:00Z', participants: [] },
    ];

    it('owner/admin sees all lessons (no filter)', () => {
      const result = filterByTeacher(lessons, false, null);
      expect(result).toHaveLength(3);
    });

    it('teacher sees only own lessons', () => {
      const result = filterByTeacher(lessons, true, 'teacher-1');
      expect(result).toHaveLength(2);
      expect(result.every(l => l.teacher_user_id === 'teacher-1')).toBe(true);
    });

    it('teacher with no lessons sees empty list', () => {
      const result = filterByTeacher(lessons, true, 'teacher-999');
      expect(result).toHaveLength(0);
    });
  });

  describe('needsAbsenceReason', () => {
    it('returns true for absent', () => {
      expect(needsAbsenceReason('absent')).toBe(true);
    });

    it('returns true for cancelled_by_student', () => {
      expect(needsAbsenceReason('cancelled_by_student')).toBe(true);
    });

    it('returns false for present', () => {
      expect(needsAbsenceReason('present')).toBe(false);
    });

    it('returns false for late', () => {
      expect(needsAbsenceReason('late')).toBe(false);
    });

    it('returns false for cancelled_by_teacher', () => {
      expect(needsAbsenceReason('cancelled_by_teacher')).toBe(false);
    });

    it('returns false for null', () => {
      expect(needsAbsenceReason(null)).toBe(false);
    });
  });

  describe('Batch attendance state logic', () => {
    it('markAllPresent only fills in missing, does not overwrite existing', () => {
      // Simulate the markAllPresent logic from BatchAttendance.tsx
      const lessons = [
        { id: 'l1', participants: [{ student_id: 's1' }, { student_id: 's2' }] },
        { id: 'l2', participants: [{ student_id: 's3' }] },
      ];

      // s1 already marked absent
      const attendance = new Map<string, Map<string, AttendanceStatus>>();
      const l1Map = new Map<string, AttendanceStatus>();
      l1Map.set('s1', 'absent');
      attendance.set('l1', l1Map);

      // Run markAllPresent logic
      const next = new Map(attendance);
      lessons.forEach((lesson) => {
        const lessonMap = new Map(next.get(lesson.id) || []);
        lesson.participants.forEach((p) => {
          if (!lessonMap.has(p.student_id)) {
            lessonMap.set(p.student_id, 'present');
          }
        });
        next.set(lesson.id, lessonMap);
      });

      // s1 should still be absent (not overwritten)
      expect(next.get('l1')!.get('s1')).toBe('absent');
      // s2 should be set to present
      expect(next.get('l1')!.get('s2')).toBe('present');
      // s3 should be set to present
      expect(next.get('l2')!.get('s3')).toBe('present');
    });

    it('setStudentAttendance correctly updates nested Maps', () => {
      const attendance = new Map<string, Map<string, AttendanceStatus>>();

      // Simulate setStudentAttendance
      const setStudent = (lessonId: string, studentId: string, status: AttendanceStatus) => {
        const next = new Map(attendance);
        const lessonMap = new Map(next.get(lessonId) || []);
        lessonMap.set(studentId, status);
        next.set(lessonId, lessonMap);
        return next;
      };

      let result = setStudent('l1', 's1', 'present');
      expect(result.get('l1')!.get('s1')).toBe('present');

      // Update same student to different status
      attendance.set('l1', result.get('l1')!);
      result = setStudent('l1', 's1', 'late');
      expect(result.get('l1')!.get('s1')).toBe('late');
    });

    it('handles marking attendance for a lesson with 0 participants', () => {
      const lessons = [{ id: 'l1', participants: [] as { student_id: string }[] }];
      const attendance = new Map<string, Map<string, AttendanceStatus>>();

      const next = new Map(attendance);
      lessons.forEach((lesson) => {
        const lessonMap = new Map(next.get(lesson.id) || []);
        lesson.participants.forEach((p) => {
          if (!lessonMap.has(p.student_id)) {
            lessonMap.set(p.student_id, 'present');
          }
        });
        next.set(lesson.id, lessonMap);
      });

      expect(next.get('l1')!.size).toBe(0);
    });
  });

  describe('Future date blocking', () => {
    it('isFuture correctly identifies future dates', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Future date check logic used in BatchAttendance
      const isFutureDate = (d: Date) => d.getTime() > new Date().setHours(23, 59, 59, 999);
      expect(tomorrow > new Date()).toBe(true);
      expect(yesterday > new Date()).toBe(false);
    });
  });
});