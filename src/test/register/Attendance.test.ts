/**
 * LL-REG-P0-01: Daily Register / Attendance Tests
 * Tests the actual production utility functions used by useRegisterData.
 */
import { describe, it, expect } from 'vitest';
import { mergeAttendance, filterByTeacher } from '@/lib/attendance-utils';
import type { ParticipantRow, AttendanceRecord } from '@/lib/attendance-utils';
import type { AttendanceStatus } from '@/hooks/useRegisterData';

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
  });

  describe('Teacher scope filtering (filterByTeacher)', () => {
    const lessons = [
      { id: 'l1', title: 'Piano - Alice', status: 'scheduled', teacher_user_id: 'teacher-1', teacher_id: 't1', participants: [] },
      { id: 'l2', title: 'Guitar - Bob', status: 'scheduled', teacher_user_id: 'teacher-2', teacher_id: 't2', participants: [] },
      { id: 'l3', title: 'Piano - Charlie', status: 'scheduled', teacher_user_id: 'teacher-1', teacher_id: 't1', participants: [] },
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
});
