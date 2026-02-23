import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';

export function CalendarSyncBanner() {
  const { currentOrg, isOrgAdmin } = useOrg();

  const { data: errorCount } = useQuery({
    queryKey: ['calendar-sync-errors', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return 0;
      const { data, error } = await supabase.rpc('get_org_sync_error_count', {
        p_org_id: currentOrg.id,
      });
      if (error) return 0;
      return (data as number) || 0;
    },
    enabled: !!currentOrg && isOrgAdmin,
    staleTime: 5 * 60 * 1000,
  });

  if (!errorCount || errorCount === 0) return null;

  return (
    <Alert className="border-warning/30 bg-warning/10">
      <AlertCircle className="h-4 w-4 text-warning" />
      <AlertDescription className="text-body">
        {errorCount} calendar sync connection{errorCount > 1 ? 's' : ''} need{errorCount === 1 ? 's' : ''} attention.
        <Link to="/settings?tab=calendar" className="underline ml-1 font-medium">
          View details
        </Link>
      </AlertDescription>
    </Alert>
  );
}
