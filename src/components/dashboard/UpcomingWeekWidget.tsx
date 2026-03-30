import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, ArrowRight, CheckCircle2, XCircle, Minus } from 'lucide-react';
import { format, startOfDay, endOfWeek, endOfDay, subDays } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { cn } from '@/lib/utils';

interface UpcomingLesson {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  student_name: string | null;
  location_name: string | null;
}

interface RecentAttendance {
  lesson_id: string;
  status: string;
}

function useUpcomingWeekData() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['upcoming-week-solo', currentOrg?.id, user?.id],
    queryFn: async () => {
      if (!currentOrg || !user) return { upcoming: [], recentAttendance: [] };

      const tz = currentOrg.timezone || 'Europe/London';
      const now = new Date();
      const todayStartUtc = fromZonedTime(startOfDay(now), tz).toISOString();
      const weekEndUtc = fromZonedTime(endOfDay(endOfWeek(now, { weekStartsOn: 1 })), tz).toISOString();
      const fiveDaysAgoUtc = fromZonedTime(startOfDay(subDays(now, 14)), tz).toISOString();

      const [lessonsRes, attendanceRes] = await Promise.all([
        // Next 5 upcoming lessons this week
        supabase
          .from('lessons')
          .select(`
            id, title, start_at, end_at,
            location:locations!lessons_location_id_fkey(name),
            participants:lesson_participants(student:students!lesson_participants_student_id_fkey(first_name, last_name))
          `)
          .eq('org_id', currentOrg.id)
          .eq('teacher_user_id', user.id)
          .in('status', ['scheduled'])
          .gte('start_at', todayStartUtc)
          .lte('start_at', weekEndUtc)
          .order('start_at', { ascending: true })
          .limit(5),
        // Recent attendance for last 5 completed lessons
        (supabase as any)
          .from('attendance_records')
          .select('lesson_id, attendance_status, lesson:lessons!attendance_records_lesson_id_fkey(start_at)')
          .eq('org_id', currentOrg.id)
          .eq('recorded_by', user.id)
          .gte('lesson.start_at', fiveDaysAgoUtc)
          .order('recorded_at', { ascending: false })
          .limit(5),
      ]);

      const upcoming: UpcomingLesson[] = ((lessonsRes.data || []) as any[]).map((l) => {
        const loc = l.location as { name: string } | null;
        const parts = l.participants as Array<{ student: { first_name: string; last_name: string } | null }> | null;
        const studentName = parts?.[0]?.student
          ? `${parts[0].student.first_name} ${parts[0].student.last_name}`.trim()
          : null;
        return {
          id: l.id,
          title: l.title,
          start_at: l.start_at,
          end_at: l.end_at,
          student_name: studentName,
          location_name: loc?.name || null,
        };
      });

      const recentAttendance: RecentAttendance[] = ((attendanceRes.data || []) as any[]).map((a) => ({
        lesson_id: a.lesson_id,
        status: a.attendance_status,
      }));

      return { upcoming, recentAttendance };
    },
    enabled: !!currentOrg && !!user,
    staleTime: 30_000,
  });
}

function AttendanceDots({ records }: { records: RecentAttendance[] }) {
  if (records.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground mr-1">Recent:</span>
      {records.map((r, i) => {
        const isPresent = r.status === 'present';
        const isAbsent = r.status === 'absent' || r.status === 'cancelled_by_student' || r.status === 'no_show';
        return (
          <span
            key={`${r.lesson_id}-${i}`}
            title={r.status.replace(/_/g, ' ')}
            className={cn(
              'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
              isPresent && 'bg-success/15 text-success',
              isAbsent && 'bg-destructive/15 text-destructive',
              !isPresent && !isAbsent && 'bg-muted text-muted-foreground',
            )}
          >
            {isPresent ? <CheckCircle2 className="h-3 w-3" /> : isAbsent ? <XCircle className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          </span>
        );
      })}
    </div>
  );
}

interface UpcomingWeekWidgetProps {
  className?: string;
}

export function UpcomingWeekWidget({ className }: UpcomingWeekWidgetProps) {
  const { data, isLoading } = useUpcomingWeekData();

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </CardContent>
      </Card>
    );
  }

  const { upcoming = [], recentAttendance = [] } = data || {};

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-primary" />
          This Week
        </CardTitle>
        <AttendanceDots records={recentAttendance} />
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No more lessons this week 🎉
          </p>
        ) : (
          <div className="space-y-1">
            {upcoming.map((lesson) => {
              const startDate = new Date(lesson.start_at);
              const endDate = new Date(lesson.end_at);
              const isToday = format(startDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

              return (
                <Link
                  key={lesson.id}
                  to={`/calendar?date=${format(startDate, 'yyyy-MM-dd')}`}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
                >
                  <div className="w-14 shrink-0 text-center">
                    <div className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider',
                      isToday ? 'text-primary' : 'text-muted-foreground',
                    )}>
                      {isToday ? 'Today' : format(startDate, 'EEE')}
                    </div>
                    <div className="text-sm font-bold tabular-nums text-foreground">
                      {format(startDate, 'H:mm')}
                    </div>
                  </div>

                  <div className={cn(
                    'w-[3px] self-stretch rounded-full shrink-0',
                    isToday ? 'bg-primary' : 'bg-primary/20',
                  )} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {lesson.student_name || lesson.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {format(startDate, 'H:mm')}–{format(endDate, 'H:mm')}
                      {lesson.location_name && ` · ${lesson.location_name}`}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-3 pt-3 border-t">
          <Button variant="ghost" size="sm" className="w-full gap-1.5 text-primary" asChild>
            <Link to="/calendar">
              View full calendar
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
