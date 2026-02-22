import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { format, startOfDay, endOfDay } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

export type AttendanceStatus = Database['public']['Enums']['attendance_status'];

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
  teacher_user_id: string;
  participants: Array<{
    student_id: string;
    student_name: string;
    attendance_status: AttendanceStatus | null;
    attendance_notes: string | null;
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
            student_id,
            attendance_status,
            cancellation_reason
          )
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
      const locationIds = [...new Set((lessonsData || []).map((l: any) => l.location_id).filter(Boolean))];
      const roomIds = [...new Set((lessonsData || []).map((l: any) => l.room_id).filter(Boolean))];

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
      return (lessonsData || []).map((lesson: any) => {
        const attendanceMap = new Map(
          (lesson.attendance_records || []).map((ar: any) => [ar.student_id, ar])
        );

        const participants = (lesson.lesson_participants || []).map((lp: any) => {
          const attendance = attendanceMap.get(lp.student_id) as any;
          return {
            student_id: lp.student_id,
            student_name: lp.students 
              ? `${lp.students.first_name} ${lp.students.last_name}`
              : 'Unknown Student',
            attendance_status: attendance?.attendance_status || null,
            attendance_notes: attendance?.cancellation_reason || null,
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
    }: {
      lessonId: string;
      studentId: string;
      status: AttendanceStatus;
      notes?: string;
    }) => {
      if (!currentOrg || !user) throw new Error('No organisation or user');

      // Upsert attendance record
      const { error } = await supabase
        .from('attendance_records')
        .upsert(
          {
            lesson_id: lessonId,
            student_id: studentId,
            org_id: currentOrg.id,
            attendance_status: status,
            recorded_by: user.id,
          },
          {
            onConflict: 'lesson_id,student_id',
          }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['register-lessons'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error saving attendance',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useMarkLessonComplete() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
          .insert(
            missing.map(p => ({
              lesson_id: lessonId,
              student_id: p.student_id,
              org_id: currentOrg.id,
              attendance_status: 'present' as const,
              recorded_by: user.id,
            }))
          );

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['register-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({
        title: 'Lesson marked complete',
      });
    },
    onError: (error: any) => {
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
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['batch-attendance-lessons', currentOrg?.id, format(date, 'yyyy-MM-dd')],
    queryFn: async (): Promise<BatchLessonRow[]> => {
      if (!currentOrg) return [];

      const orgTimezone = currentOrg.timezone || 'Europe/London';
      const dayStart = fromZonedTime(startOfDay(date), orgTimezone).toISOString();
      const dayEnd = fromZonedTime(endOfDay(date), orgTimezone).toISOString();

      const { data: lessonsData, error } = await supabase
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

      if (error) throw error;

      return (lessonsData || []).map((l: any) => ({
        id: l.id,
        title: l.title,
        start_at: l.start_at,
        end_at: l.end_at,
        status: l.status,
        participants: (l.lesson_participants || []).map((p: any) => {
          const existing = (l.attendance_records || []).find((a: any) => a.student_id === p.student_id);
          return {
            student_id: p.student_id,
            student_name: p.student ? `${p.student.first_name} ${p.student.last_name}` : 'Unknown',
            current_status: existing?.attendance_status || null,
          };
        }),
      }));
    },
    enabled: !!currentOrg?.id,
  });
}

export function useSaveBatchAttendance(dateKey: string) {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (attendance: Map<string, Map<string, string>>) => {
      if (!currentOrg || !user) throw new Error('No organisation or user');

      const upserts: {
        lesson_id: string;
        student_id: string;
        attendance_status: string;
        org_id: string;
        recorded_by: string;
      }[] = [];

      attendance.forEach((studentMap, lessonId) => {
        studentMap.forEach((status, studentId) => {
          upserts.push({
            lesson_id: lessonId,
            student_id: studentId,
            attendance_status: status as any,
            org_id: currentOrg.id,
            recorded_by: user.id,
          });
        });
      });

      if (upserts.length === 0) {
        return { count: 0 };
      }

      const { error } = await supabase
        .from('attendance_records')
        .upsert(upserts as any, { onConflict: 'lesson_id,student_id' });

      if (error) throw error;
      return { count: upserts.length };
    },
    onSuccess: (data) => {
      if (data.count === 0) {
        toast({ title: 'Nothing to save', description: 'No attendance records marked.' });
      } else {
        toast({ title: 'Attendance saved', description: `${data.count} records updated successfully.` });
      }
      queryClient.invalidateQueries({ queryKey: ['batch-attendance-lessons', currentOrg?.id, dateKey] });
      queryClient.invalidateQueries({ queryKey: ['register-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to save', description: error.message || 'Please try again.', variant: 'destructive' });
    },
  });
}
