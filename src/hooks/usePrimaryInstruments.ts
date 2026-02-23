import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

export interface PrimaryInstrumentInfo {
  student_id: string;
  instrument_name: string;
  instrument_category: string;
  grade_short_name: string | null;
  exam_board_short_name: string | null;
}

/**
 * Fetches the primary instrument for all students in the current org.
 * Returns a map of student_id -> instrument info for easy lookup.
 */
export function usePrimaryInstruments() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['primary-instruments', currentOrg?.id],
    queryFn: async (): Promise<Record<string, PrimaryInstrumentInfo>> => {
      const { data, error } = await (supabase as any)
        .from('student_instruments')
        .select(`
          student_id,
          instrument:instruments!student_instruments_instrument_id_fkey(name, category),
          current_grade:grade_levels!student_instruments_current_grade_id_fkey(short_name),
          exam_board:exam_boards!student_instruments_exam_board_id_fkey(short_name)
        `)
        .eq('org_id', currentOrg!.id)
        .eq('is_primary', true);

      if (error) throw error;

      const map: Record<string, PrimaryInstrumentInfo> = {};
      for (const row of (data || []) as any[]) {
        const inst = row.instrument as { name: string; category: string } | null;
        const grade = row.current_grade as { short_name: string } | null;
        const board = row.exam_board as { short_name: string } | null;
        if (inst) {
          map[row.student_id] = {
            student_id: row.student_id,
            instrument_name: inst.name,
            instrument_category: inst.category,
            grade_short_name: grade?.short_name || null,
            exam_board_short_name: board?.short_name || null,
          };
        }
      }
      return map;
    },
    enabled: !!currentOrg,
    staleTime: 30_000,
  });
}
