import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

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

      const tz = currentOrg.timezone || 'Europe/London';
      const today = new Date();
      const todayStartUtc = fromZonedTime(startOfDay(today), tz).toISOString();
      const todayEndUtc = fromZonedTime(endOfDay(today), tz).toISOString();
      const weekStartUtc = fromZonedTime(startOfWeek(today, { weekStartsOn: 1 }), tz).toISOString();
      const weekEndUtc = fromZonedTime(endOfDay(endOfWeek(today, { weekStartsOn: 1 })), tz).toISOString();
      const monthStartUtc = fromZonedTime(startOfMonth(today), tz).toISOString();
      const monthEndUtc = fromZonedTime(endOfDay(endOfMonth(today)), tz).toISOString();

      // Look up this user's teacher record to get teacher_id
      const { data: teacherRecord } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .eq('org_id', currentOrg.id)
        .maybeSingle();

      const myTeacherId = teacherRecord?.id;
      if (!myTeacherId) {
        return {
          todayLessons: 0,
          myStudentsCount: 0,
          hoursThisWeek: 0,
          lessonsThisMonth: 0,
          upcomingLessons: [],
        };
      }

      // Run all 5 independent queries in parallel
      const [
        { data: todayLessonsData },
        { data: assignments },
        { data: weekLessons },
        { data: monthLessons },
        { data: upcomingData },
      ] = await Promise.all([
        // Today's lessons for this teacher
        supabase
          .from('lessons')
          .select('id')
          .eq('org_id', currentOrg.id)
          .eq('teacher_id', myTeacherId)
          .eq('status', 'scheduled')
          .gte('start_at', todayStartUtc)
          .lte('start_at', todayEndUtc),
        // Get students assigned to this teacher
        supabase
          .from('student_teacher_assignments')
          .select('student_id')
          .eq('org_id', currentOrg.id)
          .eq('teacher_id', myTeacherId),
        // Get this week's lessons for hours calculation
        supabase
          .from('lessons')
          .select('start_at, end_at')
          .eq('org_id', currentOrg.id)
          .eq('teacher_id', myTeacherId)
          .gte('start_at', weekStartUtc)
          .lte('start_at', weekEndUtc),
        // This month's completed lessons
        supabase
          .from('lessons')
          .select('id')
          .eq('org_id', currentOrg.id)
          .eq('teacher_id', myTeacherId)
          .eq('status', 'completed')
          .gte('start_at', monthStartUtc)
          .lte('start_at', monthEndUtc),
        // Upcoming lessons (next 5)
        supabase
          .from('lessons')
          .select('id, title, start_at, end_at, location_id')
          .eq('org_id', currentOrg.id)
          .eq('teacher_id', myTeacherId)
          .eq('status', 'scheduled')
          .gte('start_at', todayStartUtc)
          .order('start_at', { ascending: true })
          .limit(5),
      ]);

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
