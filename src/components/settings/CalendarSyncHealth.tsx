import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { formatDistanceToNow } from 'date-fns';
import { Activity, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface CalendarHealth {
  connection_id: string;
  user_id: string;
  teacher_name: string;
  provider: string;
  sync_enabled: boolean;
  sync_status: string;
  last_sync_at: string | null;
  calendar_name: string | null;
  token_expires_at: string | null;
  events_synced: number;
}

type StatusColor = 'green' | 'amber' | 'red' | 'grey';

function getStatusColor(conn: CalendarHealth): StatusColor {
  if (!conn.sync_enabled) return 'grey';
  if (conn.sync_status === 'error') return 'red';
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) return 'red';

  if (!conn.last_sync_at) return 'amber';
  const hoursSinceSync = (Date.now() - new Date(conn.last_sync_at).getTime()) / (1000 * 60 * 60);
  if (hoursSinceSync > 6) return 'red';
  if (hoursSinceSync > 2) return 'amber';
  return 'green';
}

const STATUS_DOT: Record<StatusColor, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  grey: 'bg-gray-400',
};

export function CalendarSyncHealth() {
  const { currentOrg } = useOrg();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['calendar-sync-health', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase.rpc('get_org_calendar_health', {
        p_org_id: currentOrg.id,
      });
      if (error) throw error;
      return (data || []) as CalendarHealth[];
    },
    enabled: !!currentOrg,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sync Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No calendar connections across your team yet.</p>
        </CardContent>
      </Card>
    );
  }

  const healthy = connections.filter(c => getStatusColor(c) === 'green').length;
  const needsAttention = connections.filter(c => ['amber', 'red'].includes(getStatusColor(c))).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Team Sync Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-xl font-bold">{connections.length}</p>
            <p className="text-xs text-muted-foreground">Connected</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-xl font-bold text-green-600">{healthy}</p>
            <p className="text-xs text-muted-foreground">Healthy</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className={`text-xl font-bold ${needsAttention > 0 ? 'text-amber-600' : ''}`}>
              {needsAttention}
            </p>
            <p className="text-xs text-muted-foreground">Need Attention</p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">Teacher</th>
                <th className="py-2 font-medium">Provider</th>
                <th className="py-2 font-medium">Calendar</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Last Synced</th>
                <th className="py-2 font-medium text-right">Events</th>
              </tr>
            </thead>
            <tbody>
              {connections.map(conn => {
                const color = getStatusColor(conn);
                const isExpired = conn.token_expires_at && new Date(conn.token_expires_at) < new Date();
                return (
                  <tr key={conn.connection_id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{conn.teacher_name}</td>
                    <td className="py-2 capitalize">{conn.provider === 'apple' ? 'iCal' : conn.provider}</td>
                    <td className="py-2 text-muted-foreground truncate max-w-[150px]">{conn.calendar_name || '—'}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${STATUS_DOT[color]}`} />
                        {color === 'green' && <span className="text-green-600">Active</span>}
                        {color === 'amber' && <span className="text-amber-600">Stale</span>}
                        {color === 'red' && <span className="text-red-600">Error</span>}
                        {color === 'grey' && <span className="text-gray-500">Disabled</span>}
                        {isExpired && (
                          <Badge variant="destructive" className="text-xs ml-1">Needs Re-auth</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {conn.last_sync_at
                        ? formatDistanceToNow(new Date(conn.last_sync_at), { addSuffix: true })
                        : 'Never'}
                    </td>
                    <td className="py-2 text-right tabular-nums">{conn.events_synced}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
