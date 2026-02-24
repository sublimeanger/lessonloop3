import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';

export interface Instrument {
  id: string;
  name: string;
  category: string;
  sort_order: number;
  is_custom: boolean;
  org_id: string | null;
}

export interface ExamBoard {
  id: string;
  name: string;
  short_name: string;
  country_code: string;
  sort_order: number;
}

export interface GradeLevel {
  id: string;
  exam_board_id: string | null;
  name: string;
  short_name: string;
  sort_order: number;
  is_diploma: boolean;
  description: string | null;
}

export function useInstruments() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['instruments', currentOrg?.id],
    queryFn: async (): Promise<Instrument[]> => {
      const { data, error } = await supabase
        .from('instruments')
        .select('*')
        .or(`org_id.is.null,org_id.eq.${currentOrg!.id}`)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as Instrument[];
    },
    enabled: !!currentOrg,
    staleTime: 5 * 60_000, // Reference data — cache 5 minutes
  });
}

export function useExamBoards() {
  return useQuery({
    queryKey: ['exam-boards'],
    queryFn: async (): Promise<ExamBoard[]> => {
      const { data, error } = await supabase
        .from('exam_boards')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data || []) as ExamBoard[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useGradeLevels() {
  return useQuery({
    queryKey: ['grade-levels'],
    queryFn: async (): Promise<GradeLevel[]> => {
      const { data, error } = await supabase
        .from('grade_levels')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data || []) as GradeLevel[];
    },
    staleTime: 5 * 60_000,
  });
}

/** Get grade levels for a specific exam board (plus universal levels) */
export function getGradesForBoard(
  allGrades: GradeLevel[],
  examBoardId: string | null,
): GradeLevel[] {
  if (!examBoardId) {
    // No exam board selected — only show universal levels
    return allGrades.filter((g) => g.exam_board_id === null);
  }
  // Show universal levels + the selected board's levels
  return allGrades.filter(
    (g) => g.exam_board_id === null || g.exam_board_id === examBoardId,
  );
}

/** Group instruments by category for display */
export function groupInstrumentsByCategory(
  instruments: Instrument[],
): Record<string, Instrument[]> {
  const groups: Record<string, Instrument[]> = {};
  for (const inst of instruments) {
    const cat = inst.is_custom ? 'Custom' : inst.category;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(inst);
  }
  return groups;
}

/** Get an emoji for an instrument category */
export function getInstrumentCategoryIcon(category: string): string {
  switch (category) {
    case 'Keyboard': return '\u{1F3B9}';
    case 'Strings': return '\u{1F3BB}';
    case 'Guitar': return '\u{1F3B8}';
    case 'Brass': return '\u{1F3BA}';
    case 'Woodwind': return '\u{1F3B5}';
    case 'Percussion': return '\u{1F941}';
    case 'Voice': return '\u{1F3A4}';
    default: return '\u{1F3B5}';
  }
}

/** Standard instrument categories for the category selector */
export const INSTRUMENT_CATEGORIES = [
  'Keyboard', 'Strings', 'Guitar', 'Woodwind', 'Brass', 'Percussion', 'Voice', 'Other',
] as const;

// ─── Custom Instrument Mutations ───────────────────────────────

export function useAddCustomInstrument() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; category: string }) => {
      const { data: result, error } = await supabase
        .from('instruments')
        .insert({
          name: data.name.trim(),
          category: data.category,
          sort_order: 9000, // custom instruments sort after built-ins
          is_custom: true,
          org_id: currentOrg!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instruments'] });
      toast({ title: 'Custom instrument added' });
    },
    onError: (error: Error) => {
      const msg = error.message.includes('duplicate')
        ? 'An instrument with this name already exists'
        : error.message;
      toast({ title: 'Error adding instrument', description: msg, variant: 'destructive' });
    },
  });
}

export function useUpdateCustomInstrument() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, category }: { id: string; name: string; category: string }) => {
      const { error } = await supabase
        .from('instruments')
        .update({ name: name.trim(), category })
        .eq('id', id)
        .eq('org_id', currentOrg!.id)
        .eq('is_custom', true);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instruments'] });
      toast({ title: 'Instrument updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating instrument', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteCustomInstrument() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('instruments')
        .delete()
        .eq('id', id)
        .eq('org_id', currentOrg!.id)
        .eq('is_custom', true);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instruments'] });
      toast({ title: 'Instrument removed' });
    },
    onError: (error: Error) => {
      const msg = error.message.includes('violates foreign key')
        ? 'Cannot delete — this instrument is assigned to students. Remove it from all students first.'
        : error.message;
      toast({ title: 'Error removing instrument', description: msg, variant: 'destructive' });
    },
  });
}
