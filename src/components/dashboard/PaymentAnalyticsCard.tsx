import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, PoundSterling, Clock, Percent, CreditCard } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePaymentAnalytics } from '@/hooks/usePaymentAnalytics';
import { useOrg } from '@/contexts/OrgContext';
import { formatCurrencyMinor, currencySymbol } from '@/lib/utils';

const METHOD_COLORS: Record<string, string> = {
  card: '#2563eb',
  cash: '#16a34a',
  bacs_debit: '#7c3aed',
  bank_transfer: '#7c3aed',
  manual: '#f59e0b',
  stripe: '#635bff',
  other: '#94a3b8',
};

export function PaymentAnalyticsCard() {
  const { data, isLoading } = usePaymentAnalytics();
  const { currentOrg } = useOrg();
  const currency = currentOrg?.currency_code || 'GBP';
  const sym = currencySymbol(currency);

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <PoundSterling className="h-4 w-4" />
            Payment Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const formatYAxis = (value: number) => {
    if (value >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${sym}${(value / 1_000).toFixed(0)}k`;
    return `${sym}${value}`;
  };

  // Prepare chart data — convert minor to major units for display
  const chartData = data.monthlyTrend.map((m) => ({
    ...m,
    amount: m.amountMinor / 100,
  }));

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <PoundSterling className="h-4 w-4" />
          Payment Analytics
        </CardTitle>
        <CardDescription>Last 12 months overview</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stat Tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat
            label="Collected"
            value={formatCurrencyMinor(data.totalCollectedMinor, currency)}
            icon={<TrendingUp className="h-3.5 w-3.5 text-success" />}
          />
          <MiniStat
            label="Outstanding"
            value={formatCurrencyMinor(data.outstandingMinor, currency)}
            icon={<TrendingDown className="h-3.5 w-3.5 text-warning" />}
          />
          <MiniStat
            label="Collection Rate"
            value={`${data.collectionRate}%`}
            icon={<Percent className="h-3.5 w-3.5 text-primary" />}
          />
          <MiniStat
            label="Avg. Days to Pay"
            value={`${data.avgDaysToPayment}d`}
            icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />}
          />
        </div>

        {/* Monthly Revenue Chart */}
        {chartData.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-3">Monthly Collections</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="monthLabel"
                    className="text-xs"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={formatYAxis}
                    className="text-xs"
                    tick={{ fontSize: 11 }}
                    width={50}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      formatCurrencyMinor(Math.round(value * 100), currency),
                      'Collected',
                    ]}
                    labelFormatter={(label) => label}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--card))',
                      fontSize: '13px',
                    }}
                  />
                  <Bar
                    dataKey="amount"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Payment Method Breakdown */}
        {data.methodBreakdown.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-3">Payment Methods</p>
            <div className="space-y-2">
              {data.methodBreakdown.map((m) => (
                <div key={m.method} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-28 shrink-0">
                    <CreditCard
                      className="h-3.5 w-3.5"
                      style={{ color: METHOD_COLORS[m.method] || METHOD_COLORS.other }}
                    />
                    <span className="text-xs font-medium truncate">{m.label}</span>
                  </div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${m.percentage}%`,
                        backgroundColor: METHOD_COLORS[m.method] || METHOD_COLORS.other,
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-16 text-right tabular-nums">
                    {m.percentage}% ({m.count})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3 space-y-1">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
