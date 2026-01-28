import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

export interface ProactiveAlert {
  type: 'overdue' | 'cancellation' | 'upcoming' | 'unmarked';
  severity: 'info' | 'warning' | 'urgent';
  message: string;
  suggestedAction?: string;
  count?: number;
}

export function useProactiveAlerts() {
  const { currentOrg } = useOrg();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['proactive-alerts', currentOrg?.id],
    queryFn: async (): Promise<ProactiveAlert[]> => {
      if (!currentOrg?.id) return [];

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const weekAgoStr = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const alerts: ProactiveAlert[] = [];

      // Check overdue invoices
      const { data: overdueInvoices, count: overdueCount } = await supabase
        .from('invoices')
        .select('id, due_date', { count: 'exact' })
        .eq('org_id', currentOrg.id)
        .eq('status', 'overdue')
        .limit(1);

      if (overdueCount && overdueCount > 0) {
        // Check for critical (30+ days overdue)
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const { count: criticalCount } = await supabase
          .from('invoices')
          .select('id', { count: 'exact' })
          .eq('org_id', currentOrg.id)
          .eq('status', 'overdue')
          .lt('due_date', thirtyDaysAgo);

        alerts.push({
          type: 'overdue',
          severity: (criticalCount && criticalCount > 0) ? 'urgent' : 'warning',
          message: `${overdueCount} invoice${overdueCount > 1 ? 's are' : ' is'} overdue`,
          suggestedAction: 'Send payment reminders',
          count: overdueCount,
        });
      }

      // Check unmarked past lessons
      const { count: unmarkedCount } = await supabase
        .from('lessons')
        .select('id', { count: 'exact' })
        .eq('org_id', currentOrg.id)
        .eq('status', 'scheduled')
        .lt('start_at', `${todayStr}T00:00:00`)
        .gte('start_at', `${weekAgoStr}T00:00:00`);

      if (unmarkedCount && unmarkedCount > 0) {
        alerts.push({
          type: 'unmarked',
          severity: 'warning',
          message: `${unmarkedCount} past lesson${unmarkedCount > 1 ? 's need' : ' needs'} marking`,
          suggestedAction: 'Mark lessons as complete',
          count: unmarkedCount,
        });
      }

      // Check recent cancellations without rescheduling
      const { count: cancellationCount } = await supabase
        .from('lessons')
        .select('id', { count: 'exact' })
        .eq('org_id', currentOrg.id)
        .eq('status', 'cancelled')
        .gte('start_at', `${weekAgoStr}T00:00:00`);

      if (cancellationCount && cancellationCount > 0) {
        alerts.push({
          type: 'cancellation',
          severity: 'info',
          message: `${cancellationCount} lesson${cancellationCount > 1 ? 's were' : ' was'} cancelled this week`,
          suggestedAction: 'Review and reschedule if needed',
          count: cancellationCount,
        });
      }

      // Check upcoming lessons today
      const { count: upcomingCount } = await supabase
        .from('lessons')
        .select('id', { count: 'exact' })
        .eq('org_id', currentOrg.id)
        .eq('status', 'scheduled')
        .gte('start_at', `${todayStr}T00:00:00`)
        .lte('start_at', `${todayStr}T23:59:59`);

      if (upcomingCount && upcomingCount > 0) {
        alerts.push({
          type: 'upcoming',
          severity: 'info',
          message: `${upcomingCount} lesson${upcomingCount > 1 ? 's' : ''} scheduled for today`,
          count: upcomingCount,
        });
      }

      return alerts;
    },
    enabled: !!currentOrg?.id,
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });

  const criticalCount = alerts.filter(a => a.severity === 'urgent').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;
  const totalActionable = criticalCount + warningCount;

  return {
    alerts,
    isLoading,
    criticalCount,
    warningCount,
    totalActionable,
    hasCritical: criticalCount > 0,
  };
}
