import { useInvoiceStats } from '@/hooks/useInvoices';
import { useOrg } from '@/contexts/OrgContext';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatCurrencyMinor } from '@/lib/utils';
import { Receipt, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

interface InvoiceStatsWidgetProps {
  onFilterStatus?: (status: string) => void;
}

export function InvoiceStatsWidget({ onFilterStatus }: InvoiceStatsWidgetProps = {}) {
  const { data: stats, isLoading } = useInvoiceStats();
  const { currentOrg } = useOrg();

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  const currency = currentOrg?.currency_code || 'GBP';
  const isClickable = !!onFilterStatus;

  const statItems = [
    {
      value: formatCurrencyMinor(stats.totalOutstanding + stats.paid, currency),
      label: 'Total',
      icon: Receipt,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      filterStatus: 'all',
    },
    {
      value: formatCurrencyMinor(stats.paid, currency),
      label: 'Collected',
      icon: CheckCircle2,
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
      filterStatus: 'paid',
    },
    {
      value: formatCurrencyMinor(stats.totalOutstanding, currency),
      label: 'Outstanding',
      icon: Clock,
      iconBg: 'bg-warning/10',
      iconColor: 'text-warning',
      filterStatus: 'sent',
    },
    ...(stats.overdueCount > 0
      ? [
          {
            value: String(stats.overdueCount),
            label: 'Overdue',
            icon: AlertTriangle,
            iconBg: 'bg-destructive/10',
            iconColor: 'text-destructive',
            filterStatus: 'overdue',
          },
        ]
      : []),
  ];

  return (
    <div className={cn('grid gap-3', statItems.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3')}>
      {statItems.map((stat) => {
        const Wrapper = isClickable ? 'button' : 'div';
        return (
          <Wrapper
            key={stat.label}
            onClick={isClickable ? () => onFilterStatus?.(stat.filterStatus) : undefined}
            className={cn(
              'flex items-start gap-3 rounded-xl border bg-card p-3 sm:p-4 transition-all shadow-card min-h-[4.5rem]',
              isClickable && 'cursor-pointer hover:shadow-card-hover hover:border-primary/20 active:scale-[0.98]',
            )}
          >
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', stat.iconBg)}>
              <stat.icon className={cn('h-4 w-4', stat.iconColor)} />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-lg font-semibold tabular-nums truncate">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
}
