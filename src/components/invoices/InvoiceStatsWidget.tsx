import { useInvoiceStats } from '@/hooks/useInvoices';
import { useOrg } from '@/contexts/OrgContext';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatCurrencyMinor } from '@/lib/utils';

interface InvoiceStatsWidgetProps {
  onFilterStatus?: (status: string) => void;
}

export function InvoiceStatsWidget({ onFilterStatus }: InvoiceStatsWidgetProps = {}) {
  const { data: stats, isLoading } = useInvoiceStats();
  const { currentOrg } = useOrg();

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-2 py-1 sm:flex sm:items-center sm:gap-4">
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
      value: formatCurrencyMinor(stats.totalOutstanding + stats.paid, currency),
      label: 'total',
      color: '',
      filterStatus: 'all',
    },
    {
      value: formatCurrencyMinor(stats.paid, currency),
      label: 'paid',
      color: 'text-success',
      filterStatus: 'paid',
    },
    {
      value: formatCurrencyMinor(stats.totalOutstanding, currency),
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
    <div className="grid grid-cols-1 gap-1 text-sm text-muted-foreground sm:flex sm:flex-wrap sm:items-center sm:gap-x-1">
      {statItems.map((stat, i) => (
        <span key={stat.label} className="inline-flex items-center">
          {i > 0 && <span className="mx-1.5 hidden sm:inline">·</span>}
          {isClickable ? (
            <button
              onClick={() => onFilterStatus?.(stat.filterStatus)}
              className={cn(
                'inline-flex items-center gap-1 hover:underline underline-offset-2 transition-colors hover:text-foreground',
                stat.color,
              )}
            >
              <span className="font-semibold tabular-nums text-foreground">{stat.value}</span>
              <span>{stat.label}</span>
            </button>
          ) : (
            <span className={cn('inline-flex items-center gap-1', stat.color)}>
              <span className="font-semibold tabular-nums text-foreground">{stat.value}</span>
              <span>{stat.label}</span>
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
