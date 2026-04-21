import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ContextualHint } from '@/components/shared/ContextualHint';
import { useSearchParams } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useRealtimeInvoices } from '@/hooks/useRealtimeInvoices';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/EmptyState';
import { InvoicesSkeleton } from '@/components/shared/LoadingState';
import { Receipt, Plus, PlayCircle, CreditCard, Download, CalendarClock, History } from 'lucide-react';
import { useDataExport } from '@/hooks/useDataExport';
import { useOrg } from '@/contexts/OrgContext';
import { useInvoices, useInvoiceStats, useUpdateInvoiceStatus, type InvoiceFilters, type InvoiceWithDetails } from '@/hooks/useInvoices';
import { InvoiceFiltersBar } from '@/components/invoices/InvoiceFiltersBar';
import { InvoiceStatsWidget } from '@/components/invoices/InvoiceStatsWidget';
import { PaymentPlansDashboard } from '@/components/invoices/PaymentPlansDashboard';
import { InvoiceList } from '@/components/invoices/InvoiceList';
import { BulkActionsBar } from '@/components/invoices/BulkActionsBar';
import { CreateInvoiceModal } from '@/components/invoices/CreateInvoiceModal';
import { BillingRunWizard } from '@/components/invoices/BillingRunWizard';
import { RecordPaymentModal } from '@/components/invoices/RecordPaymentModal';
import { EditInvoiceModal } from '@/components/invoices/EditInvoiceModal';
import { SendInvoiceModal } from '@/components/invoices/SendInvoiceModal';
import { LoadingState } from '@/components/shared/LoadingState';
import { RecurringBillingTab } from '@/components/settings/RecurringBillingTab';
import { BillingRunHistory } from '@/components/invoices/BillingRunHistory';
import { useToast } from '@/hooks/use-toast';

import { LoopAssistPageBanner } from '@/components/shared/LoopAssistPageBanner';
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

export default function Invoices() {
  usePageMeta('Invoices | LessonLoop', 'Manage invoices and billing');
  const { currentRole, currentOrg } = useOrg();
  const { toast } = useToast();
  useRealtimeInvoices();
  const { exportInvoices } = useDataExport();
  const isParent = currentRole === 'parent';
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial filters & tab from URL
  const initialStatus = searchParams.get('status');
  const initialDuePast = searchParams.get('due') === 'past';
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') ?? 'invoices');

  const [filters, setFilters] = useState<InvoiceFilters>(() => ({
    ...(initialStatus && initialStatus !== 'all' ? { status: initialStatus as any } : {}),
    ...(initialDuePast ? { dueDateTo: new Date().toISOString().slice(0, 10) } : {}),
  }));
  const [currentPage, setCurrentPage] = useState(1);
  const { data: invoiceResult, isLoading, isError, refetch } = useInvoices({ ...filters, page: currentPage });
  const invoices = invoiceResult?.data ?? [];
  const totalCount = invoiceResult?.totalCount ?? 0;

  const handleFiltersChange = (newFilters: InvoiceFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
    // Sync URL
    const newParams = new URLSearchParams();
    if (newFilters.status && newFilters.status !== 'all') {
      newParams.set('status', newFilters.status);
    }
    if (activeTab !== 'invoices') {
      newParams.set('tab', activeTab);
    }
    setSearchParams(newParams, { replace: true });
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const newParams = new URLSearchParams();
    if (tab !== 'invoices') {
      newParams.set('tab', tab);
    }
    if (filters.status && filters.status !== 'all') {
      newParams.set('status', filters.status as string);
    }
    setSearchParams(newParams, { replace: true });
  };
  const updateStatus = useUpdateInvoiceStatus();
  const queryClient = useQueryClient();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [billingRunOpen, setBillingRunOpen] = useState(false);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<InvoiceWithDetails | null>(null);
  const [editInvoice, setEditInvoice] = useState<InvoiceWithDetails | null>(null);
  const [sendModalInvoice, setSendModalInvoice] = useState<InvoiceWithDetails | null>(null);
  const [reminderModalInvoice, setReminderModalInvoice] = useState<InvoiceWithDetails | null>(null);
  const [voidConfirmInvoice, setVoidConfirmInvoice] = useState<InvoiceWithDetails | null>(null);
  const [bulkVoidConfirmOpen, setBulkVoidConfirmOpen] = useState(false);

  // Status counts from RPC stats (no second full fetch needed)
  const { data: stats } = useInvoiceStats();
  const statusCounts = useMemo(() => {
    if (!stats) return undefined;
    return {
      all: stats.totalCount,
      draft: stats.draftCount,
      sent: stats.sentCount,
      paid: stats.paidCount,
      overdue: stats.overdueCount,
      void: stats.voidCount,
    } as Record<string, number>;
  }, [stats]);

  const { draftCount, voidableCount, voidableInvoices } = useMemo(() => {
    const selected = invoices.filter((inv) => selectedIds.has(inv.id));
    return {
      draftCount: selected.filter((inv) => inv.status === 'draft').length,
      voidableCount: selected.filter((inv) => inv.status !== 'void' && inv.status !== 'paid').length,
      voidableInvoices: selected.filter((inv) => inv.status !== 'void' && inv.status !== 'paid'),
    };
  }, [invoices, selectedIds]);

  const handleVoidConfirm = async () => {
    if (!voidConfirmInvoice) return;
    await updateStatus.mutateAsync({ id: voidConfirmInvoice.id, status: 'void', orgId: currentOrg?.id });
    setVoidConfirmInvoice(null);
  };

  const handleBulkSend = async () => {
    const drafts = invoices.filter((inv) => selectedIds.has(inv.id) && inv.status === 'draft');
    if (drafts.length === 0) return;

    setBulkSending(true);

    // J3-F14a: Actually invoke send-invoice-email per invoice. Previous
    // implementation only flipped status to 'sent' without sending any
    // email — silent data lie. Now uses the same code path as single-
    // invoice send including idempotency debounce, message_log row,
    // status flip, retry, branding, etc.
    //
    // J3-F14d: Track which invoices failed so the selection can be
    // preserved for retry. Successful sends are deselected; failures
    // remain selected with toast surfacing the failure reason.
    const failedIds: string[] = [];
    const failureReasons: Map<string, string> = new Map();

    const sendOne = async (inv: typeof invoices[0]): Promise<void> => {
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          invoiceId: inv.id,
          isReminder: false,
          customMessage: '',
        },
      });
      if (error) throw error;
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error((data as any).error as string);
      }
    };

    const CHUNK_SIZE = 5;
    let successCount = 0;
    for (let i = 0; i < drafts.length; i += CHUNK_SIZE) {
      const chunk = drafts.slice(i, i + CHUNK_SIZE);
      const results = await Promise.allSettled(chunk.map(sendOne));
      results.forEach((result, idx) => {
        const inv = chunk[idx];
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failedIds.push(inv.id);
          const reason = result.reason instanceof Error
            ? result.reason.message
            : 'Unknown error';
          failureReasons.set(inv.id, reason);
        }
      });
    }

    setBulkSending(false);

    // Refresh list to pick up status changes from successful sends
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });

    // J3-F14d: Preserve failed selections only
    setSelectedIds(new Set(failedIds));

    if (failedIds.length === 0) {
      toast({
        title: 'Invoices sent',
        description: `${successCount} invoice${successCount !== 1 ? 's' : ''} sent successfully.`
      });
    } else {
      // Find a representative reason for the toast (most common, or first)
      const sampleReason = failureReasons.values().next().value || 'See details';
      toast({
        title: `${successCount} sent, ${failedIds.length} failed`,
        description: `Failed invoices kept selected. First failure: ${sampleReason}`,
        variant: 'destructive',
      });
    }
  };

  const handleBulkVoidConfirm = async () => {
    if (!currentOrg?.id) return;
    if (voidableInvoices.length === 0) return;

    // J3-F14b: Use void_invoice RPC instead of direct status update.
    // The RPC handles billing_run_id clearing, partially_paid
    // installment defensive voiding, and audit logging — all bypassed
    // by the previous direct-update path.
    //
    // J3-F14d: Preserve failed selections for retry.
    const failedIds: string[] = [];
    const failureReasons: Map<string, string> = new Map();

    const voidOne = async (inv: typeof invoices[0]): Promise<void> => {
      const { error } = await supabase.rpc('void_invoice', {
        _invoice_id: inv.id,
        _org_id: currentOrg.id,
      });
      if (error) throw error;
    };

    const CHUNK_SIZE = 5;
    let successCount = 0;
    for (let i = 0; i < voidableInvoices.length; i += CHUNK_SIZE) {
      const chunk = voidableInvoices.slice(i, i + CHUNK_SIZE);
      const results = await Promise.allSettled(chunk.map(voidOne));
      results.forEach((result, idx) => {
        const inv = chunk[idx];
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failedIds.push(inv.id);
          const reason = result.reason instanceof Error
            ? result.reason.message
            : 'Unknown error';
          failureReasons.set(inv.id, reason);
        }
      });
    }

    setBulkVoidConfirmOpen(false);

    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });

    setSelectedIds(new Set(failedIds));

    if (failedIds.length === 0) {
      toast({
        title: 'Invoices voided',
        description: `${successCount} invoice${successCount !== 1 ? 's' : ''} voided.`
      });
    } else {
      const sampleReason = failureReasons.values().next().value || 'See details';
      toast({
        title: `${successCount} voided, ${failedIds.length} failed`,
        description: `Failed invoices kept selected. First failure: ${sampleReason}`,
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader
          title="Invoices"
          description="Manage billing and payments"
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Invoices' },
          ]}
        />
        <InvoicesSkeleton />
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <EmptyState
          icon={Receipt}
          title="Failed to load invoices"
          description="Something went wrong. Please try again."
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title={isParent ? 'Invoices & Payments' : `Invoices${totalCount > 0 ? ` (${totalCount})` : ''}`}
        actions={
          !isParent && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="min-h-11 gap-1.5 sm:min-h-9" onClick={exportInvoices} disabled={invoices.length === 0}>
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              {(currentRole === 'owner' || currentRole === 'admin') && (
                <Button variant="outline" size="sm" className="min-h-11 gap-1.5 sm:min-h-9" onClick={() => setBillingRunOpen(true)} data-hint="billing-run-button">
                  <PlayCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Billing Run</span>
                </Button>
              )}
              <Button size="sm" className="min-h-11 gap-1.5 sm:min-h-9" onClick={() => setCreateModalOpen(true)} data-hint="create-invoice-button">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create Invoice</span>
              </Button>
            </div>
          )
        }
      />

      <ContextualHint
        id="invoices-billing-run"
        message="Use Billing Run to automatically generate invoices for completed lessons. You can also create invoices manually."
        position="bottom"
        targetSelector="[data-hint='billing-run-button']"
      />

      {/* Inline stats bar */}
      {!isParent && (
        <div className="mb-4" data-hint="invoice-stats">
          <InvoiceStatsWidget onFilterStatus={(status) => { handleFiltersChange({ ...filters, status: status as any }); }} />
        </div>
      )}

      {!isParent && statusCounts && statusCounts.overdue > 0 && (
        <LoopAssistPageBanner
          bannerKey="invoices_overdue"
          message={`${statusCounts.overdue} invoice${statusCounts.overdue !== 1 ? 's are' : ' is'} overdue — Chase them with LoopAssist`}
          prompt="Send reminders for all overdue invoices"
        />
      )}

      {!isParent ? (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList>
            <TabsTrigger value="invoices" className="gap-1.5">
              <Receipt className="h-3.5 w-3.5" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              Payment Plans
            </TabsTrigger>
            <TabsTrigger value="recurring" className="gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              Recurring
            </TabsTrigger>
            {(currentRole === 'owner' || currentRole === 'admin') && (
              <TabsTrigger value="run-history" className="gap-1.5">
                <History className="h-3.5 w-3.5" />
                Run History
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="invoices" className="space-y-6">
            <InvoiceFiltersBar
              filters={filters}
              onFiltersChange={handleFiltersChange}
              statusCounts={statusCounts}
            />

            <BulkActionsBar
              selectedCount={selectedIds.size}
              draftCount={draftCount}
              voidableCount={voidableCount}
              onBulkSend={handleBulkSend}
              onBulkVoid={() => setBulkVoidConfirmOpen(true)}
              onClearSelection={() => setSelectedIds(new Set())}
              isSending={bulkSending}
            />

            {invoices.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No invoices"
                description="Create an invoice or run billing to generate invoices for completed lessons."
                actionLabel="Start Billing Run"
                onAction={() => setBillingRunOpen(true)}
                secondaryActionLabel="Create Manually"
                onSecondaryAction={() => setCreateModalOpen(true)}
              />
            ) : (
              <div className="rounded-xl border bg-card" data-hint="invoice-list">
                <InvoiceList
                  invoices={invoices}
                  totalCount={totalCount}
                  onSend={(inv) => setSendModalInvoice(inv)}
                  onRecordPayment={(inv) => setPaymentModalInvoice(inv)}
                  onEdit={(inv) => setEditInvoice(inv)}
                  onVoid={(inv) => setVoidConfirmInvoice(inv)}
                  onSendReminder={(inv) => setReminderModalInvoice(inv)}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="plans">
            <PaymentPlansDashboard />
          </TabsContent>

          <TabsContent value="recurring">
            <RecurringBillingTab />
          </TabsContent>

          {(currentRole === 'owner' || currentRole === 'admin') && (
            <TabsContent value="run-history">
              <BillingRunHistory />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <div className="space-y-6">
          {invoices.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No invoices"
              description="You don't have any invoices yet. They will appear here when your teacher creates them."
            />
          ) : (
            <div className="rounded-xl border bg-card" data-hint="invoice-list">
              <InvoiceList
                invoices={invoices}
                totalCount={totalCount}
                onSend={(inv) => setSendModalInvoice(inv)}
                onRecordPayment={(inv) => setPaymentModalInvoice(inv)}
                onEdit={(inv) => setEditInvoice(inv)}
                onVoid={(inv) => setVoidConfirmInvoice(inv)}
                onSendReminder={(inv) => setReminderModalInvoice(inv)}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateInvoiceModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
      <BillingRunWizard open={billingRunOpen} onOpenChange={setBillingRunOpen} />
      <RecordPaymentModal
        invoice={paymentModalInvoice}
        open={!!paymentModalInvoice}
        onOpenChange={(open) => !open && setPaymentModalInvoice(null)}
      />
      <EditInvoiceModal
        invoice={editInvoice}
        open={!!editInvoice}
        onOpenChange={(open) => !open && setEditInvoice(null)}
      />
      <SendInvoiceModal
        invoice={sendModalInvoice}
        open={!!sendModalInvoice}
        onOpenChange={(open) => !open && setSendModalInvoice(null)}
      />
      <SendInvoiceModal
        invoice={reminderModalInvoice}
        open={!!reminderModalInvoice}
        onOpenChange={(open) => !open && setReminderModalInvoice(null)}
        isReminder
      />

      <AlertDialog open={!!voidConfirmInvoice} onOpenChange={(open) => !open && setVoidConfirmInvoice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to void invoice {voidConfirmInvoice?.invoice_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoidConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Void Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkVoidConfirmOpen} onOpenChange={setBulkVoidConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void {voidableCount} Invoice{voidableCount !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div>This action cannot be undone. The selection breakdown:</div>

                {(() => {
                  const selectedForVoid = voidableInvoices;
                  const draftSelected = selectedForVoid.filter(i => i.status === 'draft').length;
                  const sentSelected = selectedForVoid.filter(i => i.status === 'sent').length;
                  const overdueSelected = selectedForVoid.filter(i => i.status === 'overdue').length;
                  return (
                    <ul className="space-y-1 text-sm">
                      {draftSelected > 0 && <li>• {draftSelected} draft</li>}
                      {sentSelected > 0 && <li>• {sentSelected} sent</li>}
                      {overdueSelected > 0 && <li>• {overdueSelected} overdue</li>}
                    </ul>
                  );
                })()}

                {voidableInvoices.some(i => i.status === 'sent' || i.status === 'overdue') && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700">
                    <strong>Warning:</strong> Some of these invoices have been emailed to parents.
                    Voiding will not notify them — those parents will still have the original
                    emailed invoice referencing an invoice number that is now void in your records.
                    Consider whether to contact them separately.
                  </div>
                )}

                <div className="max-h-32 overflow-y-auto rounded-md border bg-muted/30 p-2">
                  <ul className="space-y-1 text-xs font-mono">
                    {voidableInvoices.slice(0, 10).map(inv => (
                      <li key={inv.id} className="flex justify-between">
                        <span>{inv.invoice_number}</span>
                        <span className="text-muted-foreground">{inv.status}</span>
                      </li>
                    ))}
                    {voidableInvoices.length > 10 && (
                      <li className="text-muted-foreground italic">
                        + {voidableInvoices.length - 10} more...
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkVoidConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Void {voidableCount} Invoice{voidableCount !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
