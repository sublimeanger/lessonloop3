import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { ConflictResult } from '@/components/calendar/types';

interface ConflictCheckParams {
  start_at: Date;
  end_at: Date;
  teacher_user_id: string;
  room_id: string | null;
  student_ids: string[];
  exclude_lesson_id?: string;
}

export function useConflictDetection() {
  const { currentOrg } = useOrg();

  const checkConflicts = async (params: ConflictCheckParams): Promise<ConflictResult[]> => {
    if (!currentOrg) return [];

    const conflicts: ConflictResult[] = [];
    const { start_at, end_at, teacher_user_id, room_id, student_ids, exclude_lesson_id } = params;

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

    // Check teacher lesson overlap
    let teacherQuery = supabase
      .from('lessons')
      .select('id, title, start_at, end_at')
      .eq('org_id', currentOrg.id)
      .eq('teacher_user_id', teacher_user_id)
      .neq('status', 'cancelled')
      .lt('start_at', end_at.toISOString())
      .gt('end_at', start_at.toISOString());

    if (exclude_lesson_id) {
      teacherQuery = teacherQuery.neq('id', exclude_lesson_id);
    }

    const { data: teacherLessons } = await teacherQuery;

    if (teacherLessons && teacherLessons.length > 0) {
      conflicts.push({
        type: 'teacher',
        severity: 'error',
        message: `Teacher already has a lesson at this time: ${teacherLessons[0].title}`,
      });
    }

    // Check room overlap
    if (room_id) {
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
