import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

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
  teacher_user_id: string; // Added for client-side filtering
  participants: Array<{
    student_id: string;
    student_name: string;
    attendance_status: 'present' | 'absent' | 'late' | null;
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

      const dayStart = startOfDay(date).toISOString();
      const dayEnd = endOfDay(date).toISOString();

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
            notes
          )
        `)
        .eq('org_id', currentOrg.id)
        .gte('start_at', dayStart)
        .lte('start_at', dayEnd)
        .order('start_at', { ascending: true });

      // Filter by teacher for teacher role
      if (isTeacher && user) {
        query = query.eq('teacher_user_id', user.id);
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
            attendance_notes: attendance?.notes || null,
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
      status: 'present' | 'absent' | 'late';
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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (lessonId: string) => {
      const { error } = await supabase
        .from('lessons')
        .update({ status: 'completed' })
        .eq('id', lessonId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['register-lessons'] });
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
