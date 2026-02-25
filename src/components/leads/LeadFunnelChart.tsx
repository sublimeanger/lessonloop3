import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingDown } from 'lucide-react';
import { useLeadFunnelStats, type FunnelStageData } from '@/hooks/useLeadAnalytics';
import { STAGE_COLORS, type LeadStage } from '@/hooks/useLeads';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LeadFunnelChartProps {
  data?: FunnelStageData[];
  startDate?: string;
  endDate?: string;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface FunnelTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: FunnelStageData }>;
}

function FunnelTooltip({ active, payload }: FunnelTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md">
      <p className="text-sm font-medium">{data.label}</p>
      <p className="text-sm text-muted-foreground">
        {data.count} lead{data.count !== 1 ? 's' : ''}
      </p>
      {data.conversionRate !== null && (
        <p className="text-xs text-muted-foreground mt-0.5">
          {data.conversionRate}% conversion from previous stage
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversion arrow between stages
// ---------------------------------------------------------------------------

function ConversionIndicator({ rate }: { rate: number | null }) {
  if (rate === null) return null;

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <TrendingDown className="h-3 w-3" />
      <span className="tabular-nums">{rate}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function LeadFunnelChart({ data: externalData, startDate, endDate }: LeadFunnelChartProps) {
  const { data: fetchedData, isLoading } = useLeadFunnelStats(startDate, endDate);
  const funnelData = externalData || fetchedData;

  const chartData = useMemo(() => {
    if (!funnelData) return [];
    return funnelData.map((d) => ({
      ...d,
      fill: STAGE_COLORS[d.stage as LeadStage] || '#6b7280',
    }));
  }, [funnelData]);

  const totalLeads = useMemo(
    () => chartData.reduce((sum, d) => sum + d.count, 0),
    [chartData],
  );

  const maxCount = useMemo(
    () => Math.max(...chartData.map((d) => d.count), 1),
    [chartData],
  );

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Lead Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!funnelData || totalLeads === 0) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Lead Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No leads to display. Create your first lead to see the pipeline.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Lead Pipeline</CardTitle>
          <Badge variant="secondary" className="tabular-nums">
            {totalLeads} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Recharts horizontal bar chart */}
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, maxCount]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={110}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<FunnelTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.stage}
                    fill={entry.fill}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion rate indicators below the chart */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
          {chartData.map((d, idx) => (
            <div key={d.stage} className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: d.fill }}
              />
              <span className="text-xs font-medium">{d.label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                ({d.count})
              </span>
              {idx < chartData.length - 1 && d.conversionRate !== null && chartData[idx + 1]?.conversionRate !== null && (
                <ConversionIndicator rate={chartData[idx + 1].conversionRate} />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
