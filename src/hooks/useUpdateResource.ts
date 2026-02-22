import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useUpdateResource() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      title,
      description,
    }: {
      id: string;
      title: string;
      description: string | null;
    }) => {
      const { data, error } = await supabase
        .from('resources')
        .update({ title, description })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast({
        title: 'Resource updated',
        description: 'Title and description have been saved.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRemoveResourceShare() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      resourceId,
      studentId,
    }: {
      resourceId: string;
      studentId: string;
    }) => {
      const { error } = await supabase
        .from('resource_shares')
        .delete()
        .eq('resource_id', resourceId)
        .eq('student_id', studentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast({ title: 'Share removed' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to remove share',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
