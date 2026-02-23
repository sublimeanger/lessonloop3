import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, MinusCircle, Activity } from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface ConnectionHealth {
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

type SyncHealthStatus = 'healthy' | 'stale' | 'error' | 'disabled';

function getStatus(c: ConnectionHealth): SyncHealthStatus {
  if (!c.sync_enabled) return 'disabled';
  if (c.sync_status === 'error') return 'error';
  if (c.token_expires_at && new Date(c.token_expires_at) < new Date()) return 'error';
  if (c.last_sync_at) {
    const age = Date.now() - new Date(c.last_sync_at).getTime();
    if (age > 6 * 60 * 60 * 1000) return 'error';
    if (age > 2 * 60 * 60 * 1000) return 'stale';
  }
  return 'healthy';
}

const statusConfig: Record<SyncHealthStatus, { icon: typeof CheckCircle2; label: string; className: string }> = {
  healthy: { icon: CheckCircle2, label: 'Active', className: 'text-emerald-600 bg-emerald-50' },
  stale: { icon: AlertTriangle, label: 'Stale', className: 'text-amber-600 bg-amber-50' },
  error: { icon: XCircle, label: 'Needs Re-auth', className: 'text-destructive bg-destructive/10' },
  disabled: { icon: MinusCircle, label: 'Disabled', className: 'text-muted-foreground bg-muted' },
};

export function CalendarSyncHealth() {
  const { currentOrg } = useOrg();

  const { data: connections, isLoading } = useQuery({
    queryKey: ['calendar-sync-health', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase.rpc('get_org_calendar_health', {
        p_org_id: currentOrg.id,
      });
      if (error) throw error;
      return (data || []) as ConnectionHealth[];
    },
    enabled: !!currentOrg,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!connections || connections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sync Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No calendar connections found across your organisation.</p>
        </CardContent>
      </Card>
    );
  }

  const statuses = connections.map(getStatus);
  const connected = connections.length;
  const healthy = statuses.filter(s => s === 'healthy').length;
  const needsAttention = statuses.filter(s => s === 'stale' || s === 'error').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Sync Health — All Teachers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold">{connected}</p>
            <p className="text-xs text-muted-foreground">Connected</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{healthy}</p>
            <p className="text-xs text-muted-foreground">Healthy</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className={`text-2xl font-bold ${needsAttention > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {needsAttention}
            </p>
            <p className="text-xs text-muted-foreground">Need Attention</p>
          </div>
        </div>

        {/* Connection table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Teacher</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead className="hidden sm:table-cell">Calendar</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Last Synced</TableHead>
              <TableHead className="hidden md:table-cell text-right">Events</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {connections.map((c, i) => {
              const status = statuses[i];
              const cfg = statusConfig[status];
              const Icon = cfg.icon;
              return (
                <TableRow key={c.connection_id}>
                  <TableCell className="font-medium">{c.teacher_name}</TableCell>
                  <TableCell className="capitalize">{c.provider === 'apple' ? 'iCal' : c.provider}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {c.calendar_name || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`gap-1 ${cfg.className}`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {c.last_sync_at
                      ? formatDistanceToNow(new Date(c.last_sync_at), { addSuffix: true })
                      : '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right text-muted-foreground">
                    {c.provider === 'apple' ? '—' : c.events_synced}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
