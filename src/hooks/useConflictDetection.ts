import { format, getDay, differenceInMinutes, addMinutes, subMinutes } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { ConflictResult } from '@/components/calendar/types';
import type { Database } from '@/integrations/supabase/types';

type DayOfWeek = Database['public']['Enums']['day_of_week'];

const DAY_INDEX_TO_NAME: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

interface ConflictCheckParams {
  start_at: Date;
  end_at: Date;
  teacher_user_id: string;
  room_id: string | null;
  location_id: string | null;
  student_ids: string[];
  exclude_lesson_id?: string;
}

export function useConflictDetection() {
  const { currentOrg } = useOrg();

  const checkConflicts = async (params: ConflictCheckParams): Promise<ConflictResult[]> => {
    if (!currentOrg) return [];

    const conflicts: ConflictResult[] = [];
    const { start_at, end_at, teacher_user_id, room_id, location_id, student_ids, exclude_lesson_id } = params;

    // Check closure dates
    const lessonDate = format(start_at, 'yyyy-MM-dd');
    const { data: closures } = await supabase
      .from('closure_dates')
      .select('reason, location_id, applies_to_all_locations')
      .eq('org_id', currentOrg.id)
      .eq('date', lessonDate);

    if (closures && closures.length > 0) {
      // Check if any closure applies to this lesson
      const applicableClosure = closures.find(c => {
        if (c.applies_to_all_locations) return true;
        if (location_id && c.location_id === location_id) return true;
        return false;
      });

      if (applicableClosure) {
        const severity = currentOrg.block_scheduling_on_closures ? 'error' : 'warning';
        conflicts.push({
          type: 'closure' as any,
          severity,
          message: `This date is marked as closed: ${applicableClosure.reason}`,
        });
      }
    }

    // Check teacher availability blocks
    const dayOfWeek = DAY_INDEX_TO_NAME[getDay(start_at)];
    const lessonStartTime = format(start_at, 'HH:mm:ss');
    const lessonEndTime = format(end_at, 'HH:mm:ss');

    const { data: availabilityBlocks } = await supabase
      .from('availability_blocks')
      .select('start_time_local, end_time_local')
      .eq('org_id', currentOrg.id)
      .eq('teacher_user_id', teacher_user_id)
      .eq('day_of_week', dayOfWeek);

    if (availabilityBlocks && availabilityBlocks.length > 0) {
      // Teacher has availability defined - check if lesson fits
      const fitsWithinAvailability = availabilityBlocks.some(block => {
        return lessonStartTime >= block.start_time_local && lessonEndTime <= block.end_time_local;
      });

      if (!fitsWithinAvailability) {
        conflicts.push({
          type: 'availability' as any,
          severity: 'warning',
          message: `Lesson is outside teacher's available hours on ${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}`,
        });
      }
    }

    // Check teacher time-off
    const { data: timeOff } = await supabase
      .from('time_off_blocks')
      .select('id, reason')
      .eq('org_id', currentOrg.id)
      .eq('teacher_user_id', teacher_user_id)
      .lt('start_at', end_at.toISOString())
      .gt('end_at', start_at.toISOString());

    if (timeOff && timeOff.length > 0) {
      conflicts.push({
        type: 'time_off',
        severity: 'error',
        message: `Teacher has time off during this period${timeOff[0].reason ? `: ${timeOff[0].reason}` : ''}`,
      });
    }

    // Check teacher lesson overlap WITH travel buffer
    const bufferMinutes = (currentOrg as any).buffer_minutes_between_locations || 0;
    const bufferedStart = bufferMinutes > 0 ? subMinutes(start_at, bufferMinutes) : start_at;
    const bufferedEnd = bufferMinutes > 0 ? addMinutes(end_at, bufferMinutes) : end_at;

    let teacherQuery = supabase
      .from('lessons')
      .select('id, title, start_at, end_at, location_id')
      .eq('org_id', currentOrg.id)
      .eq('teacher_user_id', teacher_user_id)
      .neq('status', 'cancelled')
      .lt('start_at', bufferedEnd.toISOString())
      .gt('end_at', bufferedStart.toISOString());

    if (exclude_lesson_id) {
      teacherQuery = teacherQuery.neq('id', exclude_lesson_id);
    }

    const { data: teacherLessons } = await teacherQuery;

    if (teacherLessons && teacherLessons.length > 0) {
      // Check if it's a direct overlap or just a buffer issue
      const directOverlap = teacherLessons.find(l => {
        const lStart = new Date(l.start_at);
        const lEnd = new Date(l.end_at);
        return lStart < end_at && lEnd > start_at;
      });

      if (directOverlap) {
        conflicts.push({
          type: 'teacher',
          severity: 'error',
          message: `Teacher already has a lesson at this time: ${directOverlap.title}`,
        });
      } else if (bufferMinutes > 0) {
        // It's a buffer issue - check if at different locations
        const bufferConflict = teacherLessons.find(l => l.location_id !== location_id);
        if (bufferConflict) {
          conflicts.push({
            type: 'teacher',
            severity: 'warning',
            message: `Teacher needs ${bufferMinutes} min travel buffer between locations. Next lesson: ${bufferConflict.title}`,
          });
        }
      }
    }

    // Check room overlap AND capacity
    if (room_id) {
      // Get room capacity
      const { data: room } = await supabase
        .from('rooms')
        .select('name, max_capacity')
        .eq('id', room_id)
        .single();

      // Check capacity for group lessons
      if (room && room.max_capacity && student_ids.length > room.max_capacity) {
        conflicts.push({
          type: 'room',
          severity: 'error',
          message: `Room "${room.name}" has a capacity of ${room.max_capacity} students, but ${student_ids.length} are assigned`,
        });
      }

      // Check booking conflicts
      let roomQuery = supabase
        .from('lessons')
        .select('id, title, start_at, end_at')
        .eq('org_id', currentOrg.id)
        .eq('room_id', room_id)
        .neq('status', 'cancelled')
        .lt('start_at', end_at.toISOString())
        .gt('end_at', start_at.toISOString());

      if (exclude_lesson_id) {
        roomQuery = roomQuery.neq('id', exclude_lesson_id);
      }

      const { data: roomLessons } = await roomQuery;

      if (roomLessons && roomLessons.length > 0) {
        conflicts.push({
          type: 'room',
          severity: 'error',
          message: `Room is already booked: ${roomLessons[0].title}`,
        });
      }
    }

    // Check student overlap
    for (const studentId of student_ids) {
      // Get all lessons the student is in during this time
      const { data: studentParticipations } = await supabase
        .from('lesson_participants')
        .select(`
          lesson_id,
          lesson:lessons!inner(id, title, start_at, end_at, status)
        `)
        .eq('org_id', currentOrg.id)
        .eq('student_id', studentId);

      if (studentParticipations) {
        const overlapping = studentParticipations.filter((p: any) => {
          const lesson = p.lesson;
          if (!lesson || lesson.status === 'cancelled') return false;
          if (exclude_lesson_id && lesson.id === exclude_lesson_id) return false;
          
          const lessonStart = new Date(lesson.start_at);
          const lessonEnd = new Date(lesson.end_at);
          
          return lessonStart < end_at && lessonEnd > start_at;
        });

        if (overlapping.length > 0) {
          const { data: student } = await supabase
            .from('students')
            .select('first_name, last_name')
            .eq('id', studentId)
            .single();

          conflicts.push({
            type: 'student',
            severity: 'warning',
            message: `${student?.first_name} ${student?.last_name} has another lesson at this time`,
            entity_name: `${student?.first_name} ${student?.last_name}`,
          });
        }
      }
    }

    return conflicts;
  };

  return { checkConflicts };
}
