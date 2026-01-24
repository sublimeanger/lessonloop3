import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

export interface PracticeStreak {
  id: string;
  student_id: string;
  org_id: string;
  current_streak: number;
  longest_streak: number;
  last_practice_date: string | null;
  streak_started_at: string | null;
  updated_at: string;
}

export function usePracticeStreak(studentId: string | undefined) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['practice-streak', studentId],
    queryFn: async () => {
      if (!studentId || !currentOrg?.id) return null;

      const { data, error } = await supabase
        .from('practice_streaks')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

      if (error) throw error;
      return data as PracticeStreak | null;
    },
    enabled: !!studentId && !!currentOrg?.id,
  });
}

export function usePracticeStreaks() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['practice-streaks', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      const { data, error } = await supabase
        .from('practice_streaks')
        .select(`
          *,
          students:student_id (
            id,
            first_name,
            last_name
          )
        `)
        .eq('org_id', currentOrg.id)
        .gt('current_streak', 0)
        .order('current_streak', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrg?.id,
  });
}

// Get streaks for children (parent portal) - properly filtered by guardian linkage
export function useChildrenStreaks() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['children-streaks', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      // First get the current user's guardian record and linked students
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get guardian's linked student IDs
      const { data: guardianLinks, error: guardianError } = await supabase
        .from('guardians')
        .select(`
          id,
          student_guardians (
            student_id
          )
        `)
        .eq('user_id', user.id);

      if (guardianError) throw guardianError;
      if (!guardianLinks || guardianLinks.length === 0) return [];

      // Extract student IDs from guardian links
      const studentIds = guardianLinks.flatMap(g => 
        g.student_guardians?.map(sg => sg.student_id) || []
      );

      if (studentIds.length === 0) return [];

      // Now fetch only streaks for these specific students
      const { data, error } = await supabase
        .from('practice_streaks')
        .select(`
          *,
          students:student_id (
            id,
            first_name,
            last_name
          )
        `)
        .eq('org_id', currentOrg.id)
        .in('student_id', studentIds);

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrg?.id,
  });
}
