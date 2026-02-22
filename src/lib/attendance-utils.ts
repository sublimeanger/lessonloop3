import type { AttendanceStatus } from '@/hooks/useRegisterData';

export interface AttendanceRecord {
  student_id: string;
  attendance_status: AttendanceStatus;
}

export interface ParticipantRow {
  student_id: string;
  student_name: string;
  attendance_status: AttendanceStatus | null;
  attendance_notes?: string | null;
}

export interface RegisterLessonRow {
  id: string;
  teacher_user_id: string;
  teacher_id: string | null;
  [key: string]: any;
}

/**
 * Merge attendance records into participant list.
 * Used by useRegisterData to combine lesson_participants with attendance_records.
 */
export function mergeAttendance(
  participants: ParticipantRow[],
  records: AttendanceRecord[]
): ParticipantRow[] {
  const recordMap = new Map(records.map(r => [r.student_id, r.attendance_status]));
  return participants.map(p => ({
    ...p,
    attendance_status: recordMap.get(p.student_id) ?? p.attendance_status,
  }));
}

/**
 * Filter lessons by teacher.
 * Used by DailyRegister to scope the view for teacher-role users.
 */
export function filterByTeacher<T extends RegisterLessonRow>(
  lessons: T[],
  isTeacher: boolean,
  teacherUserId: string | null
): T[] {
  if (!isTeacher || !teacherUserId) return lessons;
  return lessons.filter(l => l.teacher_user_id === teacherUserId);
}
