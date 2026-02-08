import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface MessageTemplate {
  id: string;
  org_id: string;
  name: string;
  subject: string;
  body: string;
  channel: 'email' | 'inapp';
  created_at: string;
  updated_at: string;
}

export interface MessageLogEntry {
  id: string;
  org_id: string;
  channel: string;
  subject: string;
  body: string;
  sender_user_id: string | null;
  recipient_type: 'guardian' | 'student' | 'teacher' | 'parent' | null;
  recipient_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  related_id: string | null;
  message_type: string;
  status: string;
  sent_at: string | null;
  read_at: string | null;
  error_message: string | null;
  created_at: string;
  // Joined data
  sender?: { full_name: string | null } | null;
  guardian?: { full_name: string; email: string | null } | null;
  student?: { first_name: string; last_name: string } | null;
}

export interface SendMessageData {
  recipient_type: 'guardian' | 'student' | 'teacher';
  recipient_id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body: string;
  related_id?: string; // e.g., student_id for context
  message_type?: string;
}

// Fetch message templates for the org
export function useMessageTemplates() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['message-templates', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];

      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('name');

      if (error) throw error;
      return data as MessageTemplate[];
    },
    enabled: !!currentOrg,
  });
}

// Fetch message log with filters
export function useMessageLog(filters?: {
  studentId?: string;
  guardianId?: string;
  recipientType?: string;
  channel?: string;
}) {
  const { currentOrg } = useOrg();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['message-log', currentOrg?.id, filters],
    queryFn: async () => {
      if (!currentOrg || !user) return [];

      let query = supabase
        .from('message_log')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (filters?.guardianId) {
        query = query.eq('recipient_id', filters.guardianId);
      }
      if (filters?.recipientType) {
        query = query.eq('recipient_type', filters.recipientType);
      }
      if (filters?.channel) {
        query = query.eq('channel', filters.channel);
      }
      if (filters?.studentId) {
        query = query.eq('related_id', filters.studentId);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;

      return (data || []) as unknown as MessageLogEntry[];
    },
    enabled: !!currentOrg && !!user,
  });
}

// Fetch messages for a specific student (all guardians)
export function useStudentMessages(studentId: string | undefined) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['student-messages', currentOrg?.id, studentId],
    queryFn: async () => {
      if (!currentOrg || !studentId) return [];

      const { data, error } = await supabase
        .from('message_log')
        .select('*')
        .eq('org_id', currentOrg.id)
        .eq('related_id', studentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as MessageLogEntry[];
    },
    enabled: !!currentOrg && !!studentId,
  });
}

// Fetch messages for parent portal
export function useParentMessages() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['parent-messages', currentOrg?.id, user?.id],
    queryFn: async () => {
      if (!currentOrg || !user) return [];

      // Get guardian ID for current user
      const { data: guardian } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user.id)
        .eq('org_id', currentOrg.id)
        .maybeSingle();

      if (!guardian) return [];

      const { data, error } = await supabase
        .from('message_log')
        .select('*')
        .eq('org_id', currentOrg.id)
        .eq('recipient_id', guardian.id)
        .eq('recipient_type', 'guardian')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as MessageLogEntry[];
    },
    enabled: !!currentOrg && !!user,
  });
}

// Send a message via edge function
export function useSendMessage() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: SendMessageData) => {
      if (!currentOrg || !user) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('send-message', {
        body: {
          org_id: currentOrg.id,
          sender_user_id: user.id,
          ...data,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-log'] });
      queryClient.invalidateQueries({ queryKey: ['student-messages'] });
      toast({ title: 'Message sent', description: 'Your message has been sent successfully.' });
    },
    onError: (error) => {
      toast({ title: 'Error sending message', description: error.message, variant: 'destructive' });
    },
  });
}

// Create/update message template
export function useCreateMessageTemplate() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { name: string; subject: string; body: string; channel?: 'email' | 'inapp' }) => {
      if (!currentOrg) throw new Error('No org selected');

      const { error } = await supabase.from('message_templates').insert({
        org_id: currentOrg.id,
        name: data.name,
        subject: data.subject,
        body: data.body,
        channel: data.channel || 'email',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({ title: 'Template created' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteMessageTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({ title: 'Template deleted' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}
