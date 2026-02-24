import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { logger } from '@/lib/logger';

export interface GradeChangeRecord {
  id: string;
  student_instrument_id: string;
  old_grade_id: string | null;
  new_grade_id: string;
  changed_by: string;
  changed_at: string;
  reason: string | null;
  old_grade: { name: string; short_name: string } | null;
  new_grade: { name: string; short_name: string } | null;
  changed_by_profile: { full_name: string } | null;
}

/**
 * Fetches grade change history for a specific student instrument.
 */
export function useGradeChangeHistory(studentInstrumentId: string | undefined) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['grade-change-history', studentInstrumentId, currentOrg?.id],
    queryFn: async (): Promise<GradeChangeRecord[]> => {
      const { data, error } = await supabase
        .from('grade_change_history')
        .select(`
          id,
          student_instrument_id,
          old_grade_id,
          new_grade_id,
          changed_by,
          changed_at,
          reason,
          old_grade:grade_levels!grade_change_history_old_grade_id_fkey(name, short_name),
          new_grade:grade_levels!grade_change_history_new_grade_id_fkey(name, short_name),
          changed_by_profile:profiles!grade_change_history_changed_by_fkey(full_name)
        `)
        .eq('student_instrument_id', studentInstrumentId!)
        .eq('org_id', currentOrg!.id)
        .order('changed_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as GradeChangeRecord[];
    },
    enabled: !!studentInstrumentId && !!currentOrg,
    staleTime: 30_000,
  });
}

/**
 * Records a grade change in the history table.
 * Called internally by useUpdateStudentInstrument when current_grade_id changes.
 */
export async function recordGradeChange({
  orgId,
  studentId,
  studentInstrumentId,
  oldGradeId,
  newGradeId,
  changedBy,
  reason,
}: {
  orgId: string;
  studentId: string;
  studentInstrumentId: string;
  oldGradeId: string | null;
  newGradeId: string;
  changedBy: string;
  reason?: string;
}) {
  const { error } = await supabase
    .from('grade_change_history')
    .insert({
      org_id: orgId,
      student_id: studentId,
      student_instrument_id: studentInstrumentId,
      old_grade_id: oldGradeId,
      new_grade_id: newGradeId,
      changed_by: changedBy,
      reason: reason || null,
    });

  if (error) {
    logger.error('Failed to record grade change:', error);
    // Don't throw — grade change history is non-critical
  }
}
