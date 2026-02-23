import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { STALE_STABLE } from '@/config/query-stale-times';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { startOfWeek, subWeeks, format, parseISO, addDays } from 'date-fns';

interface PracticeTrendsChartProps {
  studentId: string;
  targetMinutesPerWeek?: number;
}

export function PracticeTrendsChart({ studentId, targetMinutesPerWeek }: PracticeTrendsChartProps) {
  const { currentOrg } = useOrg();
  const weeksBack = 8;
  const weekStart = startOfWeek(subWeeks(new Date(), weeksBack - 1), { weekStartsOn: 1 });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['practice-trends', studentId, currentOrg?.id, format(weekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practice_logs')
        .select('practice_date, duration_minutes')
        .eq('student_id', studentId)
        .gte('practice_date', format(weekStart, 'yyyy-MM-dd'))
        .order('practice_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId && !!currentOrg?.id,
    staleTime: STALE_STABLE,
  });

  const chartData = useMemo(() => {
    const weeks: { week: string; weekLabel: string; minutes: number }[] = [];

    for (let i = 0; i < weeksBack; i++) {
      const ws = startOfWeek(subWeeks(new Date(), weeksBack - 1 - i), { weekStartsOn: 1 });
      const we = addDays(ws, 6);
      const wsStr = format(ws, 'yyyy-MM-dd');
      const weStr = format(we, 'yyyy-MM-dd');

      const weekMinutes = logs
        .filter(l => l.practice_date >= wsStr && l.practice_date <= weStr)
        .reduce((sum, l) => sum + l.duration_minutes, 0);

      weeks.push({
        week: wsStr,
        weekLabel: format(ws, 'd MMM'),
        minutes: weekMinutes,
      });
    }

    return weeks;
  }, [logs, weeksBack]);

  const hasData = chartData.some(w => w.minutes > 0);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading practice trends...
        </CardContent>
      </Card>
    );
  }

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5" />
            Practice Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No practice data yet. Trends will appear once sessions are logged.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5" />
          Practice Trends
          <span className="text-xs font-normal text-muted-foreground ml-auto">Last 8 weeks</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="weekLabel"
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              label={{ value: 'min', position: 'insideTopLeft', offset: 15, fontSize: 10, className: 'fill-muted-foreground' }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--popover))',
                color: 'hsl(var(--popover-foreground))',
                fontSize: '13px',
              }}
              formatter={(value: number) => [`${value} min`, 'Practice']}
              labelFormatter={(label) => `Week of ${label}`}
            />
            <Bar
              dataKey="minutes"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            {targetMinutesPerWeek && targetMinutesPerWeek > 0 && (
              <ReferenceLine
                y={targetMinutesPerWeek}
                stroke="hsl(var(--destructive))"
                strokeDasharray="6 3"
                label={{
                  value: 'Target',
                  position: 'insideTopRight',
                  fontSize: 11,
                  fill: 'hsl(var(--destructive))',
                }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
