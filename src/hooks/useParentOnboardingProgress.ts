import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { safeGetItem } from '@/lib/storage';

export interface ParentOnboardingStatus {
  hasProfile: boolean;
  hasVisitedSchedule: boolean;
  hasPracticed: boolean;
  hasSentMessage: boolean;
  hasViewedInvoices: boolean;
}

export function useParentOnboardingProgress() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ['parent-onboarding-progress', userId],
    queryFn: async (): Promise<ParentOnboardingStatus> => {
      if (!userId) {
        return {
          hasProfile: false,
          hasVisitedSchedule: false,
          hasPracticed: false,
          hasSentMessage: false,
          hasViewedInvoices: false,
        };
      }

      // Check profile completeness (has phone number)
      const { data: guardian } = await supabase
        .from('guardians')
        .select('phone')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .maybeSingle();

      const hasProfile = !!(guardian?.phone);

      // Check localStorage flags
      const hasVisitedSchedule = safeGetItem(`ll-parent-visited-schedule-${userId}`) === 'true';
      const hasViewedInvoices = safeGetItem(`ll-parent-visited-invoices-${userId}`) === 'true';

      // Check practice sessions
      const { count: practiceCount } = await supabase
        .from('practice_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .limit(1);

      const hasPracticed = (practiceCount ?? 0) > 0;

      // Check messages
      const { count: messageCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', userId)
        .limit(1);

      const hasSentMessage = (messageCount ?? 0) > 0;

      return {
        hasProfile,
        hasVisitedSchedule,
        hasPracticed,
        hasSentMessage,
        hasViewedInvoices,
      };
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
