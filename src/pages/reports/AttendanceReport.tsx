import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { usePageMeta } from '@/hooks/usePageMeta';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangeFilter } from '@/components/reports/DateRangeFilter';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReportSkeleton } from '@/components/reports/ReportSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { SortableTableHead } from '@/components/reports/SortableTableHead';
import { ReportPagination, paginateArray } from '@/components/reports/ReportPagination';
import { useSortableTable } from '@/hooks/useSortableTable';
import { useAttendanceReport, exportAttendanceToCSV, type AttendanceStudentRow } from '@/hooks/useAttendanceReport';
import { useOrg } from '@/contexts/OrgContext';
import { useTerms } from '@/hooks/useTerms';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Download, UserCheck, Percent, Users, XCircle, Calendar, Printer } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ─── Sortable fields ─────────────────────────────────────

type SortField = 'studentName' | 'total' | 'present' | 'absent' | 'late' | 'teacherCancelled' | 'studentCancelled' | 'attendanceRate';

const comparators: Record<SortField, (a: AttendanceStudentRow, b: AttendanceStudentRow) => number> = {
  studentName: (a, b) => a.studentName.localeCompare(b.studentName),
  total: (a, b) => a.total - b.total,
  present: (a, b) => a.present - b.present,
  absent: (a, b) => a.absent - b.absent,
  late: (a, b) => a.late - b.late,
  teacherCancelled: (a, b) => a.teacherCancelled - b.teacherCancelled,
  studentCancelled: (a, b) => a.studentCancelled - b.studentCancelled,
  attendanceRate: (a, b) => a.attendanceRate - b.attendanceRate,
};

// ─── Page ────────────────────────────────────────────────

export default function AttendanceReport() {
  usePageMeta('Attendance | LessonLoop', 'Track attendance rates by student, teacher, and period');
  const { currentOrg, currentRole } = useOrg();
  const { toast } = useToast();
  const { data: terms } = useTerms();
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [teacherFilter, setTeacherFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Teacher list for filter
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-list', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('teachers')
        .select('id, display_name')
        .eq('org_id', currentOrg.id)
        .eq('status', 'active')
        .order('display_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrg?.id && isAdmin,
  });

  const { data, isLoading, isFetching, error } = useAttendanceReport(
    startDate,
    endDate,
    teacherFilter !== 'all' ? teacherFilter : null,
    statusFilter !== 'all' ? statusFilter : null,
  );

  const { sorted, sort, toggle } = useSortableTable<AttendanceStudentRow, SortField>(
    data?.students || [],
    'studentName',
    'asc',
    comparators,
  );

  const handleExport = () => {
    if (data && currentOrg) {
      try {
        exportAttendanceToCSV(data, currentOrg.name.replace(/[^a-zA-Z0-9]/g, '_'), isAdmin);
        toast({ title: 'Report exported', description: 'CSV file has been downloaded.' });
      } catch {
        toast({ title: 'Export failed', description: 'Something went wrong.', variant: 'destructive' });
      }
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Attendance Report"
        description="Track attendance rates by student, teacher, and period"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Reports', href: '/reports' },
          { label: 'Attendance' },
        ]}
        actions={
          data && data.summary.totalRecords > 0 && (
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

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        terms={terms}
      />

      {/* Additional filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {isAdmin && (
          <Select value={teacherFilter} onValueChange={setTeacherFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Teachers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teachers</SelectItem>
              {teachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="present">Present</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
            <SelectItem value="late">Late</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && !data ? (
        <ReportSkeleton variant="summary-chart-table" />
      ) : error && !data ? (
        <EmptyState icon={XCircle} title="Error loading report" description={(error as Error).message} />
      ) : !data || data.summary.totalRecords === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No attendance records found"
          description="No attendance data exists for the selected filters. Try adjusting the date range or filters."
        />
      ) : (
        <div className={`transition-opacity duration-300 ${isFetching ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
          {/* Summary Cards */}
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Total Records
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.summary.totalRecords}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Attendance Rate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{data.summary.attendanceRate.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Absence Rate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${data.summary.absenceRate > 10 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {data.summary.absenceRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Cancellation Rate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${data.summary.cancellationRate > 10 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {data.summary.cancellationRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Trend Chart */}
          {data.trend.length > 1 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Attendance Trend</CardTitle>
                <CardDescription>Attendance and absence rates over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.trend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="bucketLabel" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        formatter={(value: number) => `${value.toFixed(1)}%`}
                      />
                      <Legend />
                      <Bar dataKey="attendanceRate" name="Attendance %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="absenceRate" name="Absence %" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Student Table */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance by Student</CardTitle>
              <CardDescription>Click a row to view student details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead label="Student" field="studentName" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} />
                      {isAdmin && <SortableTableHead label="Teacher" field="studentName" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} />}
                      <SortableTableHead label="Total" field="total" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} className="text-right" />
                      <SortableTableHead label="Present" field="present" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} className="text-right" />
                      <SortableTableHead label="Absent" field="absent" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} className="text-right" />
                      <SortableTableHead label="Late" field="late" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} className="text-right" />
                      <SortableTableHead label="T. Cancel" field="teacherCancelled" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} className="text-right" />
                      <SortableTableHead label="S. Cancel" field="studentCancelled" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} className="text-right" />
                      <SortableTableHead label="Rate %" field="attendanceRate" currentField={sort.field} currentDir={sort.dir} onToggle={toggle} className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginateArray(sorted, page).map((row) => (
                      <TableRow key={row.studentId} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <Link to={`/students/${row.studentId}`} className="font-medium text-foreground hover:underline">
                            {row.studentName}
                          </Link>
                        </TableCell>
                        {isAdmin && <TableCell className="text-muted-foreground">{row.teacherName}</TableCell>}
                        <TableCell className="text-right">{row.total}</TableCell>
                        <TableCell className="text-right text-primary">{row.present}</TableCell>
                        <TableCell className="text-right text-destructive">{row.absent}</TableCell>
                        <TableCell className="text-right">{row.late}</TableCell>
                        <TableCell className="text-right">{row.teacherCancelled}</TableCell>
                        <TableCell className="text-right">{row.studentCancelled}</TableCell>
                        <TableCell className="text-right">
                          <span className={row.attendanceRate >= 90 ? 'text-primary font-medium' : row.attendanceRate >= 75 ? '' : 'text-destructive font-medium'}>
                            {row.attendanceRate.toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ReportPagination totalItems={sorted.length} currentPage={page} onPageChange={setPage} />
            </CardContent>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
