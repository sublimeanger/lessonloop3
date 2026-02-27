import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LogOut, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { useTermAdjustments } from '@/hooks/useTermAdjustment';
import { formatCurrencyMinor } from '@/lib/utils';
import { InlineEmptyState } from '@/components/shared/EmptyState';

interface AdjustmentHistoryPanelProps {
  studentId: string;
}

export function AdjustmentHistoryPanel({ studentId }: AdjustmentHistoryPanelProps) {
  const { data: adjustments = [], isLoading } = useTermAdjustments(studentId);

  if (isLoading || adjustments.length === 0) return null;

  return (
    <div className="space-y-3 mt-6">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4" />
        Term Adjustments
      </h3>
      <div className="space-y-3">
        {adjustments.map((adj: any) => {
          const isWithdrawal = adj.adjustment_type === 'withdrawal';
          const isCredit = adj.adjustment_amount_minor > 0;
          const termName = adj.term?.name || 'Custom period';

          return (
            <div
              key={adj.id}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {isWithdrawal ? (
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium text-sm">
                    {isWithdrawal ? 'Withdrawal' : 'Day change'}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {termName}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {isWithdrawal ? (
                    <>
                      Effective{' '}
                      {new Date(adj.effective_date + 'T00:00:00').toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}{' '}
                      · {adj.original_lessons_remaining} lesson
                      {adj.original_lessons_remaining !== 1 ? 's' : ''} cancelled
                    </>
                  ) : (
                    <>
                      {adj.original_day_of_week} → {adj.new_day_of_week} · Effective{' '}
                      {new Date(adj.effective_date + 'T00:00:00').toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </>
                  )}
                </div>
                {adj.adjustment_amount_minor !== 0 && (
                  <div className="text-sm">
                    <span className={isCredit ? 'text-success' : ''}>
                      {isCredit ? 'Credit' : 'Charge'}:{' '}
                      {formatCurrencyMinor(
                        Math.abs(adj.adjustment_amount_minor),
                        adj.currency_code
                      )}
                    </span>
                    {adj.credit_note && (
                      <span className="text-muted-foreground">
                        {' '}
                        · {adj.credit_note.invoice_number}
                      </span>
                    )}
                  </div>
                )}
                {adj.confirmed_at && (
                  <div className="text-xs text-muted-foreground">
                    Confirmed{' '}
                    {new Date(adj.confirmed_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                )}
              </div>
              {adj.credit_note && (
                <Link to={`/invoices/${adj.credit_note.id}`}>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
