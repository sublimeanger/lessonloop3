import { useInvoiceStats } from '@/hooks/useInvoices';
import { useOrg } from '@/contexts/OrgContext';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function formatCurrency(amountMinor: number, currencyCode: string = 'GBP') {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface InvoiceStatsWidgetProps {
  onFilterStatus?: (status: string) => void;
}

export function InvoiceStatsWidget({ onFilterStatus }: InvoiceStatsWidgetProps = {}) {
  const { data: stats, isLoading } = useInvoiceStats();
  const { currentOrg } = useOrg();

  if (isLoading || !stats) {
    return (
      <div className="flex items-center gap-4 py-1">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20" />
      </div>
    );
  }

  const currency = currentOrg?.currency_code || 'GBP';
  const isClickable = !!onFilterStatus;

  const statItems = [
    {
      value: formatCurrency(stats.totalOutstanding + stats.paid, currency),
      label: 'total',
      color: '',
      filterStatus: 'all',
    },
    {
      value: formatCurrency(stats.paid, currency),
      label: 'paid',
      color: 'text-success',
      filterStatus: 'paid',
    },
    {
      value: formatCurrency(stats.totalOutstanding, currency),
      label: 'outstanding',
      color: 'text-warning',
      filterStatus: 'sent',
    },
    stats.overdueCount > 0
      ? {
          value: String(stats.overdueCount),
          label: 'overdue',
          color: 'text-destructive',
          filterStatus: 'overdue',
        }
      : null,
  ].filter(Boolean) as Array<{ value: string; label: string; color: string; filterStatus: string }>;

  return (
    <div className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
      {statItems.map((stat, i) => (
        <span key={stat.label} className="inline-flex items-center">
          {i > 0 && <span className="mx-1.5">·</span>}
          {isClickable ? (
            <button
              onClick={() => onFilterStatus?.(stat.filterStatus)}
              className={cn(
                'inline-flex items-center gap-1 hover:underline underline-offset-2 transition-colors hover:text-foreground',
                stat.color,
              )}
            >
              <span className="font-mono font-semibold text-foreground">{stat.value}</span>
              <span>{stat.label}</span>
            </button>
          ) : (
            <span className={cn('inline-flex items-center gap-1', stat.color)}>
              <span className="font-mono font-semibold text-foreground">{stat.value}</span>
              <span>{stat.label}</span>
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
