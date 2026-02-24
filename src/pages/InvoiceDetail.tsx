import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { parseISO, isBefore, startOfToday } from 'date-fns';
import { useEffect, useState } from 'react';
import { useOrgPaymentPreferences } from '@/hooks/useOrgPaymentPreferences';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, Send, CreditCard, Bell, XCircle, ArrowLeft, CheckCircle2, Loader2, Gift, Building2, SplitSquareHorizontal, RotateCcw, Banknote, Clock } from 'lucide-react';
import { PaymentPlanSetup } from '@/components/invoices/PaymentPlanSetup';
import { useOrg } from '@/contexts/OrgContext';
import { useInvoice, useUpdateInvoiceStatus } from '@/hooks/useInvoices';
import { useStripePayment } from '@/hooks/useStripePayment';
import { useInvoicePdf } from '@/hooks/useInvoicePdf';
import { useToast } from '@/hooks/use-toast';

import { LoadingState } from '@/components/shared/LoadingState';
import { RecordPaymentModal } from '@/components/invoices/RecordPaymentModal';
import { SendInvoiceModal } from '@/components/invoices/SendInvoiceModal';
import { InstallmentTimeline } from '@/components/invoices/InstallmentTimeline';
import { RefundModal } from '@/components/invoices/RefundModal';
import { useRefunds } from '@/hooks/useRefunds';
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
import type { Database } from '@/integrations/supabase/types';
import { formatCurrencyMinor, formatDateUK, formatTimeUK } from '@/lib/utils';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

function getStatusBadge(status: InvoiceStatus, dueDate: string) {
  const due = parseISO(dueDate);
  const isOverdue = status === 'sent' && isBefore(due, startOfToday());

  if (isOverdue) {
    return <Badge variant="destructive">Overdue</Badge>;
  }

  const variants: Record<InvoiceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'secondary',
    sent: 'default',
    paid: 'default',
    overdue: 'destructive',
    void: 'outline',
  };

  return (
    <Badge
      variant={variants[status]}
      className={status === 'paid' ? 'bg-success hover:bg-success/90 text-success-foreground' : undefined}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentOrg, currentRole } = useOrg();
  const { toast } = useToast();
  const isParent = currentRole === 'parent';
  const { data: invoice, isLoading, refetch } = useInvoice(id);
  const updateStatus = useUpdateInvoiceStatus();
  const { initiatePayment, isLoading: isPaymentLoading } = useStripePayment();
  const { downloadPdf, isLoading: isPdfLoading } = useInvoicePdf();

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentPrefillAmount, setPaymentPrefillAmount] = useState<number | undefined>();
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
  const [paymentPlanOpen, setPaymentPlanOpen] = useState(false);
  const [refundPayment, setRefundPayment] = useState<{
    id: string; amount_minor: number; invoice_id: string; provider: string;
  } | null>(null);
  const { data: orgPaymentPrefs } = useOrgPaymentPreferences();
  const { data: refunds } = useRefunds(id);

  const onlinePaymentsEnabled = orgPaymentPrefs?.online_payments_enabled !== false;
  const hasBankDetails = !!(orgPaymentPrefs?.bank_account_name && orgPaymentPrefs?.bank_sort_code && orgPaymentPrefs?.bank_account_number);

  // Handle payment success/cancel URL params
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      toast({
        title: 'Payment Successful',
        description: 'Your payment has been processed.',
      });
      refetch();
      setSearchParams({});
    } else if (paymentStatus === 'cancelled') {
      toast({
        title: 'Payment Cancelled',
        description: 'No charges were made.',
        variant: 'destructive',
      });
      setSearchParams({});
    }
  }, [searchParams, toast, setSearchParams, refetch]);

  const handlePayNow = () => {
    if (id) {
      initiatePayment(id);
    }
  };

  const handleDownloadPdf = () => {
    if (invoice) {
      downloadPdf(invoice.id, invoice.invoice_number);
    }
  };

  const currency = currentOrg?.currency_code || 'GBP';

  if (isLoading) {
    return (
      <AppLayout>
        <LoadingState message="Loading invoice..." />
      </AppLayout>
    );
  }

  if (!invoice) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Invoice not found</p>
          <Button variant="link" onClick={() => navigate('/invoices')}>
            Back to Invoices
          </Button>
        </div>
      </AppLayout>
    );
  }

  const payerName = invoice.payer_guardian
    ? invoice.payer_guardian.full_name
    : invoice.payer_student
    ? `${invoice.payer_student.first_name} ${invoice.payer_student.last_name}`
    : 'Unknown';

  const totalPaid = invoice.payments?.reduce((sum, p) => sum + p.amount_minor, 0) || 0;
  const amountDue = invoice.total_minor - totalPaid;

  const handleVoidConfirm = async () => {
    await updateStatus.mutateAsync({
      id: invoice.id,
      status: 'void',
      currentStatus: invoice.status,
      orgId: currentOrg?.id,
    });
    setVoidConfirmOpen(false);
  };

  return (
    <AppLayout>
      <PageHeader
        title={`Invoice ${invoice.invoice_number}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: isParent ? 'Invoices & Payments' : 'Invoices', href: '/invoices' },
          { label: invoice.invoice_number },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={() => navigate('/invoices')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {isParent ? (
              <>
                <Button 
                  variant="outline" 
                  className="min-h-11 gap-2 sm:min-h-9"
                  onClick={handleDownloadPdf}
                  disabled={isPdfLoading}
                >
                  {isPdfLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isPdfLoading ? 'Generating...' : 'Download PDF'}
                </Button>
                {invoice.status !== 'paid' && invoice.status !== 'void' && onlinePaymentsEnabled && (
                  <Button 
                    className="min-h-11 gap-2 sm:min-h-9" 
                    onClick={handlePayNow}
                    disabled={isPaymentLoading}
                  >
                    {isPaymentLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    {isPaymentLoading ? 'Processing...' : 'Pay Now'}
                  </Button>
                )}
              </>
            ) : (
              <>
                {invoice.status === 'draft' && (
                  <Button className="min-h-11 gap-2 sm:min-h-9" onClick={() => setSendModalOpen(true)}>
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                )}
                {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                  <>
                    <Button variant="outline" className="min-h-11 gap-2 sm:min-h-9" onClick={() => setReminderModalOpen(true)}>
                      <Bell className="h-4 w-4" />
                      Reminder
                    </Button>
                    <Button className="min-h-11 gap-2 sm:min-h-9" onClick={() => setPaymentModalOpen(true)}>
                      <CreditCard className="h-4 w-4" />
                      Record Payment
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Invoice Details</CardTitle>
                <CardDescription>
                  Created on {formatDateUK(parseISO(invoice.created_at), 'dd MMMM yyyy')}
                </CardDescription>
              </div>
              {getStatusBadge(invoice.status, invoice.due_date)}
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Bill To</div>
                    <div className="mt-1">
                      <div className="font-medium">{payerName}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Due Date</div>
                    <div className="mt-1 font-medium">
                      {formatDateUK(parseISO(invoice.due_date), 'dd MMMM yyyy')}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px]">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="pb-3">Description</th>
                        <th className="pb-3 text-right">Qty</th>
                        <th className="pb-3 text-right">Rate</th>
                        <th className="pb-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items?.map((item: any) => (
                        <tr key={item.id} className="border-b">
                          <td className="py-3">
                            <div>{item.description}</div>
                            {item.linked_lesson && (
                              <div className="text-xs text-muted-foreground">
                                {formatDateUK(parseISO(item.linked_lesson.start_at), 'dd MMM yyyy')} {formatTimeUK(parseISO(item.linked_lesson.start_at))}
                              </div>
                            )}
                          </td>
                          <td className="py-3 text-right">{item.quantity}</td>
                          <td className="py-3 text-right">
                            {formatCurrencyMinor(item.unit_price_minor, currency)}
                          </td>
                          <td className="py-3 text-right font-medium">
                            {formatCurrencyMinor(item.amount_minor, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <div className="w-56 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrencyMinor(invoice.subtotal_minor, currency)}</span>
                    </div>
                    {invoice.tax_minor > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          VAT ({invoice.vat_rate}%)
                        </span>
                        <span>{formatCurrencyMinor(invoice.tax_minor, currency)}</span>
                      </div>
                    )}
                    {invoice.credit_applied_minor > 0 && (
                      <div className="flex justify-between text-sm text-success">
                        <span className="flex items-center gap-1">
                          <Gift className="h-3 w-3" />
                          Make-Up Credit
                        </span>
                        <span>-{formatCurrencyMinor(invoice.credit_applied_minor, currency)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span>{formatCurrencyMinor(invoice.total_minor, currency)}</span>
                    </div>
                    {totalPaid > 0 && (
                      <>
                        <div className="flex justify-between text-sm text-success">
                          <span>Paid</span>
                          <span>-{formatCurrencyMinor(totalPaid, currency)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold">
                          <span>Amount Due</span>
                          <span>{formatCurrencyMinor(amountDue, currency)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {invoice.notes && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Notes</div>
                      <p className="text-sm">{invoice.notes}</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment History */}
          {invoice.payments && invoice.payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invoice.payments.map((payment: any) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        {payment.method === 'bacs_debit' || payment.method === 'bank_transfer' ? (
                          <Banknote className="h-5 w-5 text-success" />
                        ) : payment.status === 'processing' ? (
                          <Clock className="h-5 w-5 text-warning" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        )}
                        <div>
                          <div className="font-medium">
                            {formatCurrencyMinor(payment.amount_minor, currency)}
                            {payment.status === 'processing' && (
                              <span className="ml-2 text-xs text-warning font-normal">Processing</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateUK(parseISO(payment.paid_at), 'dd MMM yyyy')} {formatTimeUK(parseISO(payment.paid_at))} •{' '}
                            {payment.method === 'bacs_debit' ? 'BACS Direct Debit' : payment.method.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                      {!isParent && payment.provider === 'stripe' && payment.status !== 'processing' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setRefundPayment({
                            id: payment.id,
                            amount_minor: payment.amount_minor,
                            invoice_id: invoice.id,
                            provider: payment.provider,
                          })}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Refund
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Refund History */}
          {refunds && refunds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Refund History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {refunds.map((refund) => (
                    <div
                      key={refund.id}
                      className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <RotateCcw className="h-5 w-5 text-destructive" />
                        <div>
                          <div className="font-medium">
                            -{formatCurrencyMinor(refund.amount_minor, currency)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateUK(parseISO(refund.created_at), 'dd MMM yyyy')}
                            {refund.reason && ` • ${refund.reason}`}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={refund.status === 'succeeded' ? 'secondary' : refund.status === 'failed' ? 'destructive' : 'outline'}
                        className={refund.status === 'succeeded' ? 'bg-destructive/10 text-destructive' : undefined}
                      >
                        {refund.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* Bank Transfer Details for parents */}
          {isParent && hasBankDetails && (
            <Card className="border-sky-200/50 dark:border-sky-800/30 bg-sky-50/50 dark:bg-sky-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-sky-600" />
                  {onlinePaymentsEnabled ? 'Or Pay by Bank Transfer' : 'Pay by Bank Transfer'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p><strong>Account Name:</strong> {orgPaymentPrefs.bank_account_name}</p>
                  <p><strong>Sort Code:</strong> {orgPaymentPrefs.bank_sort_code}</p>
                  <p><strong>Account Number:</strong> {orgPaymentPrefs.bank_account_number}</p>
                  {orgPaymentPrefs.bank_reference_prefix && (
                    <p className="mt-2 text-xs">
                      Reference: <strong>{orgPaymentPrefs.bank_reference_prefix}-{invoice.invoice_number}</strong>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Payment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold">
                  {formatCurrencyMinor(amountDue, currency)}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {amountDue > 0 ? 'Amount due' : 'Fully paid'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Plan Timeline */}
          {!isParent && invoice.payment_plan_enabled && invoice.status !== 'void' && (
            <InstallmentTimeline
              invoice={invoice}
              onEditPlan={() => setPaymentPlanOpen(true)}
              onRecordPayment={(prefillAmount) => {
                setPaymentPrefillAmount(prefillAmount);
                setPaymentModalOpen(true);
              }}
            />
          )}

          {!isParent && invoice.status !== 'void' && invoice.status !== 'paid' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={handleDownloadPdf}
                  disabled={isPdfLoading}
                >
                  {isPdfLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isPdfLoading ? 'Generating...' : 'Download PDF'}
                </Button>
                {!invoice.payment_plan_enabled && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setPaymentPlanOpen(true)}
                  >
                    <SplitSquareHorizontal className="h-4 w-4" />
                    Set Up Payment Plan
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full gap-2 text-destructive hover:text-destructive"
                  onClick={() => setVoidConfirmOpen(true)}
                >
                  <XCircle className="h-4 w-4" />
                  Void Invoice
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modals */}
      <RecordPaymentModal
        invoice={invoice}
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
      />
      <SendInvoiceModal
        invoice={invoice}
        open={sendModalOpen}
        onOpenChange={setSendModalOpen}
      />
      <SendInvoiceModal
        invoice={invoice}
        open={reminderModalOpen}
        onOpenChange={setReminderModalOpen}
        isReminder
      />


      {/* Refund Modal */}
      {refundPayment && (
        <RefundModal
          open={!!refundPayment}
          onOpenChange={(open) => { if (!open) setRefundPayment(null); }}
          payment={refundPayment}
        />
      )}

      {/* Payment Plan Setup */}
      <PaymentPlanSetup
        invoice={invoice}
        open={paymentPlanOpen}
        onOpenChange={setPaymentPlanOpen}
      />

      {/* Void confirmation dialog */}
      <AlertDialog open={voidConfirmOpen} onOpenChange={setVoidConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to void invoice {invoice.invoice_number}? This action cannot be undone.
              {invoice.credit_applied_minor > 0 && (
                <> Any applied make-up credits ({formatCurrencyMinor(invoice.credit_applied_minor, currency)}) will be restored to the student's balance.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoidConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Void Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
