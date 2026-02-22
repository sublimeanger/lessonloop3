import { useState } from 'react';
import { format, parseISO, isBefore, startOfToday, formatDistanceToNowStrict } from 'date-fns';
import { CheckCircle, AlertCircle, Clock, CreditCard, ChevronDown, ChevronUp, Loader2, FileDown } from 'lucide-react';
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
}

function useParentInstallments(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['parent-installments', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      const { data, error } = await supabase
        .from('invoice_installments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('installment_number', { ascending: true });
      if (error) throw error;
      return data as Installment[];
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
}: PaymentPlanInvoiceCardProps) {
  const [timelineOpen, setTimelineOpen] = useState(true);
  const { data: installments } = useParentInstallments(invoice.id);
  const { downloadPdf, isLoading: isPdfLoading } = useInvoicePdf();
  const today = startOfToday();

  const totalPaid = invoice.paid_minor || 0;
  const remaining = invoice.total_minor - totalPaid;
  const progressPercent = invoice.total_minor > 0 ? Math.round((totalPaid / invoice.total_minor) * 100) : 0;
  const paidCount = installments?.filter(i => i.status === 'paid').length || 0;
  const totalCount = installments?.length || invoice.installment_count || 0;

  // Find next unpaid installment
  const nextInstallment = installments?.find(i => i.status === 'pending' || i.status === 'overdue');
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
                <p className="text-xl font-bold mt-0.5">
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
              {showPayButton && (
                <Button
                  onClick={() => onPayInstallment(invoice.id, nextInstallment.id)}
                  disabled={isPaying}
                  size="sm"
                  className="print:hidden"
                >
                  {isPaying ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-1" />
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
                  const isOverdue = inst.status === 'overdue' || (inst.status === 'pending' && isBefore(parseISO(inst.due_date), today));
                  return (
                    <div key={inst.id} className="flex items-center gap-2 text-sm py-1">
                      {inst.status === 'paid' ? (
                        <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
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
                        {formatCurrencyMinor(inst.amount_minor, currencyCode)}
                      </span>
                      <span className={cn(
                        'text-xs',
                        inst.status === 'paid' ? 'text-success' :
                        isOverdue ? 'text-destructive' : 'text-muted-foreground',
                      )}>
                        {inst.status === 'paid'
                          ? `Paid ${inst.paid_at ? format(parseISO(inst.paid_at), 'd MMM yyyy') : ''}`
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

        {/* Pay remaining + bank reference */}
        <div className="flex items-center justify-between pt-1">
          {remaining > 0 && showPayButton && paidCount > 0 && (
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
