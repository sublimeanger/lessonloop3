import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DateRangeFilter } from '@/components/reports/DateRangeFilter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { usePayroll, exportPayrollToCSV } from '@/hooks/usePayroll';
import { useOrg } from '@/contexts/OrgContext';
import { formatCurrency, formatDateUK } from '@/lib/utils';
import { Download, ChevronDown, ChevronRight, Banknote, Clock, Users, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PayrollReport() {
  const { currentOrg, currentRole } = useOrg();
  const { toast } = useToast();
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';
  
  // Default to last month
  const lastMonth = subMonths(new Date(), 1);
  const [startDate, setStartDate] = useState(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = usePayroll(startDate, endDate);

  const toggleTeacher = (teacherId: string) => {
    const newExpanded = new Set(expandedTeachers);
    if (newExpanded.has(teacherId)) {
      newExpanded.delete(teacherId);
    } else {
      newExpanded.add(teacherId);
    }
    setExpandedTeachers(newExpanded);
  };

  const handleExport = () => {
    if (data && currentOrg) {
      try {
        exportPayrollToCSV(data, currentOrg.name.replace(/[^a-zA-Z0-9]/g, '_'), currentOrg.currency_code);
        toast({ title: 'Report exported', description: 'CSV file has been downloaded.' });
      } catch {
        toast({ title: 'Export failed', description: 'Something went wrong. Please try again.', variant: 'destructive' });
      }
    }
  };

  const fmtCurrency = (amount: number) => formatCurrency(amount, currentOrg?.currency_code || 'GBP');

  const getPayRateLabel = (type: string | null, value: number) => {
    switch (type) {
      case 'per_lesson':
        return `${fmtCurrency(value)} per lesson`;
      case 'hourly':
        return `${fmtCurrency(value)}/hr`;
      case 'percentage':
        return `${value}% of revenue`;
      default:
        return 'Not configured';
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Payroll Report"
        description={isAdmin ? "Calculate gross pay for all teachers" : "View your payroll summary"}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Reports', href: '/reports' },
          { label: 'Payroll' },
        ]}
        actions={
          data && data.teachers.length > 0 && (
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          )
        }
      />

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="Error loading payroll"
          description={error.message}
        />
      ) : !data || data.teachers.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="No completed lessons"
          description="There are no completed lessons in the selected date range."
        >
          <Button asChild>
            <Link to="/calendar">Schedule lessons →</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Teachers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.teachers.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Total Hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {data.teachers.reduce((sum, t) => sum + t.totalHours, 0).toFixed(1)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Total Gross Owed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">
                  {fmtCurrency(data.totalGrossOwed)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Teacher Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Teacher Breakdown</CardTitle>
              <CardDescription>
                {format(new Date(startDate), 'd MMM yyyy')} – {format(new Date(endDate), 'd MMM yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.teachers.map((teacher) => (
                  <Collapsible
                    key={teacher.teacherId}
                    open={expandedTeachers.has(teacher.teacherId)}
                    onOpenChange={() => toggleTeacher(teacher.teacherId)}
                  >
                    <div className="rounded-lg border bg-card">
                      <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-muted/50">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                            {teacher.teacherName[0]}
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{teacher.teacherName}</p>
                            <p className="text-sm text-muted-foreground">
                              {getPayRateLabel(teacher.payRateType, teacher.payRateValue)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Lessons</p>
                            <p className="font-medium">{teacher.completedLessons}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Hours</p>
                            <p className="font-medium">{teacher.totalHours}</p>
                          </div>
                          <div className="text-right min-w-[100px]">
                            <p className="text-sm text-muted-foreground">Gross Owed</p>
                            <p className="font-bold text-primary">{fmtCurrency(teacher.grossOwed)}</p>
                          </div>
                          {expandedTeachers.has(teacher.teacherId) ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t px-4 pb-4 pt-2">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Lesson</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Duration</TableHead>
                                <TableHead className="text-right">Pay</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {teacher.lessons.map((lesson) => (
                                <TableRow key={lesson.id}>
                                  <TableCell className="font-medium">{lesson.title}</TableCell>
                                  <TableCell>
                                    {format(new Date(lesson.startAt), 'd MMM yyyy, HH:mm')}
                                  </TableCell>
                                  <TableCell className="text-right">{lesson.durationMins} min</TableCell>
                                  <TableCell className="text-right font-medium">
                                    {fmtCurrency(lesson.calculatedPay)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </AppLayout>
  );
}
