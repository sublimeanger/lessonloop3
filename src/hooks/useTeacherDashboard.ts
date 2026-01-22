import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export interface TeacherDashboardStats {
  todayLessons: number;
  myStudentsCount: number;
  hoursThisWeek: number;
  lessonsThisMonth: number;
  upcomingLessons: Array<{
    id: string;
    title: string;
    start_at: string;
    end_at: string;
    location_name?: string;
  }>;
}

export function useTeacherDashboardStats() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['teacher-dashboard-stats', user?.id, currentOrg?.id],
    queryFn: async (): Promise<TeacherDashboardStats> => {
      if (!user || !currentOrg) {
        return {
          todayLessons: 0,
          myStudentsCount: 0,
          hoursThisWeek: 0,
          lessonsThisMonth: 0,
          upcomingLessons: [],
        };
      }

      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

      // Today's lessons for this teacher
      const { data: todayLessonsData } = await supabase
        .from('lessons')
        .select('id')
        .match({ org_id: currentOrg.id, teacher_user_id: user.id, status: 'scheduled' })
        .gte('start_at', `${todayStr}T00:00:00`)
        .lte('start_at', `${todayStr}T23:59:59`);

      // Get students assigned to this teacher
      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('student_id')
        .match({ org_id: currentOrg.id, teacher_user_id: user.id, is_active: true });

      // Get this week's lessons for hours calculation
      const { data: weekLessons } = await supabase
        .from('lessons')
        .select('start_at, end_at')
        .match({ org_id: currentOrg.id, teacher_user_id: user.id })
        .gte('start_at', `${weekStart}T00:00:00`)
        .lte('start_at', `${weekEnd}T23:59:59`);

      // This month's completed lessons
      const { data: monthLessons } = await supabase
        .from('lessons')
        .select('id')
        .match({ org_id: currentOrg.id, teacher_user_id: user.id, status: 'completed' })
        .gte('start_at', `${monthStart}T00:00:00`)
        .lte('start_at', `${monthEnd}T23:59:59`);

      // Upcoming lessons (next 5)
      const { data: upcomingData } = await supabase
        .from('lessons')
        .select('id, title, start_at, end_at, location_id')
        .match({ org_id: currentOrg.id, teacher_user_id: user.id, status: 'scheduled' })
        .gte('start_at', `${todayStr}T00:00:00`)
        .order('start_at', { ascending: true })
        .limit(5);

      // Get locations for upcoming lessons
      const locationIds = (upcomingData || [])
        .map(l => l.location_id)
        .filter((id): id is string => !!id);
      
      let locationMap = new Map<string, string>();
      if (locationIds.length > 0) {
        const { data: locationsData } = await supabase
          .from('locations')
          .select('id, name')
          .in('id', locationIds);
        
        locationMap = new Map((locationsData || []).map(l => [l.id, l.name]));
      }

      // Calculate hours this week
      let hoursThisWeek = 0;
      for (const lesson of weekLessons || []) {
        const start = new Date(lesson.start_at);
        const end = new Date(lesson.end_at);
        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        hoursThisWeek += durationHours;
      }

      // Format upcoming lessons
      const upcomingLessons = (upcomingData || []).map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        start_at: lesson.start_at,
        end_at: lesson.end_at,
        location_name: lesson.location_id ? locationMap.get(lesson.location_id) : undefined,
      }));

      return {
        todayLessons: todayLessonsData?.length || 0,
        myStudentsCount: assignments?.length || 0,
        hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
        lessonsThisMonth: monthLessons?.length || 0,
        upcomingLessons,
      };
    },
    enabled: !!user && !!currentOrg,
  });
}
