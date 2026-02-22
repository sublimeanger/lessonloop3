import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangeFilter } from '@/components/reports/DateRangeFilter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ReportSkeleton } from '@/components/reports/ReportSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { SortableTableHead } from '@/components/reports/SortableTableHead';
import { useCancellationReport, exportCancellationToCSV } from '@/hooks/useReports';
import { ReportPagination, paginateArray } from '@/components/reports/ReportPagination';
import { useSortableTable } from '@/hooks/useSortableTable';
import { useOrg } from '@/contexts/OrgContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTerms } from '@/hooks/useTerms';
import { Download, XCircle, CheckCircle, Calendar, Percent, AlertTriangle, Printer } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useToast } from '@/hooks/use-toast';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export default function CancellationReport() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { data: terms } = useTerms();
  
  const lastMonth = subMonths(new Date(), 1);
  const [startDate, setStartDate] = useState(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));

  const { data, isLoading, error } = useCancellationReport(startDate, endDate);

  const handleExport = () => {
    if (data && currentOrg) {
      try {
        exportCancellationToCSV(data, currentOrg.name.replace(/[^a-zA-Z0-9]/g, '_'));
        toast({ title: 'Report exported', description: 'CSV file has been downloaded.' });
      } catch {
        toast({ title: 'Export failed', description: 'Something went wrong. Please try again.', variant: 'destructive' });
      }
    }
  };

  const pieData = data ? [
    { name: 'Completed', value: data.totalCompleted },
    { name: 'Cancelled', value: data.totalCancelled },
  ].filter(d => d.value > 0) : [];

  return (
    <AppLayout>
      <PageHeader
        title="Cancellation Rate"
        description="Analyse lesson cancellations and patterns"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Reports', href: '/reports' },
          { label: 'Cancellations' },
        ]}
        actions={
          data && data.totalScheduled > 0 && (
            <div className="flex items-center gap-2">
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

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        terms={terms}
      />

      {isLoading ? (
        <ReportSkeleton variant="summary-chart-table" />
      ) : error ? (
        <EmptyState icon={XCircle} title="Error loading report" description={error.message} />
      ) : !data || data.totalScheduled === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No lessons found"
          description="There are no lessons in the selected date range."
        >
          <Button asChild>
            <Link to="/calendar">Schedule a lesson →</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
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
                  <Calendar className="h-4 w-4" />
                  Total Scheduled
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.totalScheduled}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Completed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{data.totalCompleted}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Cancelled
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">{data.totalCancelled}</p>
              </CardContent>
            </Card>
            <Card className={data.cancellationRate > 10 ? 'border-destructive/50' : ''}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Cancellation Rate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${data.cancellationRate > 10 ? 'text-destructive' : data.cancellationRate > 5 ? 'text-warning' : 'text-success'}`}>
                  {data.cancellationRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Completion vs Cancellation</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.every(d => d.value === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-12">All values are zero for this period.</p>
                ) : (
                  <>
                    <div className="h-[250px]" role="img" aria-label="Pie chart showing completion versus cancellation ratio">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={isMobile ? 40 : 60}
                            outerRadius={isMobile ? 70 : 90}
                            paddingAngle={2}
                            dataKey="value"
                            label={isMobile ? false : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {pieData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <table className="sr-only">
                      <caption>Completion vs cancellation breakdown</caption>
                      <thead><tr><th>Status</th><th>Count</th></tr></thead>
                      <tbody>
                        {pieData.map(d => (
                          <tr key={d.name}><td>{d.name}</td><td>{d.value}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </CardContent>
            </Card>

            {/* By Reason */}
            <Card>
              <CardHeader>
                <CardTitle>Cancellation Reasons</CardTitle>
                <CardDescription>Why lessons were cancelled</CardDescription>
              </CardHeader>
              <CardContent>
                {data.byReason.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No cancellation reason data available
                  </p>
                ) : (
                  <div className="space-y-4">
                    {data.byReason.map((reason) => (
                      <div key={reason.reason}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{reason.reason}</span>
                          <span className="text-muted-foreground">{reason.count}</span>
                        </div>
                        <Progress 
                          value={(reason.count / data.totalCancelled) * 100} 
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* By Teacher */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Cancellation Rate by Teacher</CardTitle>
              <CardDescription>Compare cancellation rates across your team</CardDescription>
            </CardHeader>
            <CardContent>
              <CancellationByTeacherTable teachers={data.byTeacher} />
            </CardContent>
          </Card>
        </>
      )}
    </AppLayout>
  );
}

type TeacherCancellation = { teacherName: string; total: number; cancelled: number; rate: number };
type CancellationSortField = 'teacherName' | 'total' | 'cancelled' | 'rate';

const cancellationComparators: Record<CancellationSortField, (a: TeacherCancellation, b: TeacherCancellation) => number> = {
  teacherName: (a, b) => a.teacherName.localeCompare(b.teacherName),
  total: (a, b) => a.total - b.total,
  cancelled: (a, b) => a.cancelled - b.cancelled,
  rate: (a, b) => a.rate - b.rate,
};

function CancellationByTeacherTable({ teachers }: { teachers: TeacherCancellation[] }) {
  const [page, setPage] = useState(1);
  const { sorted, sort, toggle } = useSortableTable<TeacherCancellation, CancellationSortField>(
    teachers, 'teacherName', 'asc', cancellationComparators
  );

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead label="Teacher" field="teacherName" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} />
            <SortableTableHead label="Total Lessons" field="total" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} className="text-right" />
            <SortableTableHead label="Cancelled" field="cancelled" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} className="text-right" />
            <SortableTableHead label="Rate" field="rate" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginateArray(sorted, page).map((teacher) => (
            <TableRow key={teacher.teacherName}>
              <TableCell className="font-medium">{teacher.teacherName}</TableCell>
              <TableCell className="text-right">{teacher.total}</TableCell>
              <TableCell className="text-right text-destructive">{teacher.cancelled}</TableCell>
              <TableCell className="text-right">
                <span className={teacher.rate > 10 ? 'text-destructive font-medium' : teacher.rate > 5 ? 'text-warning' : 'text-success'}>
                  {teacher.rate.toFixed(1)}%
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ReportPagination totalItems={sorted.length} currentPage={page} onPageChange={setPage} />
    </>
  );
}
