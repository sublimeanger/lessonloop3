import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { ContextualHint } from '@/components/shared/ContextualHint';
import { Receipt, Plus, PlayCircle } from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';
import { useInvoices, useUpdateInvoiceStatus, type InvoiceFilters, type InvoiceWithDetails } from '@/hooks/useInvoices';
import { InvoiceFiltersBar } from '@/components/invoices/InvoiceFiltersBar';
import { InvoiceStatsWidget } from '@/components/invoices/InvoiceStatsWidget';
import { InvoiceList } from '@/components/invoices/InvoiceList';
import { BulkActionsBar } from '@/components/invoices/BulkActionsBar';
import { CreateInvoiceModal } from '@/components/invoices/CreateInvoiceModal';
import { BillingRunWizard } from '@/components/invoices/BillingRunWizard';
import { RecordPaymentModal } from '@/components/invoices/RecordPaymentModal';
import { SendInvoiceModal } from '@/components/invoices/SendInvoiceModal';
import { LoadingState } from '@/components/shared/LoadingState';
import { useToast } from '@/hooks/use-toast';
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
  const { currentRole } = useOrg();
  const { toast } = useToast();
  const isParent = currentRole === 'parent';
  const [filters, setFilters] = useState<InvoiceFilters>({});
  const { data: invoices = [], isLoading } = useInvoices(filters);
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

  // Calculate bulk action counts
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
    await updateStatus.mutateAsync({ id: voidConfirmInvoice.id, status: 'void' });
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
      toast({
        title: 'Some invoices failed',
        description: `${successCount} sent, ${failCount} failed.`,
        variant: 'destructive',
      });
    }
  };

  const handleBulkVoidConfirm = async () => {
    let successCount = 0;
    let failCount = 0;

    for (const invoice of voidableInvoices) {
      try {
        await updateStatus.mutateAsync({ id: invoice.id, status: 'void' });
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
      toast({
        title: 'Some invoices failed',
        description: `${successCount} voided, ${failCount} failed.`,
        variant: 'destructive',
      });
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
        title={isParent ? 'Invoices & Payments' : 'Invoices'}
        description={isParent ? 'View and pay your invoices' : 'Create and manage invoices'}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: isParent ? 'Invoices & Payments' : 'Invoices' },
        ]}
        actions={
          !isParent && (
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setBillingRunOpen(true)} data-tour="billing-run-button">
                <PlayCircle className="h-4 w-4" />
                Billing Run
              </Button>
              <Button className="gap-2" onClick={() => setCreateModalOpen(true)} data-tour="create-invoice-button">
                <Plus className="h-4 w-4" />
                Create Invoice
              </Button>
            </div>
          )
        }
      />

      {!isParent && <div data-tour="invoice-stats"><InvoiceStatsWidget /></div>}

      <div className="mt-6 space-y-4">
        {!isParent && (
          <InvoiceFiltersBar filters={filters} onFiltersChange={setFilters} />
        )}

        {!isParent && (
          <BulkActionsBar
            selectedCount={selectedIds.size}
            draftCount={draftCount}
            voidableCount={voidableCount}
            onBulkSend={handleBulkSend}
            onBulkVoid={() => setBulkVoidConfirmOpen(true)}
            onClearSelection={() => setSelectedIds(new Set())}
            isSending={bulkSending}
          />
        )}

        {invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={isParent ? 'No invoices yet' : 'No invoices created'}
            description={
              isParent
                ? "You don't have any invoices yet. They will appear here when your teacher creates them."
                : 'Create your first invoice to start billing students. Invoices can be generated automatically from lessons.'
            }
            actionLabel={!isParent ? 'Create First Invoice' : undefined}
            onAction={!isParent ? () => setCreateModalOpen(true) : undefined}
            previewImage={!isParent ? '/previews/invoices-preview.svg' : undefined}
            previewAlt="Example invoice list"
          />
        ) : (
          <div data-tour="invoice-list" data-hint="invoice-list">
            <InvoiceList
              invoices={invoices}
              onSend={(inv) => setSendModalInvoice(inv)}
              onMarkPaid={(inv) => setPaymentModalInvoice(inv)}
              onVoid={(inv) => setVoidConfirmInvoice(inv)}
              onSendReminder={(inv) => setReminderModalInvoice(inv)}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
            {!isParent && (
              <ContextualHint
                id="invoice-actions"
                message="Use 'Billing Run' to generate invoices automatically from delivered lessons"
                position="top"
                targetSelector="[data-tour='billing-run-button']"
              />
            )}
          </div>
        )}
      </div>

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

      {/* Void confirmation dialog (single) */}
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

      {/* Bulk void confirmation dialog */}
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
