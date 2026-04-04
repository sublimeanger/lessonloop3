import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Check, AlertTriangle, RefreshCw, Unplug, FileText, Users, CreditCard, Loader2 } from 'lucide-react';

// ─── Xero Logo Badge ───
function XeroBadge() {
  return (
    <span className="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-bold tracking-wide" style={{ backgroundColor: '#13B5EA', color: '#fff' }}>
      xero
    </span>
  );
}

// ─── Disconnected State ───
function DisconnectedState({ orgId }: { orgId: string }) {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Please sign in first'); return; }

      const { data, error } = await supabase.functions.invoke('xero-oauth-start', {
        body: { org_id: orgId, redirect_uri: window.location.href },
      });

      if (error || !data?.auth_url) {
        toast.error(data?.message || 'Failed to start Xero connection');
        return;
      }

      window.location.href = data.auth_url;
    } catch {
      toast.error('Failed to start Xero connection');
    } finally {
      setConnecting(false);
    }
  };

  const features = [
    'Invoices pushed to Xero when created',
    'Payments recorded automatically',
    'Contacts created from your parent records',
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <XeroBadge />
        </div>
        <CardTitle>Connect to Xero</CardTitle>
        <CardDescription>
          Automatically sync your invoices and payments to Xero. Keep your accounting up to date without manual data entry.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <Button onClick={handleConnect} disabled={connecting}>
          {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Connect Xero
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Connected State ───
function ConnectedState({
  connection,
  syncStats,
}: {
  connection: {
    id: string;
    org_id: string;
    tenant_name: string | null;
    last_sync_at: string | null;
    auto_sync_invoices: boolean;
    auto_sync_payments: boolean;
    sync_status: string;
    error_message: string | null;
  };
  syncStats: Record<string, number>;
}) {
  const queryClient = useQueryClient();
  const [autoInvoices, setAutoInvoices] = useState(connection.auto_sync_invoices);
  const [autoPayments, setAutoPayments] = useState(connection.auto_sync_payments);

  const updateToggle = useMutation({
    mutationFn: async (patch: { auto_sync_invoices?: boolean; auto_sync_payments?: boolean }) => {
      const { error } = await supabase
        .from('xero_connections')
        .update(patch)
        .eq('id', connection.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xero-connection'] });
      toast.success('Setting updated');
    },
    onError: () => toast.error('Failed to update setting'),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('xero-disconnect', {
        body: { org_id: connection.org_id },
      });
      if (error || !data?.success) throw new Error('Disconnect failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xero-connection'] });
      queryClient.invalidateQueries({ queryKey: ['xero-sync-stats'] });
      toast.success('Xero disconnected');
    },
    onError: () => toast.error('Failed to disconnect Xero'),
  });

  const [syncing, setSyncing] = useState(false);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      // Get invoices without xero mapping
      const { data: mappedIds } = await supabase
        .from('xero_entity_mappings')
        .select('local_id')
        .eq('org_id', connection.org_id)
        .eq('entity_type', 'invoice');

      const mappedSet = new Set((mappedIds ?? []).map((m) => m.local_id));

      const { data: invoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('org_id', connection.org_id);

      const unsynced = (invoices ?? []).filter((inv) => !mappedSet.has(inv.id));

      if (unsynced.length === 0) {
        toast.info('All invoices are already synced');
        setSyncing(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const inv of unsynced) {
        try {
          const { error } = await supabase.functions.invoke('xero-sync-invoice', {
            body: { invoice_id: inv.id, org_id: connection.org_id },
          });
          if (error) errorCount++;
          else successCount++;
        } catch {
          errorCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['xero-sync-stats'] });

      if (errorCount === 0) {
        toast.success(`Synced ${successCount} invoice${successCount !== 1 ? 's' : ''}`);
      } else {
        toast.warning(`Synced ${successCount}, failed ${errorCount}`);
      }
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleReconnect = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error('Please sign in first'); return; }

    const { data, error } = await supabase.functions.invoke('xero-oauth-start', {
      body: { org_id: connection.org_id, redirect_uri: window.location.href },
    });
    if (error || !data?.auth_url) {
      toast.error('Failed to start reconnection');
      return;
    }
    window.location.href = data.auth_url;
  };

  const statItems = [
    { label: 'Invoices', count: syncStats['invoice'] ?? 0, icon: FileText },
    { label: 'Contacts', count: syncStats['contact'] ?? 0, icon: Users },
    { label: 'Payments', count: syncStats['payment'] ?? 0, icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      {/* Connection status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <XeroBadge />
              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
                <Check className="h-3 w-3 mr-1" /> Connected
              </Badge>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Unplug className="h-4 w-4 mr-1.5" /> Disconnect
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Xero?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the Xero connection and stop all automatic syncing. Existing synced data in Xero will not be affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => disconnect.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {connection.tenant_name && (
            <CardDescription>Connected to <span className="font-medium text-foreground">{connection.tenant_name}</span></CardDescription>
          )}
          {connection.last_sync_at && (
            <p className="text-xs text-muted-foreground">
              Last synced {formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true })}
            </p>
          )}
        </CardHeader>
      </Card>

      {/* Error state */}
      {connection.sync_status === 'error' && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Sync error</p>
                {connection.error_message && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">{connection.error_message}</p>
                )}
                <Button size="sm" variant="outline" onClick={handleReconnect}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reconnect
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-invoices" className="flex flex-col gap-0.5">
              <span>Auto-sync invoices</span>
              <span className="text-xs text-muted-foreground font-normal">Push new invoices to Xero automatically</span>
            </Label>
            <Switch
              id="auto-invoices"
              checked={autoInvoices}
              onCheckedChange={(v) => {
                setAutoInvoices(v);
                updateToggle.mutate({ auto_sync_invoices: v });
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-payments" className="flex flex-col gap-0.5">
              <span>Auto-sync payments</span>
              <span className="text-xs text-muted-foreground font-normal">Record payments in Xero when marked as paid</span>
            </Label>
            <Switch
              id="auto-payments"
              checked={autoPayments}
              onCheckedChange={(v) => {
                setAutoPayments(v);
                updateToggle.mutate({ auto_sync_payments: v });
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sync stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {statItems.map(({ label, count, icon: Icon }) => (
              <div key={label} className="text-center space-y-1">
                <Icon className="h-5 w-5 mx-auto text-muted-foreground" />
                <p className="text-2xl font-semibold">{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
              Sync All Invoices
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Tab ───
export function AccountingTab() {
  const { currentOrg } = useOrg();
  const orgId = currentOrg?.id;
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle OAuth callback params
  useEffect(() => {
    if (searchParams.get('xero_connected') === 'true') {
      toast.success('Xero connected successfully');
      searchParams.delete('xero_connected');
      setSearchParams(searchParams, { replace: true });
    }
    const xeroError = searchParams.get('xero_error');
    if (xeroError) {
      toast.error(`Xero connection failed: ${decodeURIComponent(xeroError)}`);
      searchParams.delete('xero_error');
      setSearchParams(searchParams, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: connection, isLoading } = useQuery({
    queryKey: ['xero-connection', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data } = await supabase
        .from('xero_connections')
        .select('id, org_id, tenant_name, last_sync_at, auto_sync_invoices, auto_sync_payments, sync_status, error_message')
        .eq('org_id', orgId)
        .maybeSingle();
      return data;
    },
    enabled: !!orgId,
  });

  const { data: syncStats = {} } = useQuery({
    queryKey: ['xero-sync-stats', orgId],
    queryFn: async () => {
      if (!orgId) return {};
      const { data } = await supabase
        .from('xero_entity_mappings')
        .select('entity_type')
        .eq('org_id', orgId);

      const counts: Record<string, number> = {};
      (data ?? []).forEach((row) => {
        counts[row.entity_type] = (counts[row.entity_type] ?? 0) + 1;
      });
      return counts;
    },
    enabled: !!orgId && !!connection,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orgId) return null;

  if (connection) {
    return <ConnectedState connection={connection} syncStats={syncStats} />;
  }

  return <DisconnectedState orgId={orgId} />;
}
