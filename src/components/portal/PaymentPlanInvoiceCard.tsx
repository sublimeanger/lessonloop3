import { useState } from 'react';
import { format, parseISO, isBefore, startOfToday, formatDistanceToNowStrict } from 'date-fns';
import { CheckCircle, AlertCircle, Clock, CreditCard, ChevronDown, ChevronUp, Loader2, FileDown, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrencyMinor } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useInvoicePdf } from '@/hooks/useInvoicePdf';
import type { Installment } from '@/hooks/useInvoiceInstallments';
import { platform } from '@/lib/platform';
import { NativePaymentNotice } from '@/components/shared/NativePaymentNotice';

interface PaymentPlanInvoiceCardProps {
  invoice: {
    id: string;
    invoice_number: string;
    status: string;
    due_date: string;
    total_minor: number;
    paid_minor: number | null;
    currency_code: string;
    installment_count: number | null;
    payer_guardian?: { full_name: string } | null;
    payer_student?: { first_name: string; last_name: string } | null;
  };
  currencyCode: string;
  onPayInstallment: (invoiceId: string, installmentId: string) => void;
  onPayRemaining: (invoiceId: string) => void;
  isPaying: boolean;
  isHighlighted?: boolean;
  showPayButton?: boolean;
  bankReferencePrefix?: string | null;
  autoPayEnabled?: boolean;
}

function useParentInstallments(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['parent-installments', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return { installments: [] as Installment[], outstanding: new Map<string, number>() };
      const { data: installments, error } = await supabase
        .from('invoice_installments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('installment_number', { ascending: true });
      if (error) throw error;

      const ids = (installments || []).map((i: Installment) => i.id);
      if (ids.length === 0) return { installments: [] as Installment[], outstanding: new Map<string, number>() };

      const { data: payments } = await supabase
        .from('payments')
        .select('id, amount_minor, installment_id')
        .in('installment_id', ids);
      const paymentIds = (payments || []).map((p) => p.id);
      let refunds: Array<{ amount_minor: number; payment_id: string }> = [];
      if (paymentIds.length > 0) {
        const { data: refundRows } = await supabase
          .from('refunds')
          .select('amount_minor, payment_id')
          .in('payment_id', paymentIds)
          .eq('status', 'succeeded');
        refunds = (refundRows || []) as typeof refunds;
      }
      const refundByPayment = new Map<string, number>();
      refunds.forEach((r) => {
        refundByPayment.set(r.payment_id, (refundByPayment.get(r.payment_id) || 0) + r.amount_minor);
      });
      const appliedByInstallment = new Map<string, number>();
      (payments || []).forEach((p) => {
        if (!p.installment_id) return;
        const net = p.amount_minor - (refundByPayment.get(p.id) || 0);
        appliedByInstallment.set(p.installment_id, (appliedByInstallment.get(p.installment_id) || 0) + net);
      });
      const outstanding = new Map<string, number>();
      (installments || []).forEach((i: Installment) => {
        outstanding.set(i.id, Math.max(0, i.amount_minor - (appliedByInstallment.get(i.id) || 0)));
      });

      return { installments: (installments || []) as Installment[], outstanding };
    },
    enabled: !!invoiceId,
  });
}

export function PaymentPlanInvoiceCard({
  invoice,
  currencyCode,
  onPayInstallment,
  onPayRemaining,
  isPaying,
  isHighlighted,
  showPayButton = true,
  bankReferencePrefix,
  autoPayEnabled,
}: PaymentPlanInvoiceCardProps) {
  const [timelineOpen, setTimelineOpen] = useState(true);
  const { data: parentData } = useParentInstallments(invoice.id);
  const installments = parentData?.installments || [];
  const outstandingMap = parentData?.outstanding || new Map<string, number>();
  const { downloadPdf, isLoading: isPdfLoading } = useInvoicePdf();
  const today = startOfToday();

  const totalPaid = invoice.paid_minor || 0;
  const remaining = invoice.total_minor - totalPaid;
  const progressPercent = invoice.total_minor > 0 ? Math.round((totalPaid / invoice.total_minor) * 100) : 0;
  const paidCount = installments?.filter(i => i.status === 'paid').length || 0;
  const totalCount = installments?.length || invoice.installment_count || 0;

  // Find next unpaid installment (includes partially_paid — still owes the remainder)
  const nextInstallment = installments?.find(i => i.status === 'pending' || i.status === 'overdue' || i.status === 'partially_paid');
  const nextIsOverdue = nextInstallment ? isBefore(parseISO(nextInstallment.due_date), today) : false;

  return (
    <Card
      id={`invoice-${invoice.id}`}
      className={cn(
        'print:border-none print:shadow-none',
        isHighlighted && 'ring-2 ring-primary ring-offset-2 animate-pulse',
      )}
    >
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium tabular-nums">{invoice.invoice_number}</span>
            <Badge variant="outline" className="border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30">
              Payment Plan
            </Badge>
            {autoPayEnabled && (
              <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 gap-1">
                <Zap className="h-3 w-3" />
                Auto-pay
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="print:hidden"
            onClick={() => downloadPdf(invoice.id, invoice.invoice_number)}
            disabled={isPdfLoading}
          >
            {isPdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <Progress value={progressPercent} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {formatCurrencyMinor(totalPaid, currencyCode)} of {formatCurrencyMinor(invoice.total_minor, currencyCode)} paid
              <span className="ml-1">({progressPercent}%)</span>
            </span>
            <span>{paidCount} of {totalCount} installments</span>
          </div>
        </div>

        {/* Next payment highlight */}
        {nextInstallment && invoice.status !== 'paid' && (
          <div className={cn(
            'rounded-lg border p-3 space-y-2',
            nextIsOverdue
              ? 'border-destructive/50 bg-destructive/5'
              : 'border-border',
          )}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Next payment</span>
                  {nextIsOverdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
                </div>
                <p className="text-xl font-semibold mt-0.5">
                  {formatCurrencyMinor(nextInstallment.amount_minor, currencyCode)}
                </p>
                <p className={cn(
                  'text-xs',
                  nextIsOverdue ? 'text-destructive' : 'text-muted-foreground',
                )}>
                  Due: {format(parseISO(nextInstallment.due_date), 'd MMMM yyyy')}{' '}
                  ({nextIsOverdue
                    ? `${formatDistanceToNowStrict(parseISO(nextInstallment.due_date))} overdue`
                    : `in ${formatDistanceToNowStrict(parseISO(nextInstallment.due_date))}`
                  })
                </p>
              </div>
              {showPayButton && !platform.isNative && (
                <Button
                  onClick={() => onPayInstallment(invoice.id, nextInstallment.id)}
                  disabled={isPaying}
                  className="print:hidden w-full sm:w-auto min-h-[48px] text-base font-semibold gap-2 mt-2 sm:mt-0"
                >
                  {isPaying ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CreditCard className="h-5 w-5" />
                  )}
                  Pay {formatCurrencyMinor(nextInstallment.amount_minor, currencyCode)}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Installment timeline (collapsible) */}
        {installments && installments.length > 0 && (
          <div>
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full print:hidden"
              onClick={() => setTimelineOpen(!timelineOpen)}
            >
              {timelineOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {timelineOpen ? 'Hide' : 'Show'} installment details
            </button>

            {timelineOpen && (
              <div className="mt-2 space-y-1.5">
                {installments.map((inst) => {
                  const isPartial = inst.status === 'partially_paid';
                  const isOverdue = inst.status === 'overdue' || ((inst.status === 'pending' || isPartial) && isBefore(parseISO(inst.due_date), today));
                  const outstandingOnInst = outstandingMap.get(inst.id) ?? inst.amount_minor;
                  return (
                    <div key={inst.id} className="flex items-center gap-2 text-sm py-1">
                      {inst.status === 'paid' ? (
                        <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                      ) : isPartial ? (
                        <CheckCircle className="h-4 w-4 text-warning flex-shrink-0" />
                      ) : isOverdue ? (
                        <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className={cn(
                        'flex-1',
                        inst.status === 'paid' && 'text-muted-foreground',
                        isOverdue && inst.status !== 'paid' && 'text-destructive',
                      )}>
                        {isPartial
                          ? `${formatCurrencyMinor(outstandingOnInst, currencyCode)} of ${formatCurrencyMinor(inst.amount_minor, currencyCode)}`
                          : formatCurrencyMinor(inst.amount_minor, currencyCode)}
                      </span>
                      <span className={cn(
                        'text-xs',
                        inst.status === 'paid' ? 'text-success' :
                        isPartial ? 'text-warning' :
                        isOverdue ? 'text-destructive' : 'text-muted-foreground',
                      )}>
                        {inst.status === 'paid'
                          ? `Paid ${inst.paid_at ? format(parseISO(inst.paid_at), 'd MMM yyyy') : ''}`
                          : isPartial
                            ? (isOverdue ? 'Partially paid • overdue' : 'Partially paid')
                            : isOverdue
                              ? `${formatDistanceToNowStrict(parseISO(inst.due_date))} overdue`
                              : `Due ${format(parseISO(inst.due_date), 'd MMM yyyy')}`
                        }
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Native payment notice */}
        {platform.isNative && showPayButton && nextInstallment && invoice.status !== 'paid' && (
          <NativePaymentNotice
            variant="inline"
            message="To pay this invoice, please visit lessonloop.net in your browser or use the payment link sent to your email."
          />
        )}

        {/* Pay remaining + bank reference */}
        <div className="flex items-center justify-between pt-1">
          {remaining > 0 && showPayButton && paidCount > 0 && !platform.isNative && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs print:hidden"
              onClick={() => onPayRemaining(invoice.id)}
              disabled={isPaying}
            >
              Pay remaining ({formatCurrencyMinor(remaining, currencyCode)})
            </Button>
          )}
          {bankReferencePrefix && nextInstallment && (
            <span className="text-xs text-muted-foreground ml-auto">
              Bank ref: <strong>{bankReferencePrefix}-{invoice.invoice_number}-{nextInstallment.installment_number}</strong>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
