import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';

export interface StudentInstrumentRow {
  id: string;
  student_id: string;
  org_id: string;
  instrument_id: string;
  exam_board_id: string | null;
  current_grade_id: string | null;
  target_grade_id: string | null;
  is_primary: boolean;
  started_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  instrument: { id: string; name: string; category: string } | null;
  exam_board: { id: string; short_name: string; name: string } | null;
  current_grade: { id: string; name: string; short_name: string; sort_order: number } | null;
  target_grade: { id: string; name: string; short_name: string; sort_order: number } | null;
}

export function useStudentInstruments(studentId: string | undefined) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['student-instruments', studentId, currentOrg?.id],
    queryFn: async (): Promise<StudentInstrumentRow[]> => {
      const { data, error } = await (supabase as any)
        .from('student_instruments')
        .select(`
          *,
          instrument:instruments!student_instruments_instrument_id_fkey(id, name, category),
          exam_board:exam_boards!student_instruments_exam_board_id_fkey(id, short_name, name),
          current_grade:grade_levels!student_instruments_current_grade_id_fkey(id, name, short_name, sort_order),
          target_grade:grade_levels!student_instruments_target_grade_id_fkey(id, name, short_name, sort_order)
        `)
        .eq('student_id', studentId!)
        .eq('org_id', currentOrg!.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as StudentInstrumentRow[];
    },
    enabled: !!studentId && !!currentOrg,
    staleTime: 30_000,
  });
}

export interface AddStudentInstrumentData {
  student_id: string;
  instrument_id: string;
  exam_board_id: string | null;
  current_grade_id: string | null;
  target_grade_id: string | null;
  is_primary: boolean;
}

export function useAddStudentInstrument() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddStudentInstrumentData) => {
      // If marking as primary, un-primary the others first
      if (data.is_primary) {
        await (supabase as any)
          .from('student_instruments')
          .update({ is_primary: false })
          .eq('student_id', data.student_id)
          .eq('org_id', currentOrg!.id);
      }

      const { data: result, error } = await (supabase as any)
        .from('student_instruments')
        .insert({
          student_id: data.student_id,
          org_id: currentOrg!.id,
          instrument_id: data.instrument_id,
          exam_board_id: data.exam_board_id || null,
          current_grade_id: data.current_grade_id || null,
          target_grade_id: data.target_grade_id || null,
          is_primary: data.is_primary,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['student-instruments', variables.student_id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({ title: 'Instrument added' });
    },
    onError: (error: Error) => {
      const msg = error.message.includes('unique')
        ? 'This student already has this instrument assigned'
        : error.message;
      toast({ title: 'Error adding instrument', description: msg, variant: 'destructive' });
    },
  });
}

export function useUpdateStudentInstrument() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      student_id,
      ...updates
    }: {
      id: string;
      student_id: string;
      exam_board_id?: string | null;
      current_grade_id?: string | null;
      target_grade_id?: string | null;
      is_primary?: boolean;
      notes?: string | null;
    }) => {
      // If marking as primary, un-primary the others first
      if (updates.is_primary) {
        await (supabase as any)
          .from('student_instruments')
          .update({ is_primary: false })
          .eq('student_id', student_id)
          .eq('org_id', currentOrg!.id)
          .neq('id', id);
      }

      const { error } = await (supabase as any)
        .from('student_instruments')
        .update(updates)
        .eq('id', id)
        .eq('org_id', currentOrg!.id);

      if (error) throw error;
      return { id, student_id };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['student-instruments', variables.student_id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating instrument', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRemoveStudentInstrument() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, student_id }: { id: string; student_id: string }) => {
      const { error } = await (supabase as any)
        .from('student_instruments')
        .delete()
        .eq('id', id)
        .eq('org_id', currentOrg!.id);

      if (error) throw error;
      return { id, student_id };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['student-instruments', variables.student_id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({ title: 'Instrument removed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error removing instrument', description: error.message, variant: 'destructive' });
    },
  });
}
