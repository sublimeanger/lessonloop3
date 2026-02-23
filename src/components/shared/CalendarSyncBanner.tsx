import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

/**
 * Shows a subtle warning banner when calendar sync connections need attention.
 * Only visible to admin/owner roles.
 */
export function CalendarSyncBanner() {
  const { currentOrg, currentRole } = useOrg();
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  const { data: errorCount = 0 } = useQuery({
    queryKey: ['calendar-error-count', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return 0;
      const { data, error } = await supabase.rpc('get_calendar_error_count', {
        p_org_id: currentOrg.id,
      });
      if (error) return 0;
      return (data as number) || 0;
    },
    enabled: !!currentOrg && isAdmin,
    staleTime: 10 * 60 * 1000,
  });

  if (!isAdmin || errorCount === 0) return null;

  return (
    <Alert variant="default" className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        {errorCount} calendar sync connection{errorCount > 1 ? 's' : ''} need{errorCount === 1 ? 's' : ''} attention.{' '}
        <Link to="/settings?tab=calendar" className="underline font-medium">
          View details
        </Link>
      </AlertDescription>
    </Alert>
  );
}
