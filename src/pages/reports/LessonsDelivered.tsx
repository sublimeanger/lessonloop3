import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangeFilter } from '@/components/reports/DateRangeFilter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useLessonsDeliveredReport, exportLessonsDeliveredToCSV } from '@/hooks/useReports';
import { useOrg } from '@/contexts/OrgContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Download, Calendar, Clock, MapPin, Users, XCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useToast } from '@/hooks/use-toast';

export default function LessonsDeliveredReport() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const lastMonth = subMonths(new Date(), 1);
  const [startDate, setStartDate] = useState(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));

  const { data, isLoading, error } = useLessonsDeliveredReport(startDate, endDate);

  const handleExport = () => {
    if (data && currentOrg) {
      try {
        exportLessonsDeliveredToCSV(data, currentOrg.name.replace(/[^a-zA-Z0-9]/g, '_'));
        toast({ title: 'Report exported', description: 'CSV file has been downloaded.' });
      } catch {
        toast({ title: 'Export failed', description: 'Something went wrong. Please try again.', variant: 'destructive' });
      }
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Lessons Delivered"
        description="Analyse lessons by teacher and location"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Reports', href: '/reports' },
          { label: 'Lessons Delivered' },
        ]}
        actions={
          data && (data.byTeacher.length > 0 || data.byLocation.length > 0) && (
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
        <EmptyState icon={Calendar} title="Error loading report" description={error.message} />
      ) : !data || (data.byTeacher.length === 0 && data.byLocation.length === 0) ? (
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
          {/* Summary Cards */}
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
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
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Total Hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{(data.totalMinutes / 60).toFixed(1)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Teachers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.byTeacher.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs for By Teacher / By Location */}
          <Tabs defaultValue="teacher" className="space-y-4">
            <TabsList>
              <TabsTrigger value="teacher" className="gap-2">
                <Users className="h-4 w-4" />
                By Teacher
              </TabsTrigger>
              <TabsTrigger value="location" className="gap-2">
                <MapPin className="h-4 w-4" />
                By Location
              </TabsTrigger>
            </TabsList>

            <TabsContent value="teacher">
              {/* Teacher Chart */}
              {data.byTeacher.length > 0 && (
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle>Lessons by Teacher</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.byTeacher} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" />
                          <YAxis dataKey="teacherName" type="category" width={isMobile ? 80 : 120} className="text-xs" tick={{ fontSize: isMobile ? 11 : 12 }} tickFormatter={(v: string) => isMobile && v.length > 15 ? v.slice(0, 15) + '…' : v} />
                          <Tooltip />
                          <Bar dataKey="completedLessons" fill="hsl(var(--primary))" name="Completed" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Teacher Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Teacher Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher</TableHead>
                        <TableHead className="text-right">Completed</TableHead>
                        <TableHead className="text-right">Cancelled</TableHead>
                        <TableHead className="text-right">Total Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byTeacher.map((teacher) => (
                        <TableRow key={teacher.teacherId}>
                          <TableCell className="font-medium">{teacher.teacherName}</TableCell>
                          <TableCell className="text-right">{teacher.completedLessons}</TableCell>
                          <TableCell className="text-right text-destructive">{teacher.cancelledLessons}</TableCell>
                          <TableCell className="text-right">{(teacher.totalMinutes / 60).toFixed(1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="location">
              {/* Location Chart */}
              {data.byLocation.length > 0 && (
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle>Lessons by Location</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.byLocation} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" />
                          <YAxis dataKey="locationName" type="category" width={isMobile ? 80 : 150} className="text-xs" tick={{ fontSize: isMobile ? 11 : 12 }} tickFormatter={(v: string) => isMobile && v.length > 15 ? v.slice(0, 15) + '…' : v} />
                          <Tooltip />
                          <Bar dataKey="completedLessons" fill="hsl(var(--chart-2))" name="Completed" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Location Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Location Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Completed</TableHead>
                        <TableHead className="text-right">Total Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byLocation.map((loc) => (
                        <TableRow key={loc.locationId || 'online'}>
                          <TableCell className="font-medium">{loc.locationName}</TableCell>
                          <TableCell className="text-right">{loc.completedLessons}</TableCell>
                          <TableCell className="text-right">{(loc.totalMinutes / 60).toFixed(1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </AppLayout>
  );
}
