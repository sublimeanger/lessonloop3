import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/EmptyState';
import { Receipt, Plus, PlayCircle, CreditCard } from 'lucide-react';
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
import { SendInvoiceModal } from '@/components/invoices/SendInvoiceModal';
import { LoadingState } from '@/components/shared/LoadingState';
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
  const { currentRole, currentOrg } = useOrg();
  const { toast } = useToast();
  const isParent = currentRole === 'parent';
  const [filters, setFilters] = useState<InvoiceFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const { data: invoiceResult, isLoading } = useInvoices({ ...filters, page: currentPage });
  const invoices = invoiceResult?.data ?? [];
  const totalCount = invoiceResult?.totalCount ?? 0;

  const handleFiltersChange = (newFilters: InvoiceFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };
  const updateStatus = useUpdateInvoiceStatus();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [billingRunOpen, setBillingRunOpen] = useState(false);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<InvoiceWithDetails | null>(null);
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
    let successCount = 0;
    let failCount = 0;

    for (const invoice of drafts) {
      try {
        await updateStatus.mutateAsync({ id: invoice.id, status: 'sent' });
        successCount++;
      } catch {
        failCount++;
      }
    }

    setBulkSending(false);
    setSelectedIds(new Set());

    if (failCount === 0) {
      toast({ title: 'Invoices sent', description: `${successCount} invoice${successCount !== 1 ? 's' : ''} sent successfully.` });
    } else {
      toast({ title: 'Some invoices failed', description: `${successCount} sent, ${failCount} failed.`, variant: 'destructive' });
    }
  };

  const handleBulkVoidConfirm = async () => {
    let successCount = 0;
    let failCount = 0;

    for (const invoice of voidableInvoices) {
      try {
        await updateStatus.mutateAsync({ id: invoice.id, status: 'void', orgId: currentOrg?.id });
        successCount++;
      } catch {
        failCount++;
      }
    }

    setBulkVoidConfirmOpen(false);
    setSelectedIds(new Set());

    if (failCount === 0) {
      toast({ title: 'Invoices voided', description: `${successCount} invoice${successCount !== 1 ? 's' : ''} voided.` });
    } else {
      toast({ title: 'Some invoices failed', description: `${successCount} voided, ${failCount} failed.`, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <LoadingState message="Loading invoices..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title={isParent ? 'Invoices & Payments' : `Invoices${totalCount > 0 ? ` (${totalCount})` : ''}`}
        actions={
          !isParent && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBillingRunOpen(true)} data-tour="billing-run-button">
                <PlayCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Billing Run</span>
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => setCreateModalOpen(true)} data-tour="create-invoice-button">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create Invoice</span>
              </Button>
            </div>
          )
        }
      />

      {/* Inline stats bar */}
      {!isParent && (
        <div className="mb-4" data-tour="invoice-stats">
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
        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList>
            <TabsTrigger value="invoices" className="gap-1.5">
              <Receipt className="h-3.5 w-3.5" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              Payment Plans
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-4">
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
              <div className="rounded-lg border bg-card" data-tour="invoice-list">
                <InvoiceList
                  invoices={invoices}
                  totalCount={totalCount}
                  onSend={(inv) => setSendModalInvoice(inv)}
                  onMarkPaid={(inv) => setPaymentModalInvoice(inv)}
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
        </Tabs>
      ) : (
        <div className="space-y-4">
          {invoices.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No invoices"
              description="You don't have any invoices yet. They will appear here when your teacher creates them."
            />
          ) : (
            <div className="rounded-lg border bg-card" data-tour="invoice-list">
              <InvoiceList
                invoices={invoices}
                totalCount={totalCount}
                onSend={(inv) => setSendModalInvoice(inv)}
                onMarkPaid={(inv) => setPaymentModalInvoice(inv)}
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
            <AlertDialogTitle>Void {voidableCount} Invoice{voidableCount !== 1 ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to void {voidableCount} selected invoice{voidableCount !== 1 ? 's' : ''}? This action cannot be undone.
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
