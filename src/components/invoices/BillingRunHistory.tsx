import { useState } from 'react';
import { format } from 'date-fns';
import { useOrg } from '@/contexts/OrgContext';
import { useBillingRuns, useDeleteBillingRun, type BillingRunWithDetails } from '@/hooks/useBillingRuns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { formatCurrencyMinor } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { Loader2, Trash2, ArrowLeft, FileText, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function useRunInvoices(billingRunId: string | null, orgId: string | undefined) {
  return useQuery({
    queryKey: ['billing-run-invoices', billingRunId],
    queryFn: async () => {
      if (!billingRunId || !orgId) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, status, total_minor, due_date, currency_code, payer_guardian_id, payer_student_id, guardians:payer_guardian_id(full_name), students:payer_student_id(first_name, last_name)')
        .eq('billing_run_id', billingRunId)
        .eq('org_id', orgId)
        .order('invoice_number', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        invoice_number: string;
        status: string;
        total_minor: number;
        due_date: string;
        currency_code: string;
        payer_guardian_id: string | null;
        payer_student_id: string | null;
        guardians: { full_name: string } | null;
        students: { first_name: string; last_name: string } | null;
      }>;
    },
    enabled: !!billingRunId && !!orgId,
  });
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'completed': return <Badge variant="default" className="bg-primary/10 text-primary border-primary/20"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
    case 'partial': return <Badge variant="secondary" className="bg-accent/10 text-accent-foreground border-accent/20"><AlertTriangle className="h-3 w-3 mr-1" />Partial</Badge>;
    case 'failed': return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Failed</Badge>;
    default: return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
  }
};

export function BillingRunHistory() {
  const { currentOrg, currentRole } = useOrg();
  const { data: runs = [], isLoading } = useBillingRuns();
  const deleteMutation = useDeleteBillingRun();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [deleteConfirmRun, setDeleteConfirmRun] = useState<BillingRunWithDetails | null>(null);
  const canDelete = currentRole === 'owner' || currentRole === 'admin';
  const currency = currentOrg?.currency_code || 'GBP';

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;
  const { data: runInvoices = [], isLoading: loadingInvoices } = useRunInvoices(selectedRunId, currentOrg?.id);

  const paidCount = runInvoices.filter((i) => i.status === 'paid').length;
  const hasPaidInvoices = paidCount > 0;

  const handleDelete = async () => {
    if (!deleteConfirmRun) return;
    await deleteMutation.mutateAsync(deleteConfirmRun.id);
    setDeleteConfirmRun(null);
    setSelectedRunId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No billing runs"
        description="Billing runs will appear here after you generate invoices."
      />
    );
  }

  // Detail view
  if (selectedRun) {
    const draftCount = runInvoices.filter((i) => i.status === 'draft').length;
    const sentCount = runInvoices.filter((i) => i.status === 'sent' || i.status === 'overdue').length;
    const totalValue = runInvoices.reduce((s, i) => s + i.total_minor, 0);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="min-h-11 sm:min-h-9" onClick={() => setSelectedRunId(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {selectedRun.run_type === 'term' ? 'Termly' : selectedRun.run_type === 'monthly' ? 'Monthly' : 'Custom'} Billing Run
            </h3>
            <p className="text-sm text-muted-foreground">
              {format(new Date(selectedRun.start_date), 'dd MMM yyyy')} – {format(new Date(selectedRun.end_date), 'dd MMM yyyy')}
              {' · '}Created {format(new Date(selectedRun.created_at), 'dd MMM yyyy HH:mm')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(selectedRun.status)}
            {canDelete && (
              hasPaidInvoices ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="destructive" size="sm" className="min-h-11 sm:min-h-9" disabled>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete Run
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Cannot delete — run contains paid invoices</TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant="destructive"
                  size="sm"
                  className="min-h-11 sm:min-h-9"
                  onClick={() => setDeleteConfirmRun(selectedRun)}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete Run
                </Button>
              )
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Total Value</CardTitle></CardHeader>
            <CardContent><span className="text-xl font-semibold">{formatCurrencyMinor(totalValue, currency)}</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Invoices</CardTitle></CardHeader>
            <CardContent><span className="text-xl font-semibold">{runInvoices.length}</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Paid</CardTitle></CardHeader>
            <CardContent><span className="text-xl font-semibold text-primary">{paidCount}</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Unpaid</CardTitle></CardHeader>
            <CardContent>
              <span className="text-xl font-semibold">
                {draftCount + sentCount}
                {draftCount > 0 && <span className="text-xs text-muted-foreground ml-1">({draftCount} draft)</span>}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Failed payers */}
        {selectedRun.summary?.failedPayers && selectedRun.summary.failedPayers.length > 0 && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive mb-2">
              {selectedRun.summary.failedPayers.length} payer{selectedRun.summary.failedPayers.length !== 1 ? 's' : ''} failed
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {selectedRun.summary.failedPayers.map((fp, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{fp.payerName}</span>
                  <span className="text-muted-foreground text-xs truncate max-w-[200px]">{fp.error}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invoice list */}
        {loadingInvoices ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : runInvoices.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">No invoices in this run</p>
        ) : (
          <div className="rounded-xl border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Invoice</th>
                  <th className="px-4 py-2 font-medium">Payer</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {runInvoices.map((inv) => {
                  const payerName = inv.guardians
                    ? (inv.guardians as any).full_name
                    : inv.students
                      ? `${(inv.students as any).first_name} ${(inv.students as any).last_name}`
                      : '—';
                  return (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-2 font-medium">{inv.invoice_number}</td>
                      <td className="px-4 py-2">{payerName}</td>
                      <td className="px-4 py-2">{formatCurrencyMinor(inv.total_minor, inv.currency_code)}</td>
                      <td className="px-4 py-2">
                        <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'overdue' ? 'destructive' : 'outline'} className="text-xs">
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{format(new Date(inv.due_date), 'dd MMM yyyy')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteConfirmRun} onOpenChange={(open) => !open && setDeleteConfirmRun(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Billing Run</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this billing run and all {runInvoices.length} associated invoice{runInvoices.length !== 1 ? 's' : ''}. Invoices that have been paid cannot be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</>
                ) : (
                  'Delete Run'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-2">
      {runs.map((run) => (
        <button
          key={run.id}
          className="w-full rounded-lg border bg-card p-4 text-left hover:bg-muted/50 transition-colors"
          onClick={() => setSelectedRunId(run.id)}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {run.run_type === 'term' ? 'Termly' : run.run_type === 'monthly' ? 'Monthly' : 'Custom'}
                </span>
                {statusBadge(run.status)}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {format(new Date(run.start_date), 'dd MMM yyyy')} – {format(new Date(run.end_date), 'dd MMM yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span>{run.summary?.invoiceCount ?? 0} invoice{(run.summary?.invoiceCount ?? 0) !== 1 ? 's' : ''}</span>
              <span className="font-medium">{formatCurrencyMinor(run.summary?.totalAmount ?? 0, currency)}</span>
              <span className="text-muted-foreground">{format(new Date(run.created_at), 'dd MMM yyyy')}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
