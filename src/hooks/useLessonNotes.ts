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

/** Map the flat row returned by get_lesson_notes_for_staff RPC to LessonNote. */
function mapRpcToLessonNote(row: any): LessonNote {
  return {
    id: row.id,
    lesson_id: row.lesson_id,
    student_id: row.student_id,
    teacher_id: row.teacher_id,
    org_id: row.org_id,
    content_covered: row.content_covered,
    homework: row.homework,
    focus_areas: row.focus_areas,
    engagement_rating: row.engagement_rating,
    teacher_private_notes: row.teacher_private_notes,
    parent_visible: row.parent_visible,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
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
 * Uses get_lesson_notes_for_staff RPC for column-level privacy
 * (teacher_private_notes scoped to own notes for non-admins).
 */
export function useLessonNotes(lessonId: string | undefined) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['lesson-notes', lessonId],
    queryFn: async () => {
      if (!lessonId || !currentOrg) return [];

      const { data, error } = await (supabase.rpc as any)('get_lesson_notes_for_staff', {
        p_org_id: currentOrg.id,
        p_filters: { lesson_id: lessonId },
      });

      if (error) throw error;
      return ((data || []) as any[]).map(mapRpcToLessonNote);
    },
    enabled: !!lessonId && !!currentOrg,
  });
}

/**
 * Fetch all structured lesson notes for a specific student (across all lessons).
 * Uses get_lesson_notes_for_staff RPC which handles:
 * - Column-level privacy for teacher_private_notes
 * - Whole-lesson note inclusion via lesson participation check
 */
export function useStudentLessonNotes(studentId: string | undefined) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['student-lesson-notes', studentId, currentOrg?.id],
    queryFn: async () => {
      if (!studentId || !currentOrg) return [];

      const { data, error } = await (supabase.rpc as any)('get_lesson_notes_for_staff', {
        p_org_id: currentOrg.id,
        p_filters: {
          student_id: studentId,
          include_whole_lesson: 'true',
          limit: '50',
        },
      });

      if (error) throw error;
      return ((data || []) as any[]).map(mapRpcToLessonNote);
    },
    enabled: !!studentId && !!currentOrg,
  });
}

/**
 * Fetch lesson notes visible to parents for a specific student.
 * Uses get_parent_lesson_notes RPC which excludes teacher_private_notes server-side.
 */
export function useParentLessonNotes(studentId: string | undefined, orgId: string | undefined) {
  return useQuery({
    queryKey: ['parent-lesson-notes', studentId, orgId],
    queryFn: async () => {
      if (!studentId || !orgId) return [];

      const { data, error } = await (supabase.rpc as any)('get_parent_lesson_notes', {
        p_student_id: studentId,
        p_org_id: orgId,
      });

      if (error) throw error;
      return ((data || []) as any[]).map(mapRpcToLessonNote);
    },
    enabled: !!studentId && !!orgId,
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

      const { data, error } = await supabase
        .from('lesson_notes')
        .upsert(noteData, { onConflict: 'lesson_id,student_id,teacher_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
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
