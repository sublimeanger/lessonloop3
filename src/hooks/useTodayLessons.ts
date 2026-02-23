import { useQuery } from '@tanstack/react-query';
import { STALE_VOLATILE } from '@/config/query-stale-times';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { parseISO, isAfter, isBefore, differenceInMinutes, startOfDay, endOfDay } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export interface TodayLesson {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  duration: number; // in minutes
  status: 'upcoming' | 'in-progress' | 'completed' | 'cancelled';
  lessonType: string;
  students: Array<{
    id: string;
    name: string;
  }>;
  location?: {
    id: string;
    name: string;
  };
  room?: {
    id: string;
    name: string;
  };
  teacherName?: string;
}

export function useTodayLessons() {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['today-lessons', currentOrg?.id, user?.id, currentRole],
    queryFn: async (): Promise<TodayLesson[]> => {
      if (!currentOrg) return [];
      
      const tz = currentOrg.timezone || 'Europe/London';
      const now = new Date();
      // Determine "today" in the org's timezone, not the browser's
      const zonedNow = toZonedTime(now, tz);
      const todayStart = fromZonedTime(startOfDay(zonedNow), tz).toISOString();
      const todayEnd = fromZonedTime(endOfDay(zonedNow), tz).toISOString();
      
      let query = supabase
          .from('lessons')
          .select(`
            id,
            title,
            start_at,
            end_at,
            status,
            lesson_type,
            teacher_id,
            teacher:teachers!lessons_teacher_id_fkey (display_name),
            lesson_participants (
              student:students (
                id,
                first_name,
                last_name
              )
            ),
            location:locations (
              id,
              name
            ),
            room:rooms (
              id,
              name
            )
          `)
          .eq('org_id', currentOrg.id)
          .gte('start_at', todayStart)
          .lte('start_at', todayEnd)
          .order('start_at', { ascending: true });
        
        // If user is a teacher in an academy, only show their lessons
        if (currentRole === 'teacher' && user?.id) {
          const { data: teacherRecord } = await supabase
            .from('teachers')
            .select('id')
            .eq('org_id', currentOrg.id)
            .eq('user_id', user.id)
            .maybeSingle();
          if (teacherRecord) {
            query = query.eq('teacher_id', teacherRecord.id);
          }
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        const currentTime = new Date();
        
        return (data || []).map((lesson) => {
          const startAt = parseISO(lesson.start_at);
          const endAt = parseISO(lesson.end_at);
          
          let computedStatus: TodayLesson['status'];
          if (lesson.status === 'cancelled') {
            computedStatus = 'cancelled';
          } else if (lesson.status === 'completed') {
            computedStatus = 'completed';
          } else if (isAfter(currentTime, endAt)) {
            computedStatus = 'completed';
          } else if (isAfter(currentTime, startAt) && isBefore(currentTime, endAt)) {
            computedStatus = 'in-progress';
          } else {
            computedStatus = 'upcoming';
          }
          
          const students = (lesson.lesson_participants || [])
            .filter((lp: { student: { id: string; first_name: string; last_name: string } | null }) => lp.student)
            .map((lp: { student: { id: string; first_name: string; last_name: string } }) => ({
              id: lp.student.id,
              name: `${lp.student.first_name} ${lp.student.last_name}`.trim(),
            }));
          
          return {
            id: lesson.id,
            title: lesson.title,
            startAt,
            endAt,
            duration: differenceInMinutes(endAt, startAt),
            status: computedStatus,
            lessonType: lesson.lesson_type || 'lesson',
            students,
            location: lesson.location ? { id: lesson.location.id, name: lesson.location.name } : undefined,
            room: lesson.room ? { id: lesson.room.id, name: lesson.room.name } : undefined,
            teacherName: (lesson as unknown as { teacher?: { display_name: string } | null }).teacher?.display_name || undefined,
          };
        });
    },
    enabled: !!currentOrg,
    retry: 1,
    staleTime: STALE_VOLATILE,
    refetchInterval: 60000,
  });
}
