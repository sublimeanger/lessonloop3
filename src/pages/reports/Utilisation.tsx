import { useState, useMemo } from 'react';
import { format, subMonths, startOfMonth, endOfMonth, differenceInMinutes, parseISO } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { Download, MapPin, Clock, TrendingUp, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Configurable working hours per day (8am to 8pm = 12 hours)
const WORKING_HOURS_PER_DAY = 12;

interface RoomUtilisationData {
  roomId: string;
  roomName: string;
  locationName: string;
  capacity: number | null;
  bookedMinutes: number;
  availableMinutes: number;
  utilisationPercent: number;
  lessonCount: number;
}

interface UtilisationSummary {
  rooms: RoomUtilisationData[];
  totalBookedMinutes: number;
  totalAvailableMinutes: number;
  averageUtilisation: number;
  mostUsedRoom: RoomUtilisationData | null;
  leastUsedRoom: RoomUtilisationData | null;
}

function useUtilisationReport(startDate: string, endDate: string) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['utilisation-report', currentOrg?.id, startDate, endDate],
    queryFn: async (): Promise<UtilisationSummary> => {
      if (!currentOrg?.id) throw new Error('No organisation');

      // Fetch all rooms with their locations
      const { data: rooms, error: roomsError } = await supabase
        .from('rooms')
        .select('id, name, capacity, location:locations(name)')
        .eq('org_id', currentOrg.id);

      if (roomsError) throw roomsError;
      if (!rooms || rooms.length === 0) {
        return {
          rooms: [],
          totalBookedMinutes: 0,
          totalAvailableMinutes: 0,
          averageUtilisation: 0,
          mostUsedRoom: null,
          leastUsedRoom: null,
        };
      }

      // Fetch all lessons in rooms during the period
      const { data: lessons, error: lessonsError } = await supabase
        .from('lessons')
        .select('id, room_id, start_at, end_at')
        .eq('org_id', currentOrg.id)
        .not('room_id', 'is', null)
        .neq('status', 'cancelled')
        .gte('start_at', `${startDate}T00:00:00`)
        .lte('start_at', `${endDate}T23:59:59`);

      if (lessonsError) throw lessonsError;

      // Calculate working days in period (simple: count all days)
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      // Approximate working days (exclude weekends roughly)
      const workingDays = Math.ceil(daysDiff * 5 / 7);
      const availableMinutesPerRoom = workingDays * WORKING_HOURS_PER_DAY * 60;

      // Group lessons by room
      const lessonsByRoom = new Map<string, { count: number; minutes: number }>();
      
      (lessons || []).forEach((lesson) => {
        if (!lesson.room_id) return;
        
        const duration = differenceInMinutes(
          parseISO(lesson.end_at),
          parseISO(lesson.start_at)
        );
        
        const current = lessonsByRoom.get(lesson.room_id) || { count: 0, minutes: 0 };
        current.count++;
        current.minutes += duration;
        lessonsByRoom.set(lesson.room_id, current);
      });

      // Build room utilisation data
      const roomData: RoomUtilisationData[] = rooms.map((room) => {
        const usage = lessonsByRoom.get(room.id) || { count: 0, minutes: 0 };
        const utilisationPercent = availableMinutesPerRoom > 0
          ? Math.min(100, (usage.minutes / availableMinutesPerRoom) * 100)
          : 0;

        return {
          roomId: room.id,
          roomName: room.name,
          locationName: (room.location as any)?.name || 'Unknown',
          capacity: room.capacity,
          bookedMinutes: usage.minutes,
          availableMinutes: availableMinutesPerRoom,
          utilisationPercent,
          lessonCount: usage.count,
        };
      });

      // Sort by utilisation descending
      roomData.sort((a, b) => b.utilisationPercent - a.utilisationPercent);

      const totalBookedMinutes = roomData.reduce((sum, r) => sum + r.bookedMinutes, 0);
      const totalAvailableMinutes = roomData.reduce((sum, r) => sum + r.availableMinutes, 0);
      const averageUtilisation = roomData.length > 0
        ? roomData.reduce((sum, r) => sum + r.utilisationPercent, 0) / roomData.length
        : 0;

      return {
        rooms: roomData,
        totalBookedMinutes,
        totalAvailableMinutes,
        averageUtilisation,
        mostUsedRoom: roomData[0] || null,
        leastUsedRoom: roomData[roomData.length - 1] || null,
      };
    },
    enabled: !!currentOrg?.id,
  });
}

function getUtilisationColor(percent: number): string {
  if (percent >= 70) return 'hsl(var(--chart-1))'; // Green - well used
  if (percent >= 40) return 'hsl(var(--chart-2))'; // Yellow - moderate
  return 'hsl(var(--chart-3))'; // Red - underutilised
}

function getUtilisationBadge(percent: number) {
  if (percent >= 70) return <Badge className="bg-success/10 text-success border-success/20">Well Used</Badge>;
  if (percent >= 40) return <Badge className="bg-warning/10 text-warning border-warning/20">Moderate</Badge>;
  return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Underutilised</Badge>;
}

function formatHoursMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function UtilisationReport() {
  // Default to last month
  const [startDate, setStartDate] = useState(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));

  const { data, isLoading, error } = useUtilisationReport(startDate, endDate);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.rooms.map((room) => ({
      name: room.roomName,
      utilisation: Math.round(room.utilisationPercent),
      fill: getUtilisationColor(room.utilisationPercent),
    }));
  }, [data]);

  return (
    <AppLayout>
      <PageHeader
        title="Room Utilisation"
        description="Analyse how effectively your teaching spaces are used"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Reports', href: '/reports' },
          { label: 'Room Utilisation' },
        ]}
      />

      {/* Date Range */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
                  setEndDate(format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
                }}
              >
                Last Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                  setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                }}
              >
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate(format(subMonths(new Date(), 3), 'yyyy-MM-dd'));
                  setEndDate(format(new Date(), 'yyyy-MM-dd'));
                }}
              >
                Last 3 Months
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState icon={MapPin} title="Error loading report" description={error.message} />
      ) : !data || data.rooms.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No rooms configured"
          description="Add rooms to your locations to track utilisation. Go to Locations to set up rooms."
          actionLabel="Go to Locations"
          onAction={() => window.location.href = '/locations'}
        />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Average Utilisation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{Math.round(data.averageUtilisation)}%</p>
                <Progress value={data.averageUtilisation} className="mt-2 h-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Total Booked Time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatHoursMinutes(data.totalBookedMinutes)}</p>
              </CardContent>
            </Card>

            {data.mostUsedRoom && (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Most Used Room
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-bold truncate">{data.mostUsedRoom.roomName}</p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(data.mostUsedRoom.utilisationPercent)}% utilised
                  </p>
                </CardContent>
              </Card>
            )}

            {data.leastUsedRoom && data.rooms.length > 1 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Least Used Room
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-bold truncate">{data.leastUsedRoom.roomName}</p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(data.leastUsedRoom.utilisationPercent)}% utilised
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Utilisation by Room</CardTitle>
                <CardDescription>
                  Based on {WORKING_HOURS_PER_DAY} available hours per day (8am-8pm)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="name" width={120} className="text-xs" />
                      <Tooltip
                        formatter={(value: number) => [`${value}%`, 'Utilisation']}
                        labelClassName="font-medium"
                      />
                      <Bar dataKey="utilisation" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Room Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-center">Capacity</TableHead>
                    <TableHead className="text-right">Lessons</TableHead>
                    <TableHead className="text-right">Booked Time</TableHead>
                    <TableHead className="text-right">Utilisation</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rooms.map((room) => (
                    <TableRow key={room.roomId}>
                      <TableCell className="font-medium">{room.roomName}</TableCell>
                      <TableCell className="text-muted-foreground">{room.locationName}</TableCell>
                      <TableCell className="text-center">
                        {room.capacity ? room.capacity : '-'}
                      </TableCell>
                      <TableCell className="text-right">{room.lessonCount}</TableCell>
                      <TableCell className="text-right">{formatHoursMinutes(room.bookedMinutes)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {Math.round(room.utilisationPercent)}%
                      </TableCell>
                      <TableCell className="text-center">
                        {getUtilisationBadge(room.utilisationPercent)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Understanding Utilisation</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong className="text-foreground">Well Used (70%+):</strong> Room is being used effectively. Consider if you need additional capacity.
              </p>
              <p>
                <strong className="text-foreground">Moderate (40-70%):</strong> Room has availability. Good balance of usage and flexibility.
              </p>
              <p>
                <strong className="text-foreground">Underutilised (&lt;40%):</strong> Room may be underused. Consider consolidating bookings or different use.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </AppLayout>
  );
}
