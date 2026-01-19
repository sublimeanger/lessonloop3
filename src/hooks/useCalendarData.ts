import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { LessonWithDetails, CalendarFilters } from '@/components/calendar/types';
import { startOfWeek, endOfWeek, startOfDay, endOfDay, addDays } from 'date-fns';

export function useCalendarData(
  currentDate: Date,
  view: 'day' | 'week' | 'agenda',
  filters: CalendarFilters
) {
  const { currentOrg } = useOrg();
  const [lessons, setLessons] = useState<LessonWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getDateRange = useCallback(() => {
    if (view === 'day') {
      return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
    } else if (view === 'week') {
      return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    } else {
      // Agenda: next 14 days
      return { start: startOfDay(currentDate), end: endOfDay(addDays(currentDate, 14)) };
    }
  }, [currentDate, view]);

  const fetchLessons = useCallback(async () => {
    if (!currentOrg) return;
    
    setIsLoading(true);
    const { start, end } = getDateRange();

    let query = supabase
      .from('lessons')
      .select(`
        *,
        location:locations(name),
        room:rooms(name)
      `)
      .eq('org_id', currentOrg.id)
      .gte('start_at', start.toISOString())
      .lte('start_at', end.toISOString())
      .order('start_at', { ascending: true });

    if (filters.teacher_user_id) {
      query = query.eq('teacher_user_id', filters.teacher_user_id);
    }
    if (filters.location_id) {
      query = query.eq('location_id', filters.location_id);
    }
    if (filters.room_id) {
      query = query.eq('room_id', filters.room_id);
    }

    const { data: lessonsData } = await query;

    if (!lessonsData) {
      setLessons([]);
      setIsLoading(false);
      return;
    }

    // Fetch teacher profiles and participants for each lesson
    const enrichedLessons: LessonWithDetails[] = await Promise.all(
      lessonsData.map(async (lesson) => {
        // Get teacher profile
        const { data: teacherProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', lesson.teacher_user_id)
          .maybeSingle();

        // Get participants
        const { data: participants } = await supabase
          .from('lesson_participants')
          .select(`
            id,
            student:students(id, first_name, last_name)
          `)
          .eq('lesson_id', lesson.id);

        // Get attendance records
        const { data: attendance } = await supabase
          .from('attendance_records')
          .select('student_id, attendance_status')
          .eq('lesson_id', lesson.id);

        return {
          ...lesson,
          teacher: teacherProfile || undefined,
          participants: participants as any || [],
          attendance: attendance || [],
        };
      })
    );

    setLessons(enrichedLessons);
    setIsLoading(false);
  }, [currentOrg, getDateRange, filters]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  return { lessons, isLoading, refetch: fetchLessons };
}

export function useTeachersAndLocations() {
  const { currentOrg } = useOrg();
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [rooms, setRooms] = useState<{ id: string; name: string; location_id: string }[]>([]);
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!currentOrg) return;

    const fetchData = async () => {
      // Fetch teachers (org members with teacher/admin/owner role)
      const { data: memberships } = await supabase
        .from('org_memberships')
        .select('user_id, role')
        .eq('org_id', currentOrg.id)
        .eq('status', 'active')
        .in('role', ['owner', 'admin', 'teacher']);

      if (memberships) {
        const teacherList = await Promise.all(
          memberships.map(async (m) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', m.user_id)
              .maybeSingle();
            return {
              id: m.user_id,
              name: profile?.full_name || profile?.email || 'Unknown',
            };
          })
        );
        setTeachers(teacherList);
      }

      // Fetch locations
      const { data: locationData } = await supabase
        .from('locations')
        .select('id, name')
        .eq('org_id', currentOrg.id)
        .order('name');

      setLocations(locationData || []);

      // Fetch rooms
      const { data: roomData } = await supabase
        .from('rooms')
        .select('id, name, location_id')
        .eq('org_id', currentOrg.id)
        .order('name');

      setRooms(roomData || []);

      // Fetch students
      const { data: studentData } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('org_id', currentOrg.id)
        .eq('status', 'active')
        .order('first_name');

      setStudents(
        (studentData || []).map((s) => ({
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
        }))
      );
    };

    fetchData();
  }, [currentOrg]);

  return { teachers, locations, rooms, students };
}
