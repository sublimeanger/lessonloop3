import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, TrendingUp, ArrowDownToLine, Receipt, RotateCcw, Calendar } from 'lucide-react';
import { useConnectRevenue } from '@/hooks/useConnectRevenue';
import { format, subDays } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface RevenueDashboardProps {
  orgId: string | undefined;
  currencyCode?: string;
}

const PERIOD_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
] as const;

export function RevenueDashboard({ orgId, currencyCode = 'GBP' }: RevenueDashboardProps) {
  const [period, setPeriod] = useState(30);

  const now = new Date();
  const dateRange = {
    start: subDays(now, period).toISOString().split('T')[0],
    end: now.toISOString().split('T')[0],
  };

  const { data, isLoading, isError } = useConnectRevenue(orgId, dateRange);

  const formatAmount = (amountMinor: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currencyCode,
    }).format(amountMinor / 100);
  };

  const getPayoutStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-success/10 text-success">Paid</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'in_transit':
        return <Badge variant="outline">In Transit</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Build chart data from transactions (group by day)
  const chartData = (() => {
    if (!data?.transactions) return [];

    const dailyTotals = new Map<string, number>();
    for (const txn of data.transactions) {
      if (txn.type === 'charge' || txn.type === 'payment') {
        const day = format(new Date(txn.created * 1000), 'dd MMM');
        dailyTotals.set(day, (dailyTotals.get(day) || 0) + txn.net);
      }
    }

    return Array.from(dailyTotals.entries())
      .map(([date, amount]) => ({ date, amount: amount / 100 }))
      .reverse();
  })();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Unable to load revenue data. Ensure your Stripe account is active.
          </p>
        </CardContent>
      </Card>
    );
  }

  const availableBalance = data.balance.available[0]?.amount || 0;
  const pendingBalance = data.balance.pending[0]?.amount || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Revenue Overview
            </CardTitle>
            <CardDescription>
              Your Stripe Connect earnings and payouts
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {PERIOD_OPTIONS.map((opt) => (
              <Button
                key={opt.days}
                variant={period === opt.days ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(opt.days)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Balance Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
            <p className="text-2xl font-bold text-success">{formatAmount(availableBalance)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-1">Pending</p>
            <p className="text-2xl font-bold">{formatAmount(pendingBalance)}</p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <Receipt className="h-3 w-3" />
              Revenue
            </div>
            <p className="font-semibold text-sm">{formatAmount(data.summary.totalRevenue)}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <ArrowDownToLine className="h-3 w-3" />
              Fees
            </div>
            <p className="font-semibold text-sm">{formatAmount(data.summary.totalFees)}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <RotateCcw className="h-3 w-3" />
              Refunds
            </div>
            <p className="font-semibold text-sm">{formatAmount(data.summary.totalRefunds)}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" />
              Net
            </div>
            <p className="font-semibold text-sm text-success">{formatAmount(data.summary.totalNet)}</p>
          </div>
        </div>

        {/* Earnings Chart */}
        {chartData.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-3">Daily Net Revenue</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <Tooltip
                      formatter={(value: number) => formatAmount(Math.round(value * 100))}
                      labelClassName="text-sm"
                    />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* Recent Payouts */}
        {data.payouts.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-3">Recent Payouts</p>
              <div className="space-y-2">
                {data.payouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{formatAmount(payout.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          Arrives {format(new Date(payout.arrival_date * 1000), 'dd MMM yyyy')}
                        </p>
                      </div>
                    </div>
                    {getPayoutStatusBadge(payout.status)}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Recent Transactions */}
        {data.transactions.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-3">
                Recent Transactions ({data.summary.transactionCount})
              </p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {data.transactions.slice(0, 20).map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between py-2 text-sm border-b last:border-b-0"
                  >
                    <div>
                      <p className="truncate max-w-[200px]">
                        {txn.description || txn.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(txn.created * 1000), 'dd MMM yyyy HH:mm')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={txn.amount < 0 ? 'text-destructive' : 'font-medium'}>
                        {txn.amount < 0 ? '-' : ''}{formatAmount(Math.abs(txn.amount))}
                      </p>
                      {txn.fee > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Fee: {formatAmount(txn.fee)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {data.transactions.length === 0 && chartData.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              No transactions in this period. Revenue will appear here once parents start paying invoices.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
