import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { STALE_VOLATILE, STALE_STABLE, GC_DEFAULT } from '@/config/query-stale-times';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { LessonWithDetails, CalendarFilters } from '@/components/calendar/types';
import { startOfWeek, endOfWeek, startOfDay, endOfDay, addDays, format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

/**
 * Converts a UTC ISO string to an org-local wall-clock ISO string.
 * The result has NO timezone indicator — it represents the org's local time.
 * parseISO() will treat it as local time, so .getHours() returns the correct org-local hour.
 *
 * WARNING: Do NOT pass these strings to APIs or functions expecting real UTC.
 * For real UTC values, use the original start_at/end_at from the database.
 */
function toOrgLocalIso(utcIso: string, timezone: string): string {
  const zoned = toZonedTime(utcIso, timezone);
  return format(zoned, "yyyy-MM-dd'T'HH:mm:ss.SSS");
}

const LESSONS_PAGE_SIZE = 500;
const LESSONS_PAGE_SIZE_FILTERED = 1000;

async function fetchCalendarLessons(
  orgId: string,
  orgTimezone: string,
  startIso: string,
  endIso: string,
  filters: CalendarFilters
): Promise<{ lessons: LessonWithDetails[]; isCapReached: boolean }> {
  const hasFilters = !!(filters.teacher_id || filters.location_id || filters.room_id || filters.instrument);
  const pageSize = hasFilters ? LESSONS_PAGE_SIZE_FILTERED : LESSONS_PAGE_SIZE;

  let query = supabase
    .from('lessons')
    .select(`
      id, title, start_at, end_at, status, lesson_type, notes_shared, notes_private, 
      teacher_id, teacher_user_id, location_id, room_id, org_id, recurrence_id, online_meeting_url,
      created_by, created_at, updated_at, is_series_exception,
      location:locations(id, name, is_archived),
      room:rooms(id, name)
    `)
    .eq('org_id', orgId)
    .gte('start_at', startIso)
    .lte('start_at', endIso)
    .order('start_at', { ascending: true })
    .limit(pageSize);

  if (filters.teacher_id) query = query.eq('teacher_id', filters.teacher_id);
  if (filters.location_id) query = query.eq('location_id', filters.location_id);
  if (filters.room_id) query = query.eq('room_id', filters.room_id);
  if (filters.hide_cancelled) query = query.neq('status', 'cancelled');

  // Instrument filter: find teachers who teach this instrument, then filter lessons by those teacher IDs
  if (filters.instrument) {
    const { data: matchingProfiles } = await supabase
      .from('teacher_profiles')
      .select('user_id')
      .eq('org_id', orgId)
      .contains('instruments', [filters.instrument]);

    if (matchingProfiles && matchingProfiles.length > 0) {
      // Get teacher IDs (from teachers table) for these user_ids
      const userIds = matchingProfiles.map(p => p.user_id);
      const { data: matchingTeachers } = await supabase
        .from('teachers')
        .select('id')
        .eq('org_id', orgId)
        .in('user_id', userIds);

      const teacherIds = (matchingTeachers || []).map(t => t.id);
      if (teacherIds.length > 0) {
        query = query.in('teacher_id', teacherIds);
      } else {
        // No teachers for this instrument — return empty
        return { lessons: [], isCapReached: false };
      }
    } else {
      return { lessons: [], isCapReached: false };
    }
  }

  const { data: lessonsData, error } = await query;

  if (error || !lessonsData) {
    logger.error('Error fetching lessons:', error);
    return { lessons: [], isCapReached: false };
  }

  const isCapReached = lessonsData.length >= pageSize;

  if (lessonsData.length === 0) {
    return { lessons: [], isCapReached: false };
  }

  const lessonIds = lessonsData.map(l => l.id);
  const teacherIds = [...new Set(lessonsData.map(l => l.teacher_id).filter((id): id is string => id != null))];

  const [teacherRecords, participantsData, attendanceData, makeupData] = await Promise.all([
    teacherIds.length > 0
      ? supabase.from('teachers').select('id, display_name, email').in('id', teacherIds as string[])
      : Promise.resolve({ data: [] }),
    supabase
      .from('lesson_participants')
      .select(`id, lesson_id, student:students(id, first_name, last_name)`)
      .in('lesson_id', lessonIds),
    supabase
      .from('attendance_records')
      .select('lesson_id, student_id, attendance_status')
      .in('lesson_id', lessonIds),
    supabase
      .from('make_up_waitlist')
      .select('booked_lesson_id, student_id')
      .in('booked_lesson_id', lessonIds)
      .eq('status', 'booked'),
  ]);

  const teacherData = ('data' in teacherRecords ? teacherRecords.data : teacherRecords) as { id: string; display_name: string | null; email: string | null }[] | null;
  const teacherMap = new Map<string, { full_name: string | null; email: string | null }>(
    (teacherData || []).map((t) => [t.id, { full_name: t.display_name, email: t.email }])
  );
  const participantsMap = new Map<string, { id: string; lesson_id: string; student: { id: string; first_name: string; last_name: string } | null }[]>();
  (participantsData.data || []).forEach(p => {
    const existing = participantsMap.get(p.lesson_id) || [];
    participantsMap.set(p.lesson_id, [...existing, p]);
  });
  const attendanceMap = new Map<string, { lesson_id: string; student_id: string; attendance_status: string }[]>();
  (attendanceData.data || []).forEach(a => {
    const existing = attendanceMap.get(a.lesson_id) || [];
    attendanceMap.set(a.lesson_id, [...existing, a]);
  });
  const makeupMap = new Map<string, string[]>();
  (makeupData.data || []).forEach((m: any) => {
    if (m.booked_lesson_id) {
      const existing = makeupMap.get(m.booked_lesson_id) || [];
      makeupMap.set(m.booked_lesson_id, [...existing, m.student_id]);
    }
  });

  const enrichedLessons: LessonWithDetails[] = lessonsData.map((lesson) => ({
    ...lesson,
    start_at: toOrgLocalIso(lesson.start_at, orgTimezone),
    end_at: toOrgLocalIso(lesson.end_at, orgTimezone),
    teacher: teacherMap.get(lesson.teacher_id ?? '') ?? undefined,
    location: lesson.location ? { name: lesson.location.name } : undefined,
    room: lesson.room ? { name: lesson.room.name } : undefined,
    participants: (participantsMap.get(lesson.id) || []) as LessonWithDetails['participants'],
    attendance: (attendanceMap.get(lesson.id) || []) as LessonWithDetails['attendance'],
    makeupStudentIds: makeupMap.get(lesson.id) || [],
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
    () => ['calendar-lessons', currentOrg?.id, startIso, endIso, filters.teacher_id, filters.location_id, filters.room_id, filters.instrument, filters.hide_cancelled],
    [currentOrg?.id, startIso, endIso, filters.teacher_id, filters.location_id, filters.room_id, filters.instrument, filters.hide_cancelled]
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
    staleTime: STALE_VOLATILE,
    gcTime: GC_DEFAULT,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Realtime subscription: invalidate calendar cache on any lessons change for this org
  useEffect(() => {
    if (!currentOrg?.id) return;

    const channel = supabase
      .channel('calendar-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lessons',
          filter: `org_id=eq.${currentOrg.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['calendar-lessons'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrg?.id, queryClient]);

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
          .eq('is_archived', false)
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

      const teachersList = (teachersResult.data || []).map((t: any) => ({
        id: t.id,
        name: t.display_name || 'Unknown',
        userId: t.user_id,
      }));

      // Fetch instruments from teacher_profiles for the org
      const { data: profilesData } = await supabase
        .from('teacher_profiles')
        .select('instruments')
        .eq('org_id', currentOrg!.id);

      const instrumentSet = new Set<string>();
      (profilesData || []).forEach((p: any) => {
        (p.instruments || []).forEach((i: string) => {
          if (i) instrumentSet.add(i);
        });
      });
      const instruments = [...instrumentSet].sort();

      return {
        teachers: teachersList,
        locations: locationResult.data || [],
        rooms: (roomResult.data || []).map((r: any) => ({ id: r.id, name: r.name, location_id: r.location_id })),
        students: (studentResult.data || []).map((s: any) => ({
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          default_location_id: s.default_location_id,
          default_teacher_id: s.default_teacher_id,
          default_rate_card_id: s.default_rate_card_id,
        })),
        instruments,
      };
    },
    enabled: !!currentOrg,
    staleTime: STALE_STABLE,
    gcTime: GC_DEFAULT,
  });

  return {
    teachers: data?.teachers ?? [],
    locations: data?.locations ?? [],
    rooms: data?.rooms ?? [],
    students: data?.students ?? [],
    instruments: data?.instruments ?? [],
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
    staleTime: STALE_STABLE,
  });

  return { data, isLoading };
}
