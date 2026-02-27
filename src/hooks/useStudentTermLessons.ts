import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useRateCards, findRateForDuration } from '@/hooks/useRateCards';
import { useCurrentTerm } from '@/hooks/useTerms';

export interface StudentTermSeries {
  recurrence_id: string;
  day_of_week: string;
  start_time: string;
  lesson_title: string;
  teacher_name: string | null;
  teacher_user_id: string | null;
  location_name: string | null;
  location_id: string | null;
  total_lessons_in_term: number;
  completed_lessons: number;
  remaining_lessons: number;
  rate_minor: number;
  duration_mins: number;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function useStudentTermLessons(studentId?: string, termId?: string) {
  const { currentOrg } = useOrg();
  const currentTerm = useCurrentTerm();
  const { data: rateCards = [] } = useRateCards();

  const effectiveTermId = termId || currentTerm?.id;

  return useQuery({
    queryKey: ['student-term-lessons', studentId, effectiveTermId, currentOrg?.id],
    queryFn: async (): Promise<StudentTermSeries[]> => {
      if (!currentOrg?.id || !studentId) return [];

      // Get the term date range
      let startDate: string;
      let endDate: string;

      if (effectiveTermId) {
        const { data: term } = await supabase
          .from('terms')
          .select('start_date, end_date')
          .eq('id', effectiveTermId)
          .single();

        if (!term) return [];
        startDate = term.start_date;
        endDate = term.end_date;
      } else {
        // No term: use current date + 90 days
        const now = new Date();
        startDate = now.toISOString().split('T')[0];
        const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        endDate = future.toISOString().split('T')[0];
      }

      // Get all lesson participations for this student within the term range
      const { data: participations, error } = await supabase
        .from('lesson_participants')
        .select(`
          lesson:lessons!inner(
            id,
            start_at,
            end_at,
            status,
            title,
            recurrence_id,
            teacher_user_id,
            location_id,
            lesson_type
          )
        `)
        .eq('student_id', studentId)
        .eq('org_id', currentOrg.id)
        .gte('lesson.start_at', startDate + 'T00:00:00Z')
        .lte('lesson.start_at', endDate + 'T23:59:59Z')
        .not('lesson.recurrence_id', 'is', null);

      if (error) throw error;
      if (!participations || participations.length === 0) return [];

      // Group by recurrence_id
      const groups = new Map<string, {
        lessons: any[];
        recurrence_id: string;
      }>();

      for (const p of participations) {
        const lesson = p.lesson as any;
        if (!lesson?.recurrence_id) continue;

        const key = lesson.recurrence_id;
        if (!groups.has(key)) {
          groups.set(key, { lessons: [], recurrence_id: key });
        }
        groups.get(key)!.lessons.push(lesson);
      }

      // Build series info for each group
      const series: StudentTermSeries[] = [];

      for (const [recurrenceId, group] of groups) {
        const lessons = group.lessons.sort(
          (a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
        );

        const firstLesson = lessons[0];
        const startDate = new Date(firstLesson.start_at);
        const dayOfWeek = DAY_NAMES[startDate.getUTCDay()];
        const startTime = firstLesson.start_at.substring(11, 16);

        const durationMs = new Date(firstLesson.end_at).getTime() - new Date(firstLesson.start_at).getTime();
        const durationMins = Math.round(durationMs / 60000);

        const completed = lessons.filter((l: any) => l.status === 'completed').length;
        const remaining = lessons.filter((l: any) => l.status === 'scheduled').length;
        const total = lessons.length;

        // Get teacher name
        let teacherName: string | null = null;
        if (firstLesson.teacher_user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', firstLesson.teacher_user_id)
            .single();
          teacherName = profile?.full_name || null;
        }

        // Get location name
        let locationName: string | null = null;
        if (firstLesson.location_id) {
          const { data: loc } = await supabase
            .from('locations')
            .select('name')
            .eq('id', firstLesson.location_id)
            .single();
          locationName = loc?.name || null;
        }

        const rate = findRateForDuration(durationMins, rateCards);

        if (remaining > 0) {
          series.push({
            recurrence_id: recurrenceId,
            day_of_week: dayOfWeek,
            start_time: startTime,
            lesson_title: firstLesson.title || `${dayOfWeek} ${startTime}`,
            teacher_name: teacherName,
            teacher_user_id: firstLesson.teacher_user_id,
            location_name: locationName,
            location_id: firstLesson.location_id,
            total_lessons_in_term: total,
            completed_lessons: completed,
            remaining_lessons: remaining,
            rate_minor: rate,
            duration_mins: durationMins,
          });
        }
      }

      return series.sort((a, b) => {
        const dayOrder = DAY_NAMES.indexOf(a.day_of_week) - DAY_NAMES.indexOf(b.day_of_week);
        if (dayOrder !== 0) return dayOrder;
        return a.start_time.localeCompare(b.start_time);
      });
    },
    enabled: !!currentOrg?.id && !!studentId,
  });
}
