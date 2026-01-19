import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { Receipt, Plus, PlayCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInvoices, useUpdateInvoiceStatus, type InvoiceFilters, type InvoiceWithDetails } from '@/hooks/useInvoices';
import { InvoiceFiltersBar } from '@/components/invoices/InvoiceFiltersBar';
import { InvoiceStatsWidget } from '@/components/invoices/InvoiceStatsWidget';
import { InvoiceList } from '@/components/invoices/InvoiceList';
import { CreateInvoiceModal } from '@/components/invoices/CreateInvoiceModal';
import { BillingRunWizard } from '@/components/invoices/BillingRunWizard';
import { RecordPaymentModal } from '@/components/invoices/RecordPaymentModal';
import { SendInvoiceModal } from '@/components/invoices/SendInvoiceModal';
import { LoadingState } from '@/components/shared/LoadingState';
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
  const { isParent } = useAuth();
  const [filters, setFilters] = useState<InvoiceFilters>({});
  const { data: invoices = [], isLoading } = useInvoices(filters);
  const updateStatus = useUpdateInvoiceStatus();

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [billingRunOpen, setBillingRunOpen] = useState(false);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<InvoiceWithDetails | null>(null);
  const [sendModalInvoice, setSendModalInvoice] = useState<InvoiceWithDetails | null>(null);
  const [reminderModalInvoice, setReminderModalInvoice] = useState<InvoiceWithDetails | null>(null);
  const [voidConfirmInvoice, setVoidConfirmInvoice] = useState<InvoiceWithDetails | null>(null);

  const handleVoidConfirm = async () => {
    if (!voidConfirmInvoice) return;
    await updateStatus.mutateAsync({ id: voidConfirmInvoice.id, status: 'void' });
    setVoidConfirmInvoice(null);
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
              <Button variant="outline" className="gap-2" onClick={() => setBillingRunOpen(true)}>
                <PlayCircle className="h-4 w-4" />
                Billing Run
              </Button>
              <Button className="gap-2" onClick={() => setCreateModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Create Invoice
              </Button>
            </div>
          )
        }
      />

      {!isParent && <InvoiceStatsWidget />}

      <div className="mt-6 space-y-4">
        {!isParent && (
          <InvoiceFiltersBar filters={filters} onFiltersChange={setFilters} />
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
          />
        ) : (
          <InvoiceList
            invoices={invoices}
            onSend={(inv) => setSendModalInvoice(inv)}
            onMarkPaid={(inv) => setPaymentModalInvoice(inv)}
            onVoid={(inv) => setVoidConfirmInvoice(inv)}
            onSendReminder={(inv) => setReminderModalInvoice(inv)}
          />
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

      {/* Void confirmation dialog */}
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
    </AppLayout>
  );
}
