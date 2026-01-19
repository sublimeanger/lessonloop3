import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO, isBefore } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, Send, CreditCard, Bell, XCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useInvoice, useUpdateInvoiceStatus } from '@/hooks/useInvoices';
import { LoadingState } from '@/components/shared/LoadingState';
import { useState } from 'react';
import { RecordPaymentModal } from '@/components/invoices/RecordPaymentModal';
import { SendInvoiceModal } from '@/components/invoices/SendInvoiceModal';
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

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

function formatCurrency(amountMinor: number, currencyCode: string = 'GBP') {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}

function getStatusBadge(status: InvoiceStatus, dueDate: string) {
  const today = new Date();
  const due = parseISO(dueDate);
  const isOverdue = status === 'sent' && isBefore(due, today);

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
      className={status === 'paid' ? 'bg-green-600 hover:bg-green-700' : undefined}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isParent } = useAuth();
  const { currentOrg } = useOrg();
  const { data: invoice, isLoading } = useInvoice(id);
  const updateStatus = useUpdateInvoiceStatus();

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);

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
    await updateStatus.mutateAsync({ id: invoice.id, status: 'void' });
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/invoices')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {isParent ? (
              invoice.status !== 'paid' && invoice.status !== 'void' && (
                <Button className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  Pay Now
                </Button>
              )
            ) : (
              <>
                {invoice.status === 'draft' && (
                  <Button className="gap-2" onClick={() => setSendModalOpen(true)}>
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                )}
                {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                  <>
                    <Button variant="outline" className="gap-2" onClick={() => setReminderModalOpen(true)}>
                      <Bell className="h-4 w-4" />
                      Reminder
                    </Button>
                    <Button className="gap-2" onClick={() => setPaymentModalOpen(true)}>
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
                  Created on {format(parseISO(invoice.created_at), 'dd MMMM yyyy')}
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
                      {format(parseISO(invoice.due_date), 'dd MMMM yyyy')}
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <table className="w-full">
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
                                {format(parseISO(item.linked_lesson.start_at), 'dd MMM yyyy HH:mm')}
                              </div>
                            )}
                          </td>
                          <td className="py-3 text-right">{item.quantity}</td>
                          <td className="py-3 text-right">
                            {formatCurrency(item.unit_price_minor, currency)}
                          </td>
                          <td className="py-3 text-right font-medium">
                            {formatCurrency(item.amount_minor, currency)}
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
                      <span>{formatCurrency(invoice.subtotal_minor, currency)}</span>
                    </div>
                    {invoice.tax_minor > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          VAT ({invoice.vat_rate}%)
                        </span>
                        <span>{formatCurrency(invoice.tax_minor, currency)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span>{formatCurrency(invoice.total_minor, currency)}</span>
                    </div>
                    {totalPaid > 0 && (
                      <>
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Paid</span>
                          <span>-{formatCurrency(totalPaid, currency)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold">
                          <span>Amount Due</span>
                          <span>{formatCurrency(amountDue, currency)}</span>
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
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <div>
                          <div className="font-medium">
                            {formatCurrency(payment.amount_minor, currency)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(parseISO(payment.paid_at), 'dd MMM yyyy HH:mm')} •{' '}
                            {payment.method.replace('_', ' ')}
                            {payment.provider_reference && ` • ${payment.provider_reference}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold">
                  {formatCurrency(amountDue, currency)}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {amountDue > 0 ? 'Amount due' : 'Fully paid'}
                </div>
              </div>
            </CardContent>
          </Card>

          {!isParent && invoice.status !== 'void' && invoice.status !== 'paid' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full gap-2">
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
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

      {/* Void confirmation dialog */}
      <AlertDialog open={voidConfirmOpen} onOpenChange={setVoidConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to void invoice {invoice.invoice_number}? This action cannot be undone.
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
