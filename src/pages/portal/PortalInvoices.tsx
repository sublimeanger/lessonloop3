import { usePageMeta } from '@/hooks/usePageMeta';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ListSkeleton } from '@/components/shared/LoadingState';
import { PortalErrorState } from '@/components/portal/PortalErrorState';
import { useSearchParams } from 'react-router-dom';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { usePortalFeatures } from '@/hooks/usePortalFeatures';
import { PortalFeatureDisabled } from '@/components/portal/PortalFeatureDisabled';
import { useOrgPaymentPreferences } from '@/hooks/useOrgPaymentPreferences';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Receipt, Loader2, Download, CreditCard, AlertCircle, CheckCircle, Building2, FileDown } from 'lucide-react';
import { format, parseISO, isBefore, startOfToday } from 'date-fns';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useParentInvoices } from '@/hooks/useParentPortal';
import { useStripePayment } from '@/hooks/useStripePayment';
import { useInvoicePdf } from '@/hooks/useInvoicePdf';
import { useToast } from '@/hooks/use-toast';
import { formatCurrencyMinor } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { PaymentPlanInvoiceCard } from '@/components/portal/PaymentPlanInvoiceCard';
import { PaymentDrawer } from '@/components/portal/PaymentDrawer';
import { useRealtimePortalPayments } from '@/hooks/useRealtimePortalPayments';
import { useSavedPaymentMethods } from '@/hooks/useSavedPaymentMethods';

export default function PortalInvoices() {
  usePageMeta('Invoices | Parent Portal', 'View and pay invoices');
  const { invoicesEnabled } = usePortalFeatures();
  const { currentOrg } = useOrg();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const { data: invoices, isLoading, isError, refetch } = useParentInvoices({ status: statusFilter });
  const { initiatePayment, isLoading: isPaymentLoading } = useStripePayment();
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const { data: orgPaymentPrefs } = useOrgPaymentPreferences();

  // Embedded payment drawer state
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [paymentDrawerInvoice, setPaymentDrawerInvoice] = useState<{
    id: string;
    invoiceNumber?: string;
    amount?: number;
    currencyCode?: string;
    dueDate?: string;
    installmentId?: string;
    payRemaining?: boolean;
    installmentLabel?: string;
  } | null>(null);

  // Real-time payment updates
  useRealtimePortalPayments();

  // Auto-pay status for payment plan badges
  const { autoPayEnabled } = useSavedPaymentMethods();

  const onlinePaymentsEnabled = orgPaymentPrefs?.online_payments_enabled !== false;
  const hasBankDetails = !!(orgPaymentPrefs?.bank_account_name && orgPaymentPrefs?.bank_sort_code && orgPaymentPrefs?.bank_account_number);

  // Get highlighted invoice from URL param
  const highlightedInvoiceId = searchParams.get('invoice');

  // Handle payment success/cancel URL params with server-side verification
  const verificationDone = useRef(false);
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success' && !verificationDone.current) {
      verificationDone.current = true;
      const sessionId = searchParams.get('session_id');
      const invoiceId = searchParams.get('invoice');

      // Clear URL params immediately to prevent re-triggering
      searchParams.delete('payment');
      searchParams.delete('session_id');
      setSearchParams(searchParams);

      // Show initial processing state
      toast({
        title: 'Verifying payment...',
        description: 'Please wait while we confirm your payment.',
      });

      // Verify the session server-side if we have a session_id (anti-spoofing)
      const verifyAndPoll = async () => {
        let verified = false;

        if (sessionId) {
          try {
            const { data } = await supabase.functions.invoke('stripe-verify-session', {
              body: { sessionId },
            });
            verified = data?.verified === true;
          } catch {
            // Verification failed, fall through to polling
          }
        }

        if (verified) {
          toast({
            title: 'Payment Successful',
            description: 'Your payment has been confirmed.',
          });
          refetch();
          return;
        }

        // Poll for invoice update (webhook may not have fired yet)
        let attempts = 0;
        const maxAttempts = 8;
        const pollInterval = setInterval(async () => {
          attempts++;
          refetch();

          // Check if the specific invoice has been updated
          if (invoiceId) {
            const { data: inv } = await supabase
              .from('invoices')
              .select('status, paid_minor, total_minor')
              .eq('id', invoiceId)
              .single();

            if (inv?.status === 'paid' || (inv?.paid_minor && inv.paid_minor > 0)) {
              clearInterval(pollInterval);
              toast({
                title: 'Payment Successful',
                description: 'Your payment has been confirmed and the invoice updated.',
              });
              refetch();
              return;
            }
          }

          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            toast({
              title: 'Payment Processing',
              description: 'Your payment is being processed. The invoice will update shortly.',
            });
            refetch();
          }
        }, 2000);
      };

      verifyAndPoll();
    } else if (paymentStatus === 'cancelled') {
      toast({
        title: 'Payment Cancelled',
        description: 'You cancelled the payment. No charges were made.',
        variant: 'destructive',
      });
      searchParams.delete('payment');
      setSearchParams(searchParams);
    }
  }, [searchParams, toast, setSearchParams, refetch]);

  // Auto-open payment drawer from email deep links (?action=pay&invoice=xxx)
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'pay' && highlightedInvoiceId && invoices && !isLoading && onlinePaymentsEnabled) {
      const inv = invoices.find(i => i.id === highlightedInvoiceId);
      if (inv && ['sent', 'overdue'].includes(inv.status)) {
        handlePayInvoice(highlightedInvoiceId);
        searchParams.delete('action');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, highlightedInvoiceId, invoices, isLoading, onlinePaymentsEnabled]);

  // Scroll to highlighted invoice on mount
  useEffect(() => {
    if (highlightedInvoiceId && invoices && !isLoading) {
      const element = document.getElementById(`invoice-${highlightedInvoiceId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedInvoiceId, invoices, isLoading]);

  const handlePayInvoice = (invoiceId: string) => {
    const inv = invoices?.find(i => i.id === invoiceId);
    setPaymentDrawerInvoice({
      id: invoiceId,
      invoiceNumber: inv?.invoice_number,
      amount: inv ? inv.total_minor - (inv.paid_minor || 0) : undefined,
      currencyCode: currentOrg?.currency_code || 'GBP',
      dueDate: inv ? format(parseISO(inv.due_date), 'd MMM yyyy') : undefined,
    });
    setPaymentDrawerOpen(true);
  };

  const handlePayInstallment = (invoiceId: string, installmentId: string) => {
    const inv = invoices?.find(i => i.id === invoiceId);
    setPaymentDrawerInvoice({
      id: invoiceId,
      invoiceNumber: inv?.invoice_number,
      currencyCode: currentOrg?.currency_code || 'GBP',
      dueDate: inv ? format(parseISO(inv.due_date), 'd MMM yyyy') : undefined,
      installmentId,
    });
    setPaymentDrawerOpen(true);
  };

  const handlePayRemaining = (invoiceId: string) => {
    const inv = invoices?.find(i => i.id === invoiceId);
    setPaymentDrawerInvoice({
      id: invoiceId,
      invoiceNumber: inv?.invoice_number,
      amount: inv ? inv.total_minor - (inv.paid_minor || 0) : undefined,
      currencyCode: currentOrg?.currency_code || 'GBP',
      dueDate: inv ? format(parseISO(inv.due_date), 'd MMM yyyy') : undefined,
      payRemaining: true,
      installmentLabel: `${inv?.invoice_number} — Remaining balance`,
    });
    setPaymentDrawerOpen(true);
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = status === 'sent' && isBefore(parseISO(dueDate), startOfToday());
    
    if (isOverdue) {
      return <Badge variant="destructive">Overdue</Badge>;
    }

    switch (status) {
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      case 'sent':
        return <Badge variant="default">Awaiting Payment</Badge>;
      case 'paid':
        return <Badge variant="secondary" className="bg-success/10 text-success dark:bg-success/20 dark:text-success">Paid</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>;
      case 'void':
        return <Badge variant="outline">Void</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Separate outstanding from paid/void
  const outstandingInvoices = invoices?.filter(inv => ['sent', 'overdue'].includes(inv.status)) || [];
  const otherInvoices = invoices?.filter(inv => !['sent', 'overdue'].includes(inv.status)) || [];

  // Calculate total outstanding
  const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + (inv.total_minor - (inv.paid_minor || 0)), 0);

  if (!invoicesEnabled) {
    return (
      <PortalLayout>
        <PortalFeatureDisabled featureLabel="Invoices & Payments" />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <PageHeader
        title="Invoices & Payments"
        description="View and pay your invoices"
      />

      {/* Outstanding Summary */}
      {totalOutstanding > 0 && (
        <Card className="mb-6 rounded-2xl border-0 overflow-hidden bg-gradient-to-br from-warning/15 via-warning/8 to-transparent">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20 shrink-0">
                  <AlertCircle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="font-medium text-sm">Outstanding Balance</p>
                  <p className="text-2xl font-bold text-warning">
                    {formatCurrencyMinor(totalOutstanding, currentOrg?.currency_code || 'GBP')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bank Transfer Details Card */}
      {hasBankDetails && (
        <Card className="mb-6 border-sky-200/50 dark:border-sky-800/30 bg-sky-50/50 dark:bg-sky-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-sky-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm mb-2">
                  {onlinePaymentsEnabled ? 'Or pay by bank transfer' : 'Pay by bank transfer'}
                </p>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p><strong>Account Name:</strong> {orgPaymentPrefs?.bank_account_name}</p>
                  <p><strong>Sort Code:</strong> {orgPaymentPrefs?.bank_sort_code}</p>
                  <p><strong>Account Number:</strong> {orgPaymentPrefs?.bank_account_number}</p>
                  {orgPaymentPrefs?.bank_reference_prefix && (
                    <p className="text-xs mt-1">Use reference: <strong>{orgPaymentPrefs.bank_reference_prefix}-[invoice number]</strong></p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-4 mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Invoices</SelectItem>
            <SelectItem value="sent">Awaiting Payment</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : isError ? (
        <PortalErrorState onRetry={() => refetch()} />
      ) : !invoices || invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-medium">No invoices found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusFilter !== 'all'
                ? `No ${statusFilter} invoices to display.`
                : 'You have no invoices yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Outstanding */}
          {outstandingInvoices.length > 0 && statusFilter === 'all' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Outstanding</h2>
              <div className="space-y-3">
                  {outstandingInvoices.map((invoice) => (
                    invoice.payment_plan_enabled ? (
                      <PaymentPlanInvoiceCard
                        key={invoice.id}
                        invoice={invoice}
                        currencyCode={currentOrg?.currency_code || 'GBP'}
                        onPayInstallment={handlePayInstallment}
                        onPayRemaining={handlePayRemaining}
                        isPaying={payingInvoiceId === invoice.id && isPaymentLoading}
                        isHighlighted={invoice.id === highlightedInvoiceId}
                        showPayButton={onlinePaymentsEnabled}
                        bankReferencePrefix={orgPaymentPrefs?.bank_reference_prefix}
                        autoPayEnabled={autoPayEnabled}
                      />
                    ) : (
                      <InvoiceCard
                        key={invoice.id}
                        invoice={invoice}
                        currencyCode={currentOrg?.currency_code || 'GBP'}
                        getStatusBadge={getStatusBadge}
                        onPay={handlePayInvoice}
                        isPaying={payingInvoiceId === invoice.id || isPaymentLoading}
                        isHighlighted={invoice.id === highlightedInvoiceId}
                        showPayButton={onlinePaymentsEnabled}
                      />
                    )
                  ))}
              </div>
            </div>
          )}

          {/* All/Filtered */}
          {(statusFilter !== 'all' ? invoices : otherInvoices).length > 0 && (
            <div>
              {statusFilter === 'all' && otherInvoices.length > 0 && (
                <h2 className="text-lg font-semibold mb-4">Payment History</h2>
              )}
              <div className="space-y-3">
                {(statusFilter !== 'all' ? invoices : otherInvoices).map((invoice) => (
                  invoice.payment_plan_enabled ? (
                    <PaymentPlanInvoiceCard
                      key={invoice.id}
                      invoice={invoice}
                      currencyCode={currentOrg?.currency_code || 'GBP'}
                      onPayInstallment={handlePayInstallment}
                      onPayRemaining={handlePayRemaining}
                      isPaying={payingInvoiceId === invoice.id && isPaymentLoading}
                      isHighlighted={invoice.id === highlightedInvoiceId}
                      showPayButton={onlinePaymentsEnabled}
                      bankReferencePrefix={orgPaymentPrefs?.bank_reference_prefix}
                    />
                  ) : (
                    <InvoiceCard
                      key={invoice.id}
                      invoice={invoice}
                      currencyCode={currentOrg?.currency_code || 'GBP'}
                      getStatusBadge={getStatusBadge}
                      onPay={handlePayInvoice}
                      isPaying={payingInvoiceId === invoice.id || isPaymentLoading}
                      isHighlighted={invoice.id === highlightedInvoiceId}
                      showPayButton={onlinePaymentsEnabled}
                    />
                  )
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Embedded Payment Drawer */}
      <PaymentDrawer
        open={paymentDrawerOpen}
        onOpenChange={(open) => {
          setPaymentDrawerOpen(open);
          if (!open) {
            setPaymentDrawerInvoice(null);
            refetch();
          }
        }}
        invoiceId={paymentDrawerInvoice?.id || null}
        invoiceNumber={paymentDrawerInvoice?.invoiceNumber}
        amount={paymentDrawerInvoice?.amount}
        currencyCode={paymentDrawerInvoice?.currencyCode}
        dueDate={paymentDrawerInvoice?.dueDate}
        installmentId={paymentDrawerInvoice?.installmentId}
        payRemaining={paymentDrawerInvoice?.payRemaining}
        installmentLabel={paymentDrawerInvoice?.installmentLabel}
      />
    </PortalLayout>
  );
}

interface InvoiceCardProps {
  invoice: {
    id: string;
    invoice_number: string;
    status: string;
    due_date: string;
    issue_date: string;
    total_minor: number;
    payer_guardian?: { full_name: string } | null;
    payer_student?: { first_name: string; last_name: string } | null;
  };
  currencyCode: string;
  getStatusBadge: (status: string, dueDate: string) => JSX.Element;
  onPay: (invoiceId: string) => void;
  isPaying: boolean;
  isHighlighted?: boolean;
  showPayButton?: boolean;
}

function InvoiceCard({ invoice, currencyCode, getStatusBadge, onPay, isPaying, isHighlighted, showPayButton = true }: InvoiceCardProps) {
  const isPayable = ['sent', 'overdue'].includes(invoice.status) && showPayButton;
  const isPaid = invoice.status === 'paid';
  const { downloadPdf, isLoading: isPdfLoading } = useInvoicePdf();

  const accentColor = isPaid ? 'bg-success' : invoice.status === 'void' ? 'bg-muted-foreground/30' : 'bg-warning';

  return (
    <Card 
      id={`invoice-${invoice.id}`}
      className={cn('rounded-2xl shadow-card hover:shadow-elevated transition-all duration-150 overflow-hidden relative', isHighlighted && 'ring-2 ring-primary ring-offset-2 animate-pulse')}
    >
      <div className={cn('absolute inset-y-0 left-0 w-1 rounded-l-2xl', accentColor)} />
      <CardContent className="p-4 pl-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium tabular-nums">{invoice.invoice_number}</span>
              {getStatusBadge(invoice.status, invoice.due_date)}
            </div>
            <p className="text-sm text-muted-foreground">
              Due: {format(parseISO(invoice.due_date), 'd MMM yyyy')}
            </p>
            {(invoice.payer_guardian || invoice.payer_student) && (
              <p className="text-sm text-muted-foreground">
                {invoice.payer_guardian?.full_name ||
                  `${invoice.payer_student?.first_name} ${invoice.payer_student?.last_name}`}
              </p>
            )}
          </div>

          <div className="text-right shrink-0">
            <p className="text-2xl font-bold">
              {formatCurrencyMinor(invoice.total_minor, currencyCode)}
            </p>
            {isPaid && (
              <Badge variant="secondary" className="bg-success/10 text-success dark:bg-success/20 mt-1">
                <CheckCircle className="h-3 w-3 mr-1" />
                Paid
              </Badge>
            )}
          </div>
        </div>

        {/* Actions row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3 pt-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[44px] gap-1"
            onClick={() => downloadPdf(invoice.id, invoice.invoice_number)}
            disabled={isPdfLoading}
          >
            {isPdfLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Download PDF
          </Button>
          {isPayable && (
            <Button
              onClick={() => onPay(invoice.id)}
              disabled={isPaying}
              className="w-full sm:w-auto min-h-[48px] text-base font-semibold gap-2"
            >
              {isPaying ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CreditCard className="h-5 w-5" />
              )}
              {isPaying ? 'Processing...' : `Pay ${formatCurrencyMinor(invoice.total_minor, currencyCode)}`}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
