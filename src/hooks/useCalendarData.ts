import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { LessonWithDetails, CalendarFilters } from '@/components/calendar/types';
import { startOfWeek, endOfWeek, startOfDay, endOfDay, addDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

/**
 * Converts a UTC ISO string to a "fake-local" ISO string whose wall-clock
 * values match the org timezone. Downstream code that calls parseISO().getHours()
 * will then get the correct org-local hour regardless of the browser's timezone.
 *
 * Example: "2025-06-15T14:00:00Z" with tz "Europe/London" (BST = UTC+1)
 *  → toZonedTime gives a Date whose getHours() = 15
 *  → we format it as "2025-06-15T15:00:00.000Z" (fake UTC)
 */
function toOrgLocalIso(utcIso: string, timezone: string): string {
  const zoned = toZonedTime(utcIso, timezone);
  return format(zoned, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
}

const LESSONS_PAGE_SIZE = 500;

export function useCalendarData(
  currentDate: Date,
  view: 'stacked' | 'week' | 'agenda',
  filters: CalendarFilters
) {
  const { currentOrg } = useOrg();
  const [lessons, setLessons] = useState<LessonWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCapReached, setIsCapReached] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getDateRange = useCallback(() => {
    if (view === 'week' || view === 'stacked') {
      return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    } else {
      // Agenda: next 14 days
      return { start: startOfDay(currentDate), end: endOfDay(addDays(currentDate, 14)) };
    }
  }, [currentDate, view]);

  const fetchLessons = useCallback(async () => {
    if (!currentOrg) return;
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    const { start, end } = getDateRange();

    try {
      // Build query with optimized date window using indexed columns
      let query = supabase
        .from('lessons')
        .select(`
          id, title, start_at, end_at, status, lesson_type, notes_shared, notes_private, 
          teacher_user_id, location_id, room_id, org_id, recurrence_id, online_meeting_url,
          created_by, created_at, updated_at, is_series_exception,
          location:locations(id, name),
          room:rooms(id, name)
        `)
        .eq('org_id', currentOrg.id)
        .gte('start_at', start.toISOString())
        .lte('start_at', end.toISOString())
        .order('start_at', { ascending: true })
        .limit(LESSONS_PAGE_SIZE);

      if (filters.teacher_id) {
        query = query.eq('teacher_id', filters.teacher_id);
      }
      if (filters.teacher_user_id) {
        query = query.eq('teacher_user_id', filters.teacher_user_id);
      }
      if (filters.location_id) {
        query = query.eq('location_id', filters.location_id);
      }
      if (filters.room_id) {
        query = query.eq('room_id', filters.room_id);
      }

      const { data: lessonsData, error } = await query;

      if (error || !lessonsData) {
        logger.error('Error fetching lessons:', error);
        setLessons([]);
        setIsCapReached(false);
        setIsLoading(false);
        return;
      }

      // Check if we hit the page size cap
      setIsCapReached(lessonsData.length >= LESSONS_PAGE_SIZE);

      if (lessonsData.length === 0) {
        setLessons([]);
        setIsLoading(false);
        return;
      }

      // Batch fetch all related data in parallel for performance
      const lessonIds = lessonsData.map(l => l.id);
      const teacherIds = [...new Set(lessonsData.map(l => l.teacher_user_id))];

      const [teacherProfiles, participantsData, attendanceData] = await Promise.all([
        // Batch fetch all teacher profiles
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', teacherIds),
        // Batch fetch all participants
        supabase
          .from('lesson_participants')
          .select(`
            id, lesson_id,
            student:students(id, first_name, last_name)
          `)
          .in('lesson_id', lessonIds),
        // Batch fetch all attendance records
        supabase
          .from('attendance_records')
          .select('lesson_id, student_id, attendance_status')
          .in('lesson_id', lessonIds)
      ]);

      // Build lookup maps for efficient access
      const teacherMap = new Map(
        (teacherProfiles.data || []).map(t => [t.id, { full_name: t.full_name, email: t.email }])
      );
      const participantsMap = new Map<string, typeof participantsData.data>();
      (participantsData.data || []).forEach(p => {
        const existing = participantsMap.get(p.lesson_id) || [];
        participantsMap.set(p.lesson_id, [...existing, p]);
      });
      const attendanceMap = new Map<string, typeof attendanceData.data>();
      (attendanceData.data || []).forEach(a => {
        const existing = attendanceMap.get(a.lesson_id) || [];
        attendanceMap.set(a.lesson_id, [...existing, a]);
      });

      // Enrich lessons with related data from maps and convert to org timezone
      const orgTimezone = currentOrg.timezone || 'Europe/London';
      const enrichedLessons: LessonWithDetails[] = lessonsData.map((lesson) => ({
        ...lesson,
        // Convert UTC times to org-local "fake UTC" strings so downstream
        // parseISO().getHours() returns org-local wall-clock hours
        start_at: toOrgLocalIso(lesson.start_at, orgTimezone),
        end_at: toOrgLocalIso(lesson.end_at, orgTimezone),
        teacher: teacherMap.get(lesson.teacher_user_id),
        participants: participantsMap.get(lesson.id) as any || [],
        attendance: attendanceMap.get(lesson.id) || [],
      }));

      setLessons(enrichedLessons);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        logger.error('Error fetching lessons:', error);
        setLessons([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, getDateRange, filters]);

  useEffect(() => {
    fetchLessons();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchLessons]);

  return { lessons, setLessons, isLoading, isCapReached, refetch: fetchLessons };
}

export function useTeachersAndLocations() {
  const { currentOrg } = useOrg();
  const [teachers, setTeachers] = useState<{ id: string; name: string; userId: string | null }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [rooms, setRooms] = useState<{ id: string; name: string; location_id: string }[]>([]);
  const [students, setStudents] = useState<{ 
    id: string; 
    name: string; 
    default_location_id: string | null;
    default_teacher_id: string | null;
    default_rate_card_id: string | null;
  }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentOrg) return;

    const fetchData = async () => {
      setIsLoading(true);
      
      // Fetch all data in parallel - now using teachers table
      const [teachersResult, locationResult, roomResult, studentResult] = await Promise.all([
        supabase
          .from('teachers')
          .select('id, display_name, user_id')
          .eq('org_id', currentOrg.id)
          .eq('status', 'active')
          .order('display_name'),
        supabase
          .from('locations')
          .select('id, name')
          .eq('org_id', currentOrg.id)
          .order('name'),
        supabase
          .from('rooms')
          .select('id, name, location_id')
          .eq('org_id', currentOrg.id)
          .order('name'),
        supabase
          .from('students')
          .select('id, first_name, last_name, default_location_id, default_teacher_id, default_rate_card_id')
          .eq('org_id', currentOrg.id)
          .eq('status', 'active')
          .is('deleted_at', null)
          .order('first_name')
          .limit(500)
      ]);

      // Map teachers from new teachers table
      const teacherList = (teachersResult.data || []).map((t: any) => ({
        id: t.id,
        name: t.display_name || 'Unknown',
        userId: t.user_id,
      }));
      setTeachers(teacherList);

      setLocations(locationResult.data || []);
      setRooms(roomResult.data || []);
      setStudents(
        (studentResult.data || []).map((s) => ({
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          default_location_id: s.default_location_id,
          default_teacher_id: s.default_teacher_id,
          default_rate_card_id: s.default_rate_card_id,
        }))
      );
      
      setIsLoading(false);
    };

    fetchData();
  }, [currentOrg]);

  return { teachers, locations, rooms, students, isLoading };
}
