import { Card, CardContent } from '@/components/ui/card';
import { useInvoiceStats } from '@/hooks/useInvoices';
import { useOrg } from '@/contexts/OrgContext';
import { AlertCircle, Clock, FileText, CheckCircle2 } from 'lucide-react';

function formatCurrency(amountMinor: number, currencyCode: string = 'GBP') {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}

export function InvoiceStatsWidget() {
  const { data: stats, isLoading } = useInvoiceStats();
  const { currentOrg } = useOrg();

  if (isLoading || !stats) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-20 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const currency = currentOrg?.currency_code || 'GBP';

  const statCards = [
    {
      label: 'Outstanding',
      value: formatCurrency(stats.totalOutstanding, currency),
      subtext: `${stats.sentCount + stats.overdueCount} invoices`,
      icon: Clock,
      className: 'text-warning',
    },
    {
      label: 'Overdue',
      value: formatCurrency(stats.overdue, currency),
      subtext: `${stats.overdueCount} invoices`,
      icon: AlertCircle,
      className: 'text-destructive',
    },
    {
      label: 'Drafts',
      value: formatCurrency(stats.draft, currency),
      subtext: `${stats.draftCount} invoices`,
      icon: FileText,
      className: 'text-muted-foreground',
    },
    {
      label: 'Paid (YTD)',
      value: formatCurrency(stats.paid, currency),
      subtext: `${stats.paidCount} invoices`,
      icon: CheckCircle2,
      className: 'text-success',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {statCards.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.className}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.subtext}</p>
              </div>
              <stat.icon className={`h-5 w-5 ${stat.className}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
