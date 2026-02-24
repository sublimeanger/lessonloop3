import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface LessonNote {
  id: string;
  lesson_id: string;
  student_id: string | null;
  teacher_id: string;
  org_id: string;
  content_covered: string | null;
  homework: string | null;
  focus_areas: string | null;
  engagement_rating: number | null;
  teacher_private_notes: string | null;
  parent_visible: boolean;
  created_at: string;
  updated_at: string;
}

interface SaveLessonNoteInput {
  id?: string;
  lesson_id: string;
  student_id?: string | null;
  content_covered?: string | null;
  homework?: string | null;
  focus_areas?: string | null;
  engagement_rating?: number | null;
  teacher_private_notes?: string | null;
  parent_visible?: boolean;
}

/**
 * Fetch structured lesson notes for a specific lesson.
 */
export function useLessonNotes(lessonId: string | undefined) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['lesson-notes', lessonId],
    queryFn: async () => {
      if (!lessonId || !currentOrg) return [];

      const { data, error } = await supabase
        .from('lesson_notes')
        .select('*')
        .eq('lesson_id', lessonId)
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as LessonNote[];
    },
    enabled: !!lessonId && !!currentOrg,
  });
}

/**
 * Fetch all structured lesson notes for a specific student (across all lessons).
 * Used on the StudentDetail notes tab.
 */
export function useStudentLessonNotes(studentId: string | undefined) {
  const { currentOrg, isOrgAdmin } = useOrg();

  return useQuery({
    queryKey: ['student-lesson-notes', studentId, currentOrg?.id],
    queryFn: async () => {
      if (!studentId || !currentOrg) return [];

      // Fetch lesson notes for this student (both whole-lesson and per-student notes)
      const { data, error } = await supabase
        .from('lesson_notes')
        .select(`
          *,
          lesson:lessons(id, title, start_at, status)
        `)
        .eq('org_id', currentOrg.id)
        .or(`student_id.eq.${studentId},student_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Filter to only lessons this student is in (for whole-lesson notes)
      // We need to verify student participation for student_id=null notes
      const noteData = data || [];
      if (noteData.length === 0) return [];

      // Get lesson IDs for null student_id notes to verify participation
      const nullStudentNoteIds = noteData
        .filter(n => n.student_id === null)
        .map(n => n.lesson_id);

      if (nullStudentNoteIds.length > 0) {
        const { data: participations } = await supabase
          .from('lesson_participants')
          .select('lesson_id')
          .eq('student_id', studentId)
          .in('lesson_id', nullStudentNoteIds);

        const participatingLessonIds = new Set(participations?.map(p => p.lesson_id) || []);

        // Filter out whole-lesson notes where student isn't a participant
        return noteData.filter(n =>
          n.student_id === studentId || participatingLessonIds.has(n.lesson_id)
        );
      }

      return noteData;
    },
    enabled: !!studentId && !!currentOrg,
  });
}

/**
 * Save (upsert) a structured lesson note.
 */
export function useSaveLessonNote() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveLessonNoteInput) => {
      if (!currentOrg || !user) throw new Error('Not authenticated');

      // Resolve teacher ID for the current user
      const { data: teacherRecord } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .eq('org_id', currentOrg.id)
        .maybeSingle();

      if (!teacherRecord) throw new Error('Teacher profile not found');

      const noteData = {
        lesson_id: input.lesson_id,
        student_id: input.student_id || null,
        teacher_id: teacherRecord.id,
        org_id: currentOrg.id,
        content_covered: input.content_covered || null,
        homework: input.homework || null,
        focus_areas: input.focus_areas || null,
        engagement_rating: input.engagement_rating || null,
        teacher_private_notes: input.teacher_private_notes || null,
        parent_visible: input.parent_visible ?? true,
        updated_at: new Date().toISOString(),
      };

      if (input.id) {
        // Update existing note
        const { data, error } = await supabase
          .from('lesson_notes')
          .update(noteData)
          .eq('id', input.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new note
        const { data, error } = await supabase
          .from('lesson_notes')
          .insert(noteData)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lesson-notes', variables.lesson_id] });
      if (variables.student_id) {
        queryClient.invalidateQueries({ queryKey: ['student-lesson-notes', variables.student_id] });
      }
      toast({ title: 'Lesson notes saved' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save notes',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
