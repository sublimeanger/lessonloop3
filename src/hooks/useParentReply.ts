import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useParentReply() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ parentMessageId, body }: { parentMessageId: string; body: string }) => {
      if (!currentOrg || !user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('send-parent-reply', {
        body: {
          org_id: currentOrg.id,
          parent_message_id: parentMessageId,
          body,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-messages'] });
      toast({ title: 'Reply sent', description: 'Your reply has been sent.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to send reply', variant: 'destructive' });
    },
  });
}
