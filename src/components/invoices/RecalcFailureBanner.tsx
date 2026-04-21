import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useInvoiceRecalcFailures, useAdminRecalculateInvoice } from '@/hooks/useInvoiceRecalcFailure';
import { formatDateUK, formatTimeUK } from '@/lib/utils';
import { parseISO } from 'date-fns';

interface RecalcFailureBannerProps {
  invoiceId: string;
}

/**
 * J4-F24: Surfaces recent recalculate_invoice_paid failures that
 * occurred after a Stripe refund. Invoice.paid_minor may be stale
 * — operator can retry recalc with a single click. Empty when no
 * failures exist or when the last failure was superseded by a
 * successful manual retry.
 */
export function RecalcFailureBanner({ invoiceId }: RecalcFailureBannerProps) {
  const { data: failures, isLoading } = useInvoiceRecalcFailures(invoiceId);
  const retryMutation = useAdminRecalculateInvoice();
  if (isLoading || !failures || failures.length === 0) return null;

  const latest = failures[0];
  const when = `${formatDateUK(parseISO(latest.created_at), 'dd MMM yyyy')} ${formatTimeUK(parseISO(latest.created_at))}`;
  const source = latest.after?.source === 'stripe_refund_webhook'
    ? 'a Stripe webhook refund'
    : latest.after?.source === 'stripe_refund_admin'
    ? 'a staff-initiated refund'
    : 'a refund';

  return (
    <Card className="border-amber-300 bg-amber-50/60 dark:border-amber-800/60 dark:bg-amber-950/30">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100 text-sm">
                Billing state may be stale
              </p>
              <p className="text-xs text-amber-800/90 dark:text-amber-200/90 mt-1">
                The recalculation after {source} on {when} didn't complete after {latest.after?.attempts ?? 3} attempts. The refund itself has succeeded — the invoice's paid balance may just be temporarily out of sync. Retry the recalculation below, or contact support if it keeps failing.
              </p>
              {latest.after?.error && (
                <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-1 font-mono truncate">
                  Last error: {latest.after.error}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-amber-400 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900/50"
              disabled={retryMutation.isPending}
              onClick={() => retryMutation.mutate(invoiceId)}
            >
              {retryMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Recalculating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry recalculation
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
