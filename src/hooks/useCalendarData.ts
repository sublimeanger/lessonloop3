import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { LessonWithDetails, CalendarFilters } from '@/components/calendar/types';
import { startOfWeek, endOfWeek, startOfDay, endOfDay, addDays, format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

/**
 * Converts a UTC ISO string to a "fake-local" ISO string whose wall-clock
 * values match the org timezone. Downstream code that calls parseISO().getHours()
 * will then get the correct org-local hour regardless of the browser's timezone.
 */
function toOrgLocalIso(utcIso: string, timezone: string): string {
  const zoned = toZonedTime(utcIso, timezone);
  return format(zoned, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
}

const LESSONS_PAGE_SIZE = 500;

async function fetchCalendarLessons(
  orgId: string,
  orgTimezone: string,
  startIso: string,
  endIso: string,
  filters: CalendarFilters
): Promise<{ lessons: LessonWithDetails[]; isCapReached: boolean }> {
  let query = supabase
    .from('lessons')
    .select(`
      id, title, start_at, end_at, status, lesson_type, notes_shared, notes_private, 
      teacher_id, teacher_user_id, location_id, room_id, org_id, recurrence_id, online_meeting_url,
      created_by, created_at, updated_at, is_series_exception,
      location:locations(id, name),
      room:rooms(id, name)
    `)
    .eq('org_id', orgId)
    .gte('start_at', startIso)
    .lte('start_at', endIso)
    .order('start_at', { ascending: true })
    .limit(LESSONS_PAGE_SIZE);

  if (filters.teacher_id) query = query.eq('teacher_id', filters.teacher_id);
  if (filters.location_id) query = query.eq('location_id', filters.location_id);
  if (filters.room_id) query = query.eq('room_id', filters.room_id);

  const { data: lessonsData, error } = await query;

  if (error || !lessonsData) {
    logger.error('Error fetching lessons:', error);
    return { lessons: [], isCapReached: false };
  }

  const isCapReached = lessonsData.length >= LESSONS_PAGE_SIZE;

  if (lessonsData.length === 0) {
    return { lessons: [], isCapReached: false };
  }

  const lessonIds = lessonsData.map(l => l.id);
  const teacherIds = [...new Set(lessonsData.map(l => l.teacher_id).filter(Boolean))];

  const [teacherRecords, participantsData, attendanceData] = await Promise.all([
    teacherIds.length > 0
      ? supabase.from('teachers').select('id, display_name, email').in('id', teacherIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('lesson_participants')
      .select(`id, lesson_id, student:students(id, first_name, last_name)`)
      .in('lesson_id', lessonIds),
    supabase
      .from('attendance_records')
      .select('lesson_id, student_id, attendance_status')
      .in('lesson_id', lessonIds),
  ]);

  const teacherMap = new Map<string, { full_name: string | null; email: string | null }>(
    ((teacherRecords as any).data || []).map((t: any) => [t.id, { full_name: t.display_name, email: t.email }])
  );
  const participantsMap = new Map<string, any[]>();
  (participantsData.data || []).forEach(p => {
    const existing = participantsMap.get(p.lesson_id) || [];
    participantsMap.set(p.lesson_id, [...existing, p]);
  });
  const attendanceMap = new Map<string, any[]>();
  (attendanceData.data || []).forEach(a => {
    const existing = attendanceMap.get(a.lesson_id) || [];
    attendanceMap.set(a.lesson_id, [...existing, a]);
  });

  const enrichedLessons: LessonWithDetails[] = lessonsData.map((lesson) => ({
    ...lesson,
    start_at: toOrgLocalIso(lesson.start_at, orgTimezone),
    end_at: toOrgLocalIso(lesson.end_at, orgTimezone),
    teacher: teacherMap.get(lesson.teacher_id),
    participants: participantsMap.get(lesson.id) as any || [],
    attendance: attendanceMap.get(lesson.id) || [],
  }));

  return { lessons: enrichedLessons, isCapReached };
}

export function useCalendarData(
  currentDate: Date,
  view: 'day' | 'stacked' | 'week' | 'agenda',
  filters: CalendarFilters
) {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();

  const { startIso, endIso } = useMemo(() => {
    let start: Date, end: Date;
    if (view === 'day' || view === 'week' || view === 'stacked') {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else {
      start = startOfDay(currentDate);
      end = endOfDay(addDays(currentDate, 14));
    }
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }, [currentDate, view]);

  const queryKey = useMemo(
    () => ['calendar-lessons', currentOrg?.id, startIso, endIso, filters.teacher_id, filters.location_id, filters.room_id],
    [currentOrg?.id, startIso, endIso, filters.teacher_id, filters.location_id, filters.room_id]
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchCalendarLessons(
      currentOrg!.id,
      currentOrg!.timezone || 'Europe/London',
      startIso,
      endIso,
      filters
    ),
    enabled: !!currentOrg,
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
  });

  const lessons = data?.lessons ?? [];
  const isCapReached = data?.isCapReached ?? false;

  // setLessons for optimistic updates — writes directly into the query cache
  const setLessons: React.Dispatch<React.SetStateAction<LessonWithDetails[]>> = useCallback(
    (updater) => {
      queryClient.setQueryData(queryKey, (old: { lessons: LessonWithDetails[]; isCapReached: boolean } | undefined) => {
        if (!old) return old;
        const newLessons = typeof updater === 'function' ? updater(old.lessons) : updater;
        return { ...old, lessons: newLessons };
      });
    },
    [queryClient, queryKey]
  );

  return { lessons, setLessons, isLoading, isCapReached, refetch };
}

export function useTeachersAndLocations() {
  const { currentOrg } = useOrg();

  const { data, isLoading } = useQuery({
    queryKey: ['teachers-and-locations', currentOrg?.id],
    queryFn: async () => {
      const [teachersResult, locationResult, roomResult, studentResult] = await Promise.all([
        supabase
          .from('teachers')
          .select('id, display_name, user_id')
          .eq('org_id', currentOrg!.id)
          .eq('status', 'active')
          .order('display_name'),
        supabase
          .from('locations')
          .select('id, name')
          .eq('org_id', currentOrg!.id)
          .order('name'),
        supabase
          .from('rooms')
          .select('id, name, location_id')
          .eq('org_id', currentOrg!.id)
          .order('name'),
        supabase
          .from('students')
          .select('id, first_name, last_name, default_location_id, default_teacher_id, default_rate_card_id')
          .eq('org_id', currentOrg!.id)
          .eq('status', 'active')
          .is('deleted_at', null)
          .order('first_name')
          .limit(500)
      ]);

      return {
        teachers: (teachersResult.data || []).map((t: any) => ({
          id: t.id,
          name: t.display_name || 'Unknown',
          userId: t.user_id,
        })),
        locations: locationResult.data || [],
        rooms: (roomResult.data || []).map((r: any) => ({ id: r.id, name: r.name, location_id: r.location_id })),
        students: (studentResult.data || []).map((s: any) => ({
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          default_location_id: s.default_location_id,
          default_teacher_id: s.default_teacher_id,
          default_rate_card_id: s.default_rate_card_id,
        })),
      };
    },
    enabled: !!currentOrg,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    teachers: data?.teachers ?? [],
    locations: data?.locations ?? [],
    rooms: data?.rooms ?? [],
    students: data?.students ?? [],
    isLoading,
  };
}

export interface ClosureInfo {
  date: Date;
  reason: string;
}

export function useClosureDates(startDate: Date, endDate: Date) {
  const { currentOrg } = useOrg();
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');

  const { data = [], isLoading } = useQuery({
    queryKey: ['closure-dates', currentOrg?.id, startStr, endStr],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data } = await supabase
        .from('closure_dates')
        .select('date, reason')
        .eq('org_id', currentOrg.id)
        .gte('date', startStr)
        .lte('date', endStr);
      return (data || []).map((c) => ({ date: parseISO(c.date), reason: c.reason }));
    },
    enabled: !!currentOrg,
    staleTime: 5 * 60 * 1000,
  });

  return { data, isLoading };
}
