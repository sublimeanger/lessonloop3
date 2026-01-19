import { Database } from '@/integrations/supabase/types';

export type LessonType = Database['public']['Enums']['lesson_type'];
export type LessonStatus = Database['public']['Enums']['lesson_status'];
export type AttendanceStatus = Database['public']['Enums']['attendance_status'];

export interface Lesson {
  id: string;
  org_id: string;
  start_at: string;
  end_at: string;
  lesson_type: LessonType;
  status: LessonStatus;
  teacher_user_id: string;
  location_id: string | null;
  room_id: string | null;
  online_meeting_url: string | null;
  recurrence_id: string | null;
  title: string;
  notes_private: string | null;
  notes_shared: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface LessonWithDetails extends Lesson {
  teacher?: {
    full_name: string | null;
    email: string | null;
  };
  location?: {
    name: string;
  };
  room?: {
    name: string;
  };
  participants?: {
    id: string;
    student: {
      id: string;
      first_name: string;
      last_name: string;
    };
  }[];
  attendance?: {
    student_id: string;
    attendance_status: AttendanceStatus;
  }[];
}

export interface LessonFormData {
  lesson_type: LessonType;
  teacher_user_id: string;
  student_ids: string[];
  location_id: string | null;
  room_id: string | null;
  date: Date;
  start_time: string;
  duration_mins: number;
  notes_private: string;
  status: LessonStatus;
  is_recurring: boolean;
  recurrence_days: number[];
  recurrence_end_date: Date | null;
}

export interface ConflictResult {
  type: 'teacher' | 'room' | 'student' | 'time_off';
  severity: 'error' | 'warning';
  message: string;
  entity_name?: string;
}

export type CalendarView = 'day' | 'week' | 'agenda';

export interface CalendarFilters {
  teacher_user_id: string | null;
  location_id: string | null;
  room_id: string | null;
}

export interface TimeSlot {
  date: Date;
  hour: number;
  minute: number;
}
