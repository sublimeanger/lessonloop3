import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { STALE_REPORT, GC_REPORT } from '@/config/query-stale-times';

export interface ExplorerNote {
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
  // Joined
  lesson_title: string;
  lesson_start_at: string;
  lesson_status: string;
  student_first_name: string | null;
  student_last_name: string | null;
  teacher_display_name: string | null;
}

export interface NotesExplorerFilters {
  startDate: string; // ISO
  endDate: string; // ISO
  teacherId?: string | null;
  studentId?: string | null;
  visibilityFilter?: 'all' | 'parent_visible' | 'private';
  searchQuery?: string;
}

export interface NotesStats {
  totalNotes: number;
  uniqueStudents: number;
  averageEngagement: number | null;
  notesWithoutHomework: number;
}

export function useNotesExplorer(filters: NotesExplorerFilters, page: number = 0) {
  const { currentOrg } = useOrg();
  const PAGE_SIZE = 50;

  return useQuery({
    queryKey: ['notes-explorer', currentOrg?.id, filters, page],
    queryFn: async (): Promise<{ notes: ExplorerNote[]; hasMore: boolean }> => {
      if (!currentOrg) return { notes: [], hasMore: false };

      // Use RPC for column-level privacy: teacher_private_notes is scoped
      // server-side (teachers see only own, admins see all, parents see none).
      const rpcFilters: Record<string, string> = {
        start_date: filters.startDate,
        end_date: filters.endDate,
        limit: String(PAGE_SIZE + 1),
        offset: String(page * PAGE_SIZE),
      };
      if (filters.teacherId) rpcFilters.teacher_id = filters.teacherId;
      if (filters.studentId) rpcFilters.student_id = filters.studentId;
      if (filters.visibilityFilter && filters.visibilityFilter !== 'all') {
        rpcFilters.visibility = filters.visibilityFilter;
      }

      const { data, error } = await (supabase.rpc as any)('get_lesson_notes_for_staff', {
        p_org_id: currentOrg.id,
        p_filters: rpcFilters,
      });
      if (error) throw error;

      const raw = (data || []) as ExplorerNote[];
      const hasMore = raw.length > PAGE_SIZE;
      let notes = hasMore ? raw.slice(0, PAGE_SIZE) : raw;

      // Client-side text search
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        notes = notes.filter(n =>
          (n.content_covered?.toLowerCase().includes(q)) ||
          (n.homework?.toLowerCase().includes(q)) ||
          (n.focus_areas?.toLowerCase().includes(q)) ||
          (n.student_first_name?.toLowerCase().includes(q)) ||
          (n.student_last_name?.toLowerCase().includes(q))
        );
      }

      return { notes, hasMore };
    },
    enabled: !!currentOrg && !!filters.startDate && !!filters.endDate,
    staleTime: STALE_REPORT,
    gcTime: GC_REPORT,
  });
}

export function useNotesStats(filters: NotesExplorerFilters) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['notes-stats', currentOrg?.id, filters.startDate, filters.endDate, filters.teacherId, filters.studentId, filters.visibilityFilter, filters.searchQuery],
    queryFn: async (): Promise<NotesStats> => {
      if (!currentOrg) return { totalNotes: 0, uniqueStudents: 0, averageEngagement: null, notesWithoutHomework: 0 };

      let query = supabase
        .from('lesson_notes')
        .select(`
          id,
          student_id,
          engagement_rating,
          homework,
          content_covered,
          focus_areas,
          teacher_id,
          parent_visible,
          student:students(first_name, last_name),
          lesson:lessons!inner(start_at)
        `)
        .eq('org_id', currentOrg.id)
        .gte('lesson.start_at', filters.startDate)
        .lte('lesson.start_at', filters.endDate);

      if (filters.teacherId) {
        query = query.eq('teacher_id', filters.teacherId);
      }

      if (filters.studentId) {
        query = query.eq('student_id', filters.studentId);
      }

      if (filters.visibilityFilter === 'parent_visible') {
        query = query.eq('parent_visible', true);
      } else if (filters.visibilityFilter === 'private') {
        query = query.eq('parent_visible', false);
      }

      const { data, error } = await query;
      if (error) throw error;

      let rows = data || [];

      // Client-side text search to match explorer
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        rows = rows.filter((r: any) =>
          (r.content_covered?.toLowerCase().includes(q)) ||
          (r.homework?.toLowerCase().includes(q)) ||
          (r.focus_areas?.toLowerCase().includes(q)) ||
          (r.student?.first_name?.toLowerCase().includes(q)) ||
          (r.student?.last_name?.toLowerCase().includes(q))
        );
      }

      const studentIds = new Set(rows.map(r => r.student_id).filter(Boolean));
      const ratings = rows.map(r => r.engagement_rating).filter((r): r is number => r !== null);
      const avgEngagement = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
      const withoutHomework = rows.filter(r => !r.homework || (r.homework as string).trim() === '').length;

      return {
        totalNotes: rows.length,
        uniqueStudents: studentIds.size,
        averageEngagement: avgEngagement ? Math.round(avgEngagement * 10) / 10 : null,
        notesWithoutHomework: withoutHomework,
      };
    },
    enabled: !!currentOrg && !!filters.startDate && !!filters.endDate,
    staleTime: STALE_REPORT,
    gcTime: GC_REPORT,
  });
}
