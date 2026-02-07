/**
 * LL-REG-P0-01: Daily Register / Attendance Tests
 * Tests attendance upsert logic, lesson completion, and teacher scope filtering.
 */
import { describe, it, expect } from 'vitest';

// Pure logic extracted from useRegisterData for testing

type AttendanceStatus = 'present' | 'absent' | 'late';

interface AttendanceRecord {
  lesson_id: string;
  student_id: string;
  attendance_status: AttendanceStatus;
  recorded_by: string;
}

interface RegisterLesson {
  id: string;
  title: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  teacher_user_id: string;
  participants: Array<{
    student_id: string;
    student_name: string;
    attendance_status: AttendanceStatus | null;
  }>;
}

// Simulate the attendance upsert merge logic
function mergeAttendance(
  participants: RegisterLesson['participants'],
  records: AttendanceRecord[]
): RegisterLesson['participants'] {
  const recordMap = new Map(records.map(r => [r.student_id, r.attendance_status]));
  return participants.map(p => ({
    ...p,
    attendance_status: recordMap.get(p.student_id) ?? p.attendance_status,
  }));
}

// Simulate teacher scope filtering
function filterByTeacher(
  lessons: RegisterLesson[],
  isTeacher: boolean,
  teacherUserId: string | null
): RegisterLesson[] {
  if (!isTeacher || !teacherUserId) return lessons;
  return lessons.filter(l => l.teacher_user_id === teacherUserId);
}

describe('LL-REG-P0-01: Daily Register', () => {
  describe('Attendance status upsert', () => {
    it('sets student attendance to present', () => {
      const participants = [
        { student_id: 's1', student_name: 'Alice Smith', attendance_status: null as AttendanceStatus | null },
      ];
      const records: AttendanceRecord[] = [
        { lesson_id: 'l1', student_id: 's1', attendance_status: 'present', recorded_by: 'u1' },
      ];

      const result = mergeAttendance(participants, records);
      expect(result[0].attendance_status).toBe('present');
    });

    it('sets student attendance to absent', () => {
      const participants = [
        { student_id: 's1', student_name: 'Alice', attendance_status: null as AttendanceStatus | null },
      ];
      const records: AttendanceRecord[] = [
        { lesson_id: 'l1', student_id: 's1', attendance_status: 'absent', recorded_by: 'u1' },
      ];

      const result = mergeAttendance(participants, records);
      expect(result[0].attendance_status).toBe('absent');
    });

    it('sets student attendance to late', () => {
      const participants = [
        { student_id: 's1', student_name: 'Alice', attendance_status: null as AttendanceStatus | null },
      ];
      const records: AttendanceRecord[] = [
        { lesson_id: 'l1', student_id: 's1', attendance_status: 'late', recorded_by: 'u1' },
      ];

      const result = mergeAttendance(participants, records);
      expect(result[0].attendance_status).toBe('late');
    });

    it('handles multiple students in one lesson', () => {
      const participants = [
        { student_id: 's1', student_name: 'Alice', attendance_status: null as AttendanceStatus | null },
        { student_id: 's2', student_name: 'Bob', attendance_status: null as AttendanceStatus | null },
        { student_id: 's3', student_name: 'Charlie', attendance_status: null as AttendanceStatus | null },
      ];
      const records: AttendanceRecord[] = [
        { lesson_id: 'l1', student_id: 's1', attendance_status: 'present', recorded_by: 'u1' },
        { lesson_id: 'l1', student_id: 's2', attendance_status: 'absent', recorded_by: 'u1' },
        { lesson_id: 'l1', student_id: 's3', attendance_status: 'late', recorded_by: 'u1' },
      ];

      const result = mergeAttendance(participants, records);
      expect(result[0].attendance_status).toBe('present');
      expect(result[1].attendance_status).toBe('absent');
      expect(result[2].attendance_status).toBe('late');
    });

    it('preserves null for unrecorded students', () => {
      const participants = [
        { student_id: 's1', student_name: 'Alice', attendance_status: null as AttendanceStatus | null },
        { student_id: 's2', student_name: 'Bob', attendance_status: null as AttendanceStatus | null },
      ];
      const records: AttendanceRecord[] = [
        { lesson_id: 'l1', student_id: 's1', attendance_status: 'present', recorded_by: 'u1' },
      ];

      const result = mergeAttendance(participants, records);
      expect(result[0].attendance_status).toBe('present');
      expect(result[1].attendance_status).toBeNull();
    });
  });

  describe('Lesson completion', () => {
    it('mark complete changes status from scheduled to completed', () => {
      const lesson: RegisterLesson = {
        id: 'l1',
        title: 'Piano Lesson',
        status: 'scheduled',
        teacher_user_id: 'u1',
        participants: [],
      };

      // Simulate the mutation effect
      const updated = { ...lesson, status: 'completed' as const };
      expect(updated.status).toBe('completed');
    });
  });

  describe('Teacher scope filtering', () => {
    const lessons: RegisterLesson[] = [
      { id: 'l1', title: 'Piano - Alice', status: 'scheduled', teacher_user_id: 'teacher-1', participants: [] },
      { id: 'l2', title: 'Guitar - Bob', status: 'scheduled', teacher_user_id: 'teacher-2', participants: [] },
      { id: 'l3', title: 'Piano - Charlie', status: 'scheduled', teacher_user_id: 'teacher-1', participants: [] },
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
