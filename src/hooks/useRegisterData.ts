import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE_VOLATILE } from '@/config/query-stale-times';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { format, startOfDay, endOfDay } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { useToast } from '@/hooks/use-toast';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import type { Database } from '@/integrations/supabase/types';

export type AttendanceStatus = Database['public']['Enums']['attendance_status'];
export type AbsenceReason = Database['public']['Enums']['absence_reason'];
type AttendanceRecordInsert = Database['public']['Tables']['attendance_records']['Insert'];

// Typed shapes for Supabase join query results
interface LessonAttendanceRecord {
  student_id: string;
  attendance_status: AttendanceStatus;
  cancellation_reason: string | null;
  absence_reason_category: AbsenceReason | null;
}

interface LessonParticipantJoin {
  student_id: string;
  students: { id: string; first_name: string; last_name: string } | null;
}

interface LessonQueryRow {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: string;
  notes_shared: string | null;
  notes_private: string | null;
  recurrence_id: string | null;
  location_id: string | null;
  room_id: string | null;
  teacher_id: string | null;
  teacher_user_id: string | null;
  lesson_participants: LessonParticipantJoin[];
  attendance_records: LessonAttendanceRecord[];
}

export interface RegisterLesson {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes_shared: string | null;
  notes_private: string | null;
  location_name: string | null;
  room_name: string | null;
  recurrence_id: string | null;
  teacher_id: string | null;
  teacher_user_id: string | null;
  participants: Array<{
    student_id: string;
    student_name: string;
    attendance_status: AttendanceStatus | null;
    attendance_notes: string | null;
    absence_reason_category?: string | null;
  }>;
}

export function useRegisterData(date: Date) {
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrg();
  const isTeacher = currentRole === 'teacher';

  return useQuery({
    queryKey: ['register-lessons', currentOrg?.id, format(date, 'yyyy-MM-dd'), user?.id, isTeacher],
    queryFn: async (): Promise<RegisterLesson[]> => {
      if (!currentOrg) return [];

      const orgTimezone = currentOrg.timezone || 'Europe/London';
      const dayStart = fromZonedTime(startOfDay(date), orgTimezone).toISOString();
      const dayEnd = fromZonedTime(endOfDay(date), orgTimezone).toISOString();

      // Build the query
      let query = supabase
        .from('lessons')
        .select(`
          id,
          title,
          start_at,
          end_at,
          status,
          notes_shared,
          notes_private,
          recurrence_id,
          location_id,
          room_id,
          teacher_id,
          teacher_user_id,
          lesson_participants (
            student_id,
            students (
              id,
              first_name,
              last_name
            )
          ),
          attendance_records (
72:             student_id,
73:             attendance_status,
74:             cancellation_reason,
75:             absence_reason_category
76:           )
        `)
        .eq('org_id', currentOrg.id)
        .gte('start_at', dayStart)
        .lte('start_at', dayEnd)
        .order('start_at', { ascending: true });

      // Filter by teacher_id for teacher role
      if (isTeacher && user) {
        // Look up teacher record by user_id, then filter by teacher_id
        const { data: teacherRecord } = await supabase
          .from('teachers')
          .select('id')
          .eq('user_id', user.id)
          .eq('org_id', currentOrg.id)
          .maybeSingle();
        
        if (teacherRecord) {
          query = query.eq('teacher_id', teacherRecord.id);
        } else {
          // Fallback for legacy data
          query = query.eq('teacher_user_id', user.id);
        }
      }

      const { data: lessonsData, error } = await query;

      if (error) throw error;

      // Fetch location and room names
      const typedLessons = (lessonsData || []) as unknown as LessonQueryRow[];
      const locationIds = [...new Set(typedLessons.map(l => l.location_id).filter(Boolean))] as string[];
      const roomIds = [...new Set(typedLessons.map(l => l.room_id).filter(Boolean))] as string[];

      let locationMap = new Map<string, string>();
      let roomMap = new Map<string, string>();

      if (locationIds.length > 0) {
        const { data: locations } = await supabase
          .from('locations')
          .select('id, name')
          .in('id', locationIds);
        locationMap = new Map((locations || []).map(l => [l.id, l.name]));
      }

      if (roomIds.length > 0) {
        const { data: rooms } = await supabase
          .from('rooms')
          .select('id, name')
          .in('id', roomIds);
        roomMap = new Map((rooms || []).map(r => [r.id, r.name]));
      }

      // Transform data
      return typedLessons.map((lesson) => {
        const attendanceMap = new Map(
          (lesson.attendance_records || []).map((ar) => [ar.student_id, ar])
        );

        const participants = (lesson.lesson_participants || []).map((lp) => {
          const attendance = attendanceMap.get(lp.student_id);
          return {
            student_id: lp.student_id,
            student_name: lp.students 
              ? `${lp.students.first_name} ${lp.students.last_name}`
              : 'Unknown Student',
            attendance_status: attendance?.attendance_status || null,
            attendance_notes: attendance?.cancellation_reason || null,
            absence_reason_category: attendance?.absence_reason_category || null,
          };
        });

        return {
          id: lesson.id,
          title: lesson.title,
          start_at: lesson.start_at,
          end_at: lesson.end_at,
          status: lesson.status as RegisterLesson['status'],
          notes_shared: lesson.notes_shared,
          notes_private: lesson.notes_private,
          recurrence_id: lesson.recurrence_id,
          teacher_id: lesson.teacher_id,
          teacher_user_id: lesson.teacher_user_id,
          location_name: lesson.location_id ? locationMap.get(lesson.location_id) || null : null,
          room_name: lesson.room_id ? roomMap.get(lesson.room_id) || null : null,
          participants,
        };
      });
    },
    enabled: !!currentOrg,
    staleTime: STALE_VOLATILE,
  });
}

export function useUpdateAttendance() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      lessonId,
      studentId,
      status,
      notes,
      absenceReason,
      absenceNotifiedAt,
    }: {
      lessonId: string;
      studentId: string;
      status: AttendanceStatus;
      notes?: string;
      absenceReason?: string;
      absenceNotifiedAt?: string;
    }) => {
      if (!currentOrg || !user) throw new Error('No organisation or user');

      // Authorisation guard: verify user is the lesson's teacher or an admin
      const { data: lesson } = await supabase
        .from('lessons')
        .select('teacher_user_id')
        .eq('id', lessonId)
        .single();

      if (!lesson) throw new Error('Lesson not found');

      const isAssignedTeacher = lesson.teacher_user_id === user.id;
      if (!isAssignedTeacher) {
        // Check if user is owner/admin
        const { data: membership } = await supabase
          .from('org_memberships')
          .select('role')
          .eq('user_id', user.id)
          .eq('org_id', currentOrg.id)
          .eq('status', 'active')
          .maybeSingle();

        const isAdmin = membership?.role === 'owner' || membership?.role === 'admin';
        if (!isAdmin) {
          throw new Error('You are not authorised to mark attendance for this lesson.');
        }
      }

      const { error } = await supabase
        .from('attendance_records')
        .upsert(
          {
            lesson_id: lessonId,
            student_id: studentId,
            org_id: currentOrg.id,
            attendance_status: status,
            recorded_by: user.id,
            absence_reason_category: (absenceReason as AbsenceReason) || null,
            absence_notified_at: absenceNotifiedAt || null,
          } satisfies AttendanceRecordInsert,
          {
            onConflict: 'lesson_id,student_id',
          }
        );

      if (error) throw error;
    },
    onMutate: async ({ lessonId, studentId, status, absenceReason }) => {
      await queryClient.cancelQueries({ queryKey: ['register-lessons'] });

      const previousQueries = queryClient.getQueriesData<RegisterLesson[]>({ queryKey: ['register-lessons'] });

      queryClient.setQueriesData<RegisterLesson[]>(
        { queryKey: ['register-lessons'] },
        (old) => {
          if (!old) return old;
          return old.map(lesson => {
            if (lesson.id !== lessonId) return lesson;
            return {
              ...lesson,
              participants: lesson.participants.map(p =>
                p.student_id === studentId
                  ? { ...p, attendance_status: status, absence_reason_category: absenceReason || null }
                  : p
              ),
            };
          });
        }
      );

      return { previousQueries };
    },
    onError: (error: Error, _vars, context) => {
      // Roll back to previous state
      if (context?.previousQueries) {
        context.previousQueries.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
      toast({
        title: 'Error saving attendance',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['register-lessons'] });
    },
  });
}

export function useMarkLessonComplete() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { syncLesson } = useCalendarSync();

  return useMutation({
    mutationFn: async (lessonId: string) => {
      if (!currentOrg || !user) throw new Error('No organisation or user');

      // Update lesson status
      const { error } = await supabase
        .from('lessons')
        .update({ status: 'completed' })
        .eq('id', lessonId);

      if (error) throw error;

      // Back-fill 'present' for any participant without an attendance record
      const { data: participants } = await supabase
        .from('lesson_participants')
        .select('student_id')
        .eq('lesson_id', lessonId);

      const { data: existing } = await supabase
        .from('attendance_records')
        .select('student_id')
        .eq('lesson_id', lessonId);

      const existingSet = new Set((existing || []).map(e => e.student_id));
      const missing = (participants || []).filter(p => !existingSet.has(p.student_id));

      if (missing.length > 0) {
        const { error: insertError } = await supabase
          .from('attendance_records')
          .upsert(
            missing.map(p => ({
              lesson_id: lessonId,
              student_id: p.student_id,
              org_id: currentOrg.id,
              attendance_status: 'present' as const,
              recorded_by: user.id,
            })),
            { onConflict: 'lesson_id,student_id' }
          );

        if (insertError) throw insertError;
      }
    },
    onSuccess: (_data, lessonId) => {
      queryClient.invalidateQueries({ queryKey: ['register-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      // Fire-and-forget calendar sync
      syncLesson(lessonId, 'update');
      toast({
        title: 'Lesson marked complete',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error marking lesson complete',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ── Batch Attendance hooks ──

export interface BatchLessonRow {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: string;
  participants: {
    student_id: string;
    student_name: string;
    current_status: AttendanceStatus | null;
  }[];
}

export function useBatchAttendanceLessons(date: Date) {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['batch-attendance-lessons', currentOrg?.id, format(date, 'yyyy-MM-dd'), user?.id, currentRole],
    queryFn: async (): Promise<BatchLessonRow[]> => {
      if (!currentOrg) return [];

      const orgTimezone = currentOrg.timezone || 'Europe/London';
      const dayStart = fromZonedTime(startOfDay(date), orgTimezone).toISOString();
      const dayEnd = fromZonedTime(endOfDay(date), orgTimezone).toISOString();

      let query = supabase
        .from('lessons')
        .select(`
          id, title, start_at, end_at, status,
          lesson_participants(student_id, student:students(id, first_name, last_name)),
          attendance_records(student_id, attendance_status)
        `)
        .eq('org_id', currentOrg.id)
        .gte('start_at', dayStart)
        .lte('start_at', dayEnd)
        .in('status', ['scheduled', 'completed'])
        .order('start_at', { ascending: true });

      // Teacher role: only show their own lessons
      if (currentRole === 'teacher' && user) {
        const { data: teacherRecord } = await supabase
          .from('teachers')
          .select('id')
          .eq('user_id', user.id)
          .eq('org_id', currentOrg.id)
          .maybeSingle();

        if (teacherRecord) {
          query = query.eq('teacher_id', teacherRecord.id);
        } else {
          query = query.eq('teacher_user_id', user.id);
        }
      }

      const { data: lessonsData, error } = await query;

      if (error) throw error;

      interface BatchQueryRow {
        id: string; title: string; start_at: string; end_at: string; status: string;
        lesson_participants: { student_id: string; student: { id: string; first_name: string; last_name: string } | null }[];
        attendance_records: { student_id: string; attendance_status: AttendanceStatus }[];
      }
      const typed = (lessonsData || []) as unknown as BatchQueryRow[];
      return typed.map((l) => ({
        id: l.id,
        title: l.title,
        start_at: l.start_at,
        end_at: l.end_at,
        status: l.status,
        participants: (l.lesson_participants || []).map((p) => {
          const existing = (l.attendance_records || []).find((a) => a.student_id === p.student_id);
          return {
            student_id: p.student_id,
            student_name: p.student ? `${p.student.first_name} ${p.student.last_name}` : 'Unknown',
            current_status: existing?.attendance_status || null,
          };
        }),
      }));
    },
    enabled: !!currentOrg?.id,
    staleTime: STALE_VOLATILE,
  });
}

export function useSaveBatchAttendance(dateKey: string) {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ attendance, lessons, absenceReasons, notifiedDates }: {
      attendance: Map<string, Map<string, string>>;
      lessons: BatchLessonRow[];
      absenceReasons?: Map<string, Map<string, string>>;
      notifiedDates?: Map<string, Map<string, string>>;
    }) => {
      if (!currentOrg || !user) throw new Error('No organisation or user');

      const upserts: AttendanceRecordInsert[] = [];

      attendance.forEach((studentMap, lessonId) => {
        studentMap.forEach((status, studentId) => {
          const reason = absenceReasons?.get(lessonId)?.get(studentId) || null;
          const notified = notifiedDates?.get(lessonId)?.get(studentId) || null;
          upserts.push({
            lesson_id: lessonId,
            student_id: studentId,
            attendance_status: status as AttendanceStatus,
            org_id: currentOrg.id,
            recorded_by: user.id,
            absence_reason_category: (reason as AbsenceReason) || null,
            absence_notified_at: notified,
          });
        });
      });

      if (upserts.length === 0) {
        return { count: 0 };
      }

      const { error } = await supabase
        .from('attendance_records')
        .upsert(upserts satisfies AttendanceRecordInsert[], { onConflict: 'lesson_id,student_id' });

      if (error) throw error;

      // Auto-complete lessons where all participants now have attendance
      const fullyAttendedIds = lessons
        .filter(l => l.status === 'scheduled')
        .filter(l => {
          const lessonMap = attendance.get(l.id);
          if (!lessonMap) return false;
          return l.participants.every(p => lessonMap.has(p.student_id));
        })
        .map(l => l.id);

      if (fullyAttendedIds.length > 0) {
        await supabase
          .from('lessons')
          .update({ status: 'completed' })
          .in('id', fullyAttendedIds)
          .eq('status', 'scheduled');
      }

      return { count: upserts.length };
    },
    onMutate: async ({ attendance }) => {
      await queryClient.cancelQueries({ queryKey: ['batch-attendance-lessons'] });

      const previousQueries = queryClient.getQueriesData<BatchLessonRow[]>({ queryKey: ['batch-attendance-lessons'] });

      queryClient.setQueriesData<BatchLessonRow[]>(
        { queryKey: ['batch-attendance-lessons'] },
        (old) => {
          if (!old) return old;
          return old.map(lesson => {
            const lessonMap = attendance.get(lesson.id);
            if (!lessonMap) return lesson;
            return {
              ...lesson,
              participants: lesson.participants.map(p => {
                const newStatus = lessonMap.get(p.student_id);
                return newStatus
                  ? { ...p, current_status: newStatus as AttendanceStatus }
                  : p;
              }),
            };
          });
        }
      );

      return { previousQueries };
    },
    onSuccess: (data) => {
      if (data.count === 0) {
        toast({ title: 'Nothing to save', description: 'No attendance records marked.' });
      } else {
        toast({ title: 'Attendance saved', description: `${data.count} records updated successfully.` });
      }
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
      toast({ title: 'Failed to save', description: error.message || 'Please try again.', variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-attendance-lessons', currentOrg?.id, dateKey] });
      queryClient.invalidateQueries({ queryKey: ['register-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}
