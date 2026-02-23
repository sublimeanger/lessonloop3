import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook for parents to send general enquiries as conversations (via message_log).
 * Uses the unified send-parent-message edge function.
 */
export function useParentEnquiry() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ subject, body, student_id }: { subject: string; body: string; student_id?: string }) => {
      if (!currentOrg || !user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('send-parent-message', {
        body: {
          org_id: currentOrg.id,
          subject,
          body,
          student_id,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['parent-messages'] });
      toast({ title: 'Message sent', description: 'Your enquiry has been sent. You\'ll see replies in your inbox.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to send message', variant: 'destructive' });
    },
  });
}
