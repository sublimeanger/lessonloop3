import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Term {
  id: string;
  org_id: string;
  name: string;
  start_date: string;
  end_date: string;
  created_at: string;
  created_by: string;
}

export function useTerms() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['terms', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      const { data, error } = await supabase
        .from('terms')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return data as Term[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useCurrentTerm() {
  const { data: terms = [] } = useTerms();
  const today = new Date().toISOString().split('T')[0];
  return terms.find((t) => t.start_date <= today && t.end_date >= today) || null;
}

export function useCreateTerm() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { name: string; start_date: string; end_date: string }) => {
      if (!currentOrg?.id || !user?.id) throw new Error('No org or user');

      const { data: term, error } = await supabase
        .from('terms')
        .insert({
          org_id: currentOrg.id,
          name: data.name,
          start_date: data.start_date,
          end_date: data.end_date,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return term;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms'] });
      toast.success('Term created');
    },
    onError: (error) => {
      toast.error('Failed to create term: ' + error.message);
    },
  });
}

export function useUpdateTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; name: string; start_date: string; end_date: string }) => {
      const { error } = await supabase
        .from('terms')
        .update({
          name: data.name,
          start_date: data.start_date,
          end_date: data.end_date,
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms'] });
      toast.success('Term updated');
    },
    onError: (error) => {
      toast.error('Failed to update term: ' + error.message);
    },
  });
}

export function useDeleteTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('terms').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms'] });
      toast.success('Term deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete term: ' + error.message);
    },
  });
}
