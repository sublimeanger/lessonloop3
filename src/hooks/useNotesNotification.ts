import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useNotesNotification() {
  const { toast } = useToast();

  const sendNotesNotification = async (params: {
    lessonId: string;
    notesShared: string;
    lessonTitle: string;
    lessonDate: string;
    teacherName: string;
    orgName: string;
    orgId: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-notes-notification', {
        body: params,
      });

      if (error) throw error;

      if (data?.emailsSent > 0) {
        toast({
          title: 'Parents notified',
          description: `${data.emailsSent} guardian(s) will receive an email about the lesson notes.`,
        });
      }

      return data;
    } catch (error: any) {
      console.error('Failed to send notes notification:', error);
      // Don't show error toast - notification is optional
      return null;
    }
  };

  return { sendNotesNotification };
}
