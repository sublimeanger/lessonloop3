import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

export interface QuickLessonNote {
  id: string;
  lesson_date: string;
  content_covered: string | null;
  homework: string | null;
  focus_areas: string | null;
  engagement_rating: number | null;
}

export interface StudentQuickNotes {
  profileNotes: string | null;
  recentLessonNotes: QuickLessonNote[];
}

export function useStudentQuickNotes(studentId: string | null, enabled: boolean = false) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['student-quick-notes', currentOrg?.id, studentId],
    queryFn: async (): Promise<StudentQuickNotes> => {
      if (!currentOrg || !studentId) return { profileNotes: null, recentLessonNotes: [] };

      // Fetch student profile notes
      const { data: student } = await supabase
        .from('students')
        .select('notes')
        .eq('id', studentId)
        .eq('org_id', currentOrg.id)
        .maybeSingle();

      // Fetch last 3 lesson notes for this student
      const { data: lessonNotes } = await supabase
        .from('lesson_notes')
        .select(`
          id,
          content_covered,
          homework,
          focus_areas,
          engagement_rating,
          lessons!inner(start_at)
        `)
        .eq('student_id', studentId)
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false })
        .limit(3);

      const recentLessonNotes: QuickLessonNote[] = (lessonNotes || []).map((ln: any) => ({
        id: ln.id,
        lesson_date: ln.lessons?.start_at || '',
        content_covered: ln.content_covered,
        homework: ln.homework,
        focus_areas: ln.focus_areas,
        engagement_rating: ln.engagement_rating,
      }));

      return {
        profileNotes: student?.notes || null,
        recentLessonNotes,
      };
    },
    enabled: enabled && !!currentOrg?.id && !!studentId,
    staleTime: 60_000, // 1 minute
  });
}
