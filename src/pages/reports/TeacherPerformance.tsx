import { useState } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangeFilter } from '@/components/reports/DateRangeFilter';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { ReportSkeleton } from '@/components/reports/ReportSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { SortableTableHead } from '@/components/reports/SortableTableHead';
import { ReportPagination, paginateArray } from '@/components/reports/ReportPagination';
import { useSortableTable } from '@/hooks/useSortableTable';
import { useOrg } from '@/contexts/OrgContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTerms } from '@/hooks/useTerms';
import { Download, Printer, Users, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, XCircle, Calendar, Percent, DollarSign } from 'lucide-react';
import { useTeacherPerformanceReport, exportTeacherPerformanceToCSV, TeacherPerformance } from '@/hooks/useTeacherPerformance';
import { currencySymbol } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';

// ==================== CHART COLORS ====================
const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
const COLOR_GOOD = 'hsl(var(--success))';
const COLOR_BAD = 'hsl(var(--destructive))';
const COLOR_NEUTRAL = 'hsl(var(--muted-foreground))';

// ==================== MAIN PAGE ====================

export default function TeacherPerformanceReport() {
  usePageMeta('Teacher Performance | LessonLoop', 'Analyse teacher retention, cancellations, and revenue');
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { data: terms } = useTerms();
  const { hasAccess } = useFeatureGate('teacher_performance');

  const lastMonth = subMonths(new Date(), 1);
  const [startDate, setStartDate] = useState(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));

  const { data, isLoading, isFetching, error } = useTeacherPerformanceReport(startDate, endDate);

  const currCode = currentOrg?.currency_code || 'GBP';
  const sym = currencySymbol(currCode);

  const handleExport = () => {
    if (data && currentOrg) {
      try {
        exportTeacherPerformanceToCSV(data, currentOrg.name.replace(/[^a-zA-Z0-9]/g, '_'), currCode);
        toast({ title: 'Report exported', description: 'CSV file has been downloaded.' });
      } catch {
        toast({ title: 'Export failed', description: 'Something went wrong. Please try again.', variant: 'destructive' });
      }
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Teacher Performance"
        description="Retention, cancellations, and revenue benchmarked across your team"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Reports', href: '/reports' },
          { label: 'Teacher Performance' },
        ]}
        actions={
          data && data.totalTeachers > 0 && (
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
              <Button onClick={() => window.print()} variant="outline" className="gap-2 print:hidden">
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button onClick={handleExport} variant="outline" className="gap-2 print:hidden">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          )
        }
      />

      <FeatureGate feature="teacher_performance">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          terms={terms}
        />

        {isLoading && !data ? (
          <ReportSkeleton variant="summary-chart-table" />
        ) : error && !data ? (
          <EmptyState icon={XCircle} title="Error loading report" description={error.message} />
        ) : !data || data.totalTeachers === 0 ? (
          <EmptyState
            icon={Users}
            title="No teacher data found"
            description="No lessons with assigned teachers were found in this date range. Try selecting a different period."
          />
        ) : (
          <div className={`transition-opacity duration-300 ${isFetching ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
            {data.warnings?.map((w, i) => (
              <Alert key={i} variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{w}</AlertDescription>
              </Alert>
            ))}

            {/* Summary Cards */}
            <div className="mb-6 grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Total Teachers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{data.totalTeachers}</p>
                </CardContent>
              </Card>
              <Card className={data.orgAvgCancellationRate > 10 ? 'border-destructive/50' : ''}>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Avg Cancellation Rate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${data.orgAvgCancellationRate > 10 ? 'text-destructive' : data.orgAvgCancellationRate > 5 ? 'text-warning' : 'text-success'}`}>
                    {data.orgAvgCancellationRate.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Avg Retention Rate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${data.orgAvgRetentionRate >= 80 ? 'text-success' : data.orgAvgRetentionRate >= 60 ? 'text-warning' : 'text-destructive'}`}>
                    {data.orgAvgRetentionRate.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Total Revenue
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{sym}{data.totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
                </CardContent>
              </Card>
            </div>

            {/* Teacher Comparison Table */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Teacher Comparison</CardTitle>
                <CardDescription>Performance metrics benchmarked against the org average</CardDescription>
              </CardHeader>
              <CardContent>
                <TeacherComparisonTable teachers={data.teachers} sym={sym} />
              </CardContent>
            </Card>

            {/* Charts Section */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Cancellation Rate Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Cancellation Rate by Teacher</CardTitle>
                  <CardDescription>Compared to org average of {data.orgAvgCancellationRate.toFixed(1)}%</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.teachers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">No data available.</p>
                  ) : (
                    <div className="h-[300px]" role="img" aria-label="Bar chart showing cancellation rate by teacher">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.teachers.map(t => ({
                            name: t.teacher_name.length > 15 ? t.teacher_name.slice(0, 13) + '...' : t.teacher_name,
                            fullName: t.teacher_name,
                            rate: Math.round(t.cancellation_rate * 10) / 10,
                          }))}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: isMobile ? 60 : 100, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" unit="%" />
                          <YAxis type="category" dataKey="name" width={isMobile ? 55 : 95} tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(value: number) => [`${value}%`, 'Cancellation Rate']}
                            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                          />
                          <ReferenceLine x={data.orgAvgCancellationRate} stroke={COLOR_NEUTRAL} strokeDasharray="5 5" label={{ value: 'Avg', position: 'top', fontSize: 11 }} />
                          <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                            {data.teachers.map((t, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={t.cancellation_rate > data.orgAvgCancellationRate ? COLOR_BAD : COLOR_GOOD}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Revenue Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Teacher</CardTitle>
                  <CardDescription>Total revenue generated per teacher ({sym})</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.teachers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">No data available.</p>
                  ) : (
                    <div className="h-[300px]" role="img" aria-label="Bar chart showing revenue by teacher">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.teachers.map((t, i) => ({
                            name: t.teacher_name.length > 15 ? t.teacher_name.slice(0, 13) + '...' : t.teacher_name,
                            fullName: t.teacher_name,
                            revenue: Math.round(t.revenue_generated * 100) / 100,
                          }))}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: isMobile ? 60 : 100, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis type="category" dataKey="name" width={isMobile ? 55 : 95} tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(value: number) => [`${sym}${value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, 'Revenue']}
                            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                          />
                          <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                            {data.teachers.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </FeatureGate>
    </AppLayout>
  );
}

// ==================== BENCHMARK INDICATOR ====================

function BenchmarkIndicator({
  delta,
  invertColor = false,
}: {
  delta: number;
  /** When true, positive delta is bad (e.g. cancellation rate above avg) */
  invertColor?: boolean;
}) {
  const threshold = 2; // within 2% is "neutral"

  if (Math.abs(delta) <= threshold) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        avg
      </span>
    );
  }

  const isAbove = delta > 0;
  const isGood = invertColor ? !isAbove : isAbove;

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${isGood ? 'text-success' : 'text-destructive'}`}>
      {isAbove ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {isAbove ? 'above' : 'below'} avg
    </span>
  );
}

// ==================== TEACHER COMPARISON TABLE ====================

type TeacherSortField = 'teacher_name' | 'total_lessons' | 'total_hours' | 'cancellation_rate' | 'active_student_count' | 'retention_rate' | 'revenue_generated' | 'revenue_per_hour';

const teacherComparators: Record<TeacherSortField, (a: TeacherPerformance, b: TeacherPerformance) => number> = {
  teacher_name: (a, b) => a.teacher_name.localeCompare(b.teacher_name),
  total_lessons: (a, b) => a.total_lessons - b.total_lessons,
  total_hours: (a, b) => a.total_hours - b.total_hours,
  cancellation_rate: (a, b) => a.cancellation_rate - b.cancellation_rate,
  active_student_count: (a, b) => a.active_student_count - b.active_student_count,
  retention_rate: (a, b) => a.retention_rate - b.retention_rate,
  revenue_generated: (a, b) => a.revenue_generated - b.revenue_generated,
  revenue_per_hour: (a, b) => a.revenue_per_hour - b.revenue_per_hour,
};

function TeacherComparisonTable({ teachers, sym }: { teachers: TeacherPerformance[]; sym: string }) {
  const [page, setPage] = useState(1);
  const { sorted, sort, toggle } = useSortableTable<TeacherPerformance, TeacherSortField>(
    teachers, 'teacher_name', 'asc', teacherComparators
  );

  return (
    <>
      <div className="overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <SortableTableHead label="Teacher" field="teacher_name" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} />
              <SortableTableHead label="Lessons" field="total_lessons" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} className="text-right" />
              <SortableTableHead label="Hours" field="total_hours" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} className="text-right" />
              <SortableTableHead label="Cancel %" field="cancellation_rate" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} className="text-right" />
              <SortableTableHead label="Students" field="active_student_count" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} className="text-right" />
              <SortableTableHead label="Retention %" field="retention_rate" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} className="text-right" />
              <SortableTableHead label="Revenue" field="revenue_generated" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} className="text-right" />
              <SortableTableHead label="Rev/hr" field="revenue_per_hour" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginateArray(sorted, page).map((t) => (
              <TableRow key={t.teacher_id}>
                <TableCell className="font-medium">{t.teacher_name}</TableCell>
                <TableCell className="text-right">{t.total_lessons}</TableCell>
                <TableCell className="text-right">{t.total_hours.toFixed(1)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className={t.cancellation_rate > 10 ? 'text-destructive font-medium' : t.cancellation_rate > 5 ? 'text-warning' : 'text-success'}>
                      {t.cancellation_rate.toFixed(1)}%
                    </span>
                    <BenchmarkIndicator delta={t.cancellation_rate_vs_avg} invertColor />
                  </div>
                </TableCell>
                <TableCell className="text-right">{t.active_student_count}</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className={t.retention_rate >= 80 ? 'text-success' : t.retention_rate >= 60 ? 'text-warning' : 'text-destructive'}>
                      {t.retention_rate.toFixed(1)}%
                    </span>
                    <BenchmarkIndicator delta={t.retention_rate_vs_avg} />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span>{sym}{t.revenue_generated.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span>{sym}{t.revenue_per_hour.toFixed(2)}</span>
                    <BenchmarkIndicator delta={t.revenue_per_hour_vs_avg} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ReportPagination totalItems={sorted.length} currentPage={page} onPageChange={setPage} />
    </>
  );
}
