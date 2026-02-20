import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, isAfter, isBefore, differenceInMinutes } from 'date-fns';

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
    queryKey: ['today-lessons', currentOrg?.id, user?.id],
    queryFn: async (): Promise<TodayLesson[]> => {
      if (!currentOrg) return [];
      
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      
      try {
        let query = supabase
          .from('lessons')
          .select(`
            id,
            title,
            start_at,
            end_at,
            status,
            lesson_type,
            teacher_user_id,
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
          .gte('start_at', `${todayStr}T00:00:00`)
          .lte('start_at', `${todayStr}T23:59:59`)
          .order('start_at', { ascending: true });
        
        // If user is a teacher in an academy, only show their lessons
        if (currentRole === 'teacher') {
          query = query.eq('teacher_user_id', user?.id);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        // Fetch teacher profiles separately
        const teacherIds = [...new Set((data || []).map(l => l.teacher_user_id).filter(Boolean))] as string[];
        let teacherMap = new Map<string, string>();
        
        if (teacherIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', teacherIds);
          
          teacherMap = new Map(profiles?.map(p => [p.id, p.full_name || '']) || []);
        }
        
        const now = new Date();
        
        return (data || []).map((lesson) => {
          const startAt = parseISO(lesson.start_at);
          const endAt = parseISO(lesson.end_at);
          
          // Calculate status based on time
          let computedStatus: TodayLesson['status'];
          if (lesson.status === 'cancelled') {
            computedStatus = 'cancelled';
          } else if (lesson.status === 'completed') {
            computedStatus = 'completed';
          } else if (isAfter(now, endAt)) {
            computedStatus = 'completed';
          } else if (isAfter(now, startAt) && isBefore(now, endAt)) {
            computedStatus = 'in-progress';
          } else {
            computedStatus = 'upcoming';
          }
          
          const students = (lesson.lesson_participants || [])
            .filter((lp: any) => lp.student)
            .map((lp: any) => ({
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
            teacherName: lesson.teacher_user_id ? teacherMap.get(lesson.teacher_user_id) : undefined,
          };
        });
      } catch (error) {
        logger.error('Error fetching today lessons:', error);
        return [];
      }
    },
    enabled: !!currentOrg,
    retry: 1,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
