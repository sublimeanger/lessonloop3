import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';

export interface ParentInstrumentInfo {
  student_id: string;
  instrument_name: string;
  instrument_category: string;
  grade_short_name: string | null;
  exam_board_short_name: string | null;
  is_primary: boolean;
}

/**
 * Fetches instruments for a parent's linked children.
 * Returns a map of student_id -> instrument info array.
 */
export function useParentChildInstruments() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['parent-child-instruments', user?.id, currentOrg?.id],
    queryFn: async (): Promise<Record<string, ParentInstrumentInfo[]>> => {
      // Get guardian record
      const { data: guardian } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user!.id)
        .eq('org_id', currentOrg!.id)
        .maybeSingle();

      if (!guardian) return {};

      // Get linked student IDs
      const { data: links } = await supabase
        .from('student_guardians')
        .select('student_id')
        .eq('guardian_id', guardian.id);

      const studentIds = (links || []).map((l) => l.student_id);
      if (studentIds.length === 0) return {};

      // Fetch instruments for all linked children
      const { data, error } = await supabase
        .from('student_instruments')
        .select(`
          student_id,
          is_primary,
          instrument:instruments!student_instruments_instrument_id_fkey(name, category),
          current_grade:grade_levels!student_instruments_current_grade_id_fkey(short_name),
          exam_board:exam_boards!student_instruments_exam_board_id_fkey(short_name)
        `)
        .eq('org_id', currentOrg!.id)
        .in('student_id', studentIds)
        .order('is_primary', { ascending: false });

      if (error) throw error;

      const map: Record<string, ParentInstrumentInfo[]> = {};
      for (const row of (data || [])) {
        const inst = row.instrument as { name: string; category: string } | null;
        if (!inst) continue;
        const grade = row.current_grade as { short_name: string } | null;
        const board = row.exam_board as { short_name: string } | null;

        const info: ParentInstrumentInfo = {
          student_id: row.student_id,
          instrument_name: inst.name,
          instrument_category: inst.category,
          grade_short_name: grade?.short_name || null,
          exam_board_short_name: board?.short_name || null,
          is_primary: row.is_primary,
        };

        if (!map[row.student_id]) map[row.student_id] = [];
        map[row.student_id].push(info);
      }
      return map;
    },
    enabled: !!user?.id && !!currentOrg?.id,
    staleTime: 30_000,
  });
}
