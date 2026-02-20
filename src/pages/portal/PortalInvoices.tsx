import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PortalLayout } from '@/components/layout/PortalLayout';
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
import { useParentInvoices } from '@/hooks/useParentPortal';
import { useStripePayment } from '@/hooks/useStripePayment';
import { useInvoicePdf } from '@/hooks/useInvoicePdf';
import { useToast } from '@/hooks/use-toast';


function formatCurrency(amountMinor: number, currencyCode: string = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currencyCode,
  }).format(amountMinor / 100);
}

export default function PortalInvoices() {
  const { currentOrg } = useOrg();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const { data: invoices, isLoading, refetch } = useParentInvoices({ status: statusFilter });
  const { initiatePayment, isLoading: isPaymentLoading } = useStripePayment();
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const { data: orgPaymentPrefs } = useOrgPaymentPreferences();

  const onlinePaymentsEnabled = orgPaymentPrefs?.online_payments_enabled !== false;
  const hasBankDetails = !!(orgPaymentPrefs?.bank_account_name && orgPaymentPrefs?.bank_sort_code && orgPaymentPrefs?.bank_account_number);

  // Get highlighted invoice from URL param
  const highlightedInvoiceId = searchParams.get('invoice');

  // Handle payment success/cancel URL params
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      toast({
        title: 'Payment Successful',
        description: 'Your payment has been processed. The invoice will be updated shortly.',
      });
      // Refetch invoices to show updated status
      refetch();
      // Clear only payment param, keep invoice if present
      searchParams.delete('payment');
      setSearchParams(searchParams);
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

  // Scroll to highlighted invoice on mount
  useEffect(() => {
    if (highlightedInvoiceId && invoices && !isLoading) {
      const element = document.getElementById(`invoice-${highlightedInvoiceId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedInvoiceId, invoices, isLoading]);

  const handlePayInvoice = async (invoiceId: string) => {
    setPayingInvoiceId(invoiceId);
    await initiatePayment(invoiceId);
    setPayingInvoiceId(null);
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
  const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + inv.total_minor, 0);

  return (
    <PortalLayout>
      <PageHeader
        title="Invoices & Payments"
        description="View and pay your invoices"
      />

      {/* Outstanding Summary */}
      {totalOutstanding > 0 && (
        <Card className="mb-6 border-warning/30 dark:border-warning/40 bg-warning/10 dark:bg-warning/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-warning" />
                <div>
                  <p className="font-medium">Outstanding Balance</p>
                  <p className="text-2xl font-bold text-warning">
                    {formatCurrency(totalOutstanding, currentOrg?.currency_code || 'GBP')}
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
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
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
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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

  return (
    <Card 
      id={`invoice-${invoice.id}`}
      className={isHighlighted ? 'ring-2 ring-primary ring-offset-2 animate-pulse' : ''}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-medium">{invoice.invoice_number}</span>
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

          <div className="text-right">
            <p className="text-lg font-bold">
              {formatCurrency(invoice.total_minor, currencyCode)}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => downloadPdf(invoice.id, invoice.invoice_number)}
                disabled={isPdfLoading}
              >
                {isPdfLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-1" />
                )}
                PDF
              </Button>
              {isPayable && (
                <Button 
                  size="sm" 
                  onClick={() => onPay(invoice.id)}
                  disabled={isPaying}
                >
                  {isPaying ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-1" />
                  )}
                  {isPaying ? 'Processing...' : 'Pay Now'}
                </Button>
              )}
              {isPaid && (
                <Badge variant="secondary" className="bg-success/10 text-success dark:bg-success/20">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Paid
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
