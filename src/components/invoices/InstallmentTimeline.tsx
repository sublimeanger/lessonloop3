import { useState, useMemo } from 'react';
import { format, parseISO, differenceInDays, startOfToday } from 'date-fns';
import { CheckCircle2, Clock, AlertCircle, Loader2, Pencil, Trash2, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrencyMinor } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useInstallments, useRemovePaymentPlan, type Installment } from '@/hooks/useInvoiceInstallments';

interface InstallmentTimelineProps {
  invoice: {
    id: string;
    invoice_number: string;
    total_minor: number;
    paid_minor?: number | null;
    currency_code: string;
    payment_plan_enabled?: boolean | null;
    installment_count?: number | null;
    status: string;
  };
  onEditPlan: () => void;
  onRecordPayment: (prefillAmount?: number) => void;
}

function getStepIcon(status: Installment['status']) {
  switch (status) {
    case 'paid':
      return <CheckCircle2 className="h-5 w-5 text-success" />;
    case 'overdue':
      return <AlertCircle className="h-5 w-5 text-destructive" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
}

function getStepLabel(inst: Installment) {
  const today = startOfToday();
  switch (inst.status) {
    case 'paid':
      return `Paid ${inst.paid_at ? format(parseISO(inst.paid_at), 'dd MMM yyyy') : ''}`;
    case 'overdue': {
      const days = differenceInDays(today, parseISO(inst.due_date));
      return `Overdue (due ${format(parseISO(inst.due_date), 'dd MMM yyyy')}, ${days} day${days !== 1 ? 's' : ''} ago)`;
    }
    default:
      return `Due ${format(parseISO(inst.due_date), 'dd MMM yyyy')}`;
  }
}

export function InstallmentTimeline({ invoice, onEditPlan, onRecordPayment }: InstallmentTimelineProps) {
  const { data: installments, isLoading } = useInstallments(invoice.id);
  const removeMutation = useRemovePaymentPlan();
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  const currency = invoice.currency_code || 'GBP';
  const totalPaid = invoice.paid_minor || 0;
  const progressPercent = invoice.total_minor > 0 ? Math.round((totalPaid / invoice.total_minor) * 100) : 0;

  const { paidCount, totalCount, hasAnyPaid, nextPendingId } = useMemo(() => {
    const paid = installments?.filter(i => i.status === 'paid').length || 0;
    const total = installments?.length || 0;
    const nextPending = installments?.find(i => i.status === 'pending' || i.status === 'overdue');
    return { paidCount: paid, totalCount: total, hasAnyPaid: paid > 0, nextPendingId: nextPending?.id };
  }, [installments]);

  const handleRemove = () => {
    removeMutation.mutate(invoice.id, {
      onSuccess: () => setRemoveConfirmOpen(false),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!installments || installments.length === 0) return null;

  return (
    <>
      <Card className="print:border-none print:shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Payment Plan</CardTitle>
          {/* Print-only header */}
          <p className="hidden print:block text-sm text-muted-foreground">
            {invoice.invoice_number}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Timeline */}
          <div className="relative space-y-0">
            {installments.map((inst, idx) => (
              <div key={inst.id} className="flex gap-3 relative">
                {/* Vertical line */}
                {idx < installments.length - 1 && (
                  <div className={cn(
                    'absolute left-[9px] top-6 w-0.5 h-[calc(100%-4px)]',
                    inst.status === 'paid' ? 'bg-success/40' : 'bg-border',
                  )} />
                )}
                {/* Icon */}
                <div className="flex-shrink-0 z-10 bg-background print:bg-transparent">
                  {getStepIcon(inst.status)}
                </div>
                {/* Content */}
                <div className={cn(
                  'flex-1 pb-4 min-w-0',
                  idx === installments.length - 1 && 'pb-0',
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={cn(
                        'text-sm font-medium',
                        inst.status === 'paid' && 'text-success',
                        inst.status === 'overdue' && 'text-destructive',
                      )}>
                        Installment {inst.installment_number} — {formatCurrencyMinor(inst.amount_minor, currency)}
                      </p>
                      <p className={cn(
                        'text-xs',
                        inst.status === 'overdue' ? 'text-destructive/80' : 'text-muted-foreground',
                      )}>
                        {getStepLabel(inst)}
                      </p>
                    </div>
                    {(inst.status === 'overdue' || (inst.status === 'pending' && inst.id === nextPendingId)) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(
                          'flex-shrink-0 gap-1 text-xs h-7 print:hidden',
                          inst.status === 'overdue' && 'border-destructive/30 text-destructive hover:bg-destructive/10',
                        )}
                        onClick={() => onRecordPayment(inst.amount_minor)}
                      >
                        <CreditCard className="h-3 w-3" />
                        Pay
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="space-y-2 pt-2">
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {formatCurrencyMinor(totalPaid, currency)} of {formatCurrencyMinor(invoice.total_minor, currency)} paid ({paidCount} of {totalCount} installments)
            </p>
          </div>

          {/* Actions — hidden when printing */}
          <div className="flex gap-2 pt-1 print:hidden">
            <Button variant="outline" size="sm" className="gap-1" onClick={onEditPlan}>
              <Pencil className="h-3 w-3" />
              Edit Plan
            </Button>
            {!hasAnyPaid && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-destructive hover:text-destructive"
                onClick={() => setRemoveConfirmOpen(true)}
              >
                <Trash2 className="h-3 w-3" />
                Remove Plan
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Payment Plan</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all pending installments for {invoice.invoice_number}. This action cannot be undone. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMutation.isPending ? 'Removing...' : 'Remove Plan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
