import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export interface PreviousLessonNote {
  studentId: string;
  lessonId: string;
  lessonTitle: string;
  lessonStartAt: string;
  contentCovered: string | null;
  homework: string | null;
  focusAreas: string | null;
  teacherPrivateNotes: string | null;
  teacherId: string;
}

/**
 * Fetches the most recent lesson note per student from lessons before today.
 * Returns a Map keyed by studentId for O(1) lookup.
 * 
 * Privacy: teacher_private_notes are only included if the current user
 * is the note's author (teacher) OR has an admin/owner role.
 */
export function usePreviousLessonNotes(studentIds: string[]) {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['previous-lesson-notes', currentOrg?.id, studentIds.sort().join(',')],
    queryFn: async (): Promise<Map<string, PreviousLessonNote>> => {
      if (!currentOrg || studentIds.length === 0) return new Map();

      const tz = currentOrg.timezone || 'Europe/London';
      const zonedNow = toZonedTime(new Date(), tz);
      const todayStartUtc = fromZonedTime(startOfDay(zonedNow), tz).toISOString();

      // Get the teacher record for the current user to check note authorship
      let currentTeacherId: string | null = null;
      if (currentRole === 'teacher' && user?.id) {
        const { data: t } = await supabase
          .from('teachers')
          .select('id')
          .eq('org_id', currentOrg.id)
          .eq('user_id', user.id)
          .maybeSingle();
        currentTeacherId = t?.id ?? null;
      }

      // Fetch most recent note per student from lessons before today.
      // We use DISTINCT ON via ordering — Supabase doesn't support DISTINCT ON directly,
      // so we fetch recent notes per student and deduplicate client-side.
      const { data, error } = await supabase
        .from('lesson_notes')
        .select(`
          id,
          student_id,
          content_covered,
          homework,
          focus_areas,
          teacher_private_notes,
          teacher_id,
          lesson:lessons!lesson_notes_lesson_id_fkey (
            id,
            title,
            start_at
          )
        `)
        .eq('org_id', currentOrg.id)
        .in('student_id', studentIds)
        .order('created_at', { ascending: false })
        .limit(studentIds.length * 3); // fetch a few per student to ensure coverage

      if (error) throw error;

      const result = new Map<string, PreviousLessonNote>();

      // Filter to lessons before today and pick the most recent per student
      for (const note of data || []) {
        const lesson = note.lesson as unknown as { id: string; title: string; start_at: string } | null;
        if (!lesson || !note.student_id) continue;
        if (lesson.start_at >= todayStartUtc) continue; // skip today's lessons
        if (result.has(note.student_id)) continue; // already have most recent

        const isOwnNote = currentTeacherId === note.teacher_id;
        const isAdminOrOwner = currentRole === 'owner' || currentRole === 'admin';

        result.set(note.student_id, {
          studentId: note.student_id,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          lessonStartAt: lesson.start_at,
          contentCovered: note.content_covered,
          homework: note.homework,
          focusAreas: note.focus_areas,
          // Only expose private notes if the viewer is the author or an admin/owner
          teacherPrivateNotes: (isOwnNote || isAdminOrOwner) ? note.teacher_private_notes : null,
          teacherId: note.teacher_id,
        });
      }

      return result;
    },
    enabled: !!currentOrg && studentIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes — notes don't change frequently
  });
}
