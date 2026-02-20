import { useState, useCallback, useEffect } from 'react';
import { format, parseISO, startOfDay, addDays, subDays, isToday, isFuture } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useBatchAttendanceLessons, useSaveBatchAttendance } from '@/hooks/useRegisterData';
import { Loader2, CheckCircle2, Save, UserCheck, ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type AttendanceStatus = Database['public']['Enums']['attendance_status'];

export default function BatchAttendance() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateKey = format(selectedDate, 'yyyy-MM-dd');
  const isFutureDate = isFuture(startOfDay(selectedDate));

  const { data: lessons = [], isLoading } = useBatchAttendanceLessons(selectedDate);
  const saveMutation = useSaveBatchAttendance(dateKey);

  const [attendance, setAttendance] = useState<Map<string, Map<string, AttendanceStatus>>>(new Map());

  // Sync attendance map when query data changes
  useEffect(() => {
    const map = new Map<string, Map<string, AttendanceStatus>>();
    lessons.forEach((lesson) => {
      const studentMap = new Map<string, AttendanceStatus>();
      lesson.participants.forEach((p) => {
        if (p.current_status) studentMap.set(p.student_id, p.current_status);
      });
      map.set(lesson.id, studentMap);
    });
    setAttendance(map);
  }, [lessons]);

  const setStudentAttendance = useCallback(
    (lessonId: string, studentId: string, status: AttendanceStatus) => {
      setAttendance((prev) => {
        const next = new Map(prev);
        const lessonMap = new Map(next.get(lessonId) || []);
        lessonMap.set(studentId, status);
        next.set(lessonId, lessonMap);
        return next;
      });
    },
    []
  );

  const markAllPresent = useCallback(() => {
    setAttendance((prev) => {
      const next = new Map(prev);
      lessons.forEach((lesson) => {
        const lessonMap = new Map(next.get(lesson.id) || []);
        lesson.participants.forEach((p) => {
          if (!lessonMap.has(p.student_id)) {
            lessonMap.set(p.student_id, 'present');
          }
        });
        next.set(lesson.id, lessonMap);
      });
      return next;
    });
  }, [lessons]);

  const handleSave = () => saveMutation.mutate(attendance);

  const totalStudents = lessons.reduce((sum, l) => sum + l.participants.length, 0);
  const markedCount = Array.from(attendance.values()).reduce((sum, m) => sum + m.size, 0);

  const goToPrevDay = () => setSelectedDate((prev) => subDays(prev, 1));
  const goToNextDay = () => setSelectedDate((prev) => addDays(prev, 1));
  const goToToday = () => setSelectedDate(new Date());

  const dateLabel = isToday(selectedDate)
    ? 'Today'
    : format(selectedDate, 'EEEE, d MMMM yyyy');

  return (
    <AppLayout>
      <PageHeader
        title="Batch Attendance"
        description={`Mark attendance for ${isToday(selectedDate) ? "today's" : format(selectedDate, 'd MMMM yyyy') + "'s"} lessons`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Calendar', href: '/calendar' },
          { label: 'Batch Attendance' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={markAllPresent} disabled={isFutureDate} className="gap-1.5">
              <UserCheck className="h-4 w-4" />
              Mark All Present
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending || isFutureDate} className="gap-1.5">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save All ({markedCount}/{totalStudents})
            </Button>
          </div>
        }
      />

      {/* Date Navigation */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[200px] justify-start gap-2">
                <CalendarIcon className="h-4 w-4" />
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={goToNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {!isToday(selectedDate) && (
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Go to Today
          </Button>
        )}
      </div>

      {isFutureDate && (
        <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning">
          Attendance cannot be recorded for future dates.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : lessons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-medium">No lessons</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              There are no scheduled or completed lessons for {isToday(selectedDate) ? 'today' : format(selectedDate, 'd MMMM yyyy')}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {lessons.map((lesson) => {
            const lessonMap = attendance.get(lesson.id) || new Map();
            return (
              <Card key={lesson.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {format(parseISO(lesson.start_at), 'HH:mm')} – {format(parseISO(lesson.end_at), 'HH:mm')}
                      <span className="ml-2 font-normal text-muted-foreground">{lesson.title}</span>
                    </CardTitle>
                    <Badge variant={lesson.status === 'completed' ? 'secondary' : 'default'}>
                      {lesson.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {lesson.participants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No students assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {lesson.participants.map((p) => {
                        const currentStatus = lessonMap.get(p.student_id) || null;
                        return (
                          <div
                            key={p.student_id}
                            className="flex items-center justify-between gap-3 py-1.5 border-b last:border-b-0"
                          >
                            <span className="text-sm font-medium">{p.student_name}</span>
                            <ToggleGroup
                              type="single"
                              value={currentStatus || ''}
                              onValueChange={(v) => {
                                if (v) setStudentAttendance(lesson.id, p.student_id, v as AttendanceStatus);
                              }}
                              className="gap-1"
                            >
                              <ToggleGroupItem
                                value="present"
                                aria-label="Present"
                                className={cn(
                                  'h-7 px-2 text-xs',
                                  currentStatus === 'present' && 'bg-primary/15 text-primary border-primary/30'
                                )}
                              >
                                Present
                              </ToggleGroupItem>
                              <ToggleGroupItem
                                value="absent"
                                aria-label="Absent"
                                className={cn(
                                  'h-7 px-2 text-xs',
                                  currentStatus === 'absent' && 'bg-destructive/15 text-destructive border-destructive/30'
                                )}
                              >
                                Absent
                              </ToggleGroupItem>
                              <ToggleGroupItem
                                value="late"
                                aria-label="Late"
                                className={cn(
                                  'h-7 px-2 text-xs',
                                  currentStatus === 'late' && 'bg-warning/15 text-warning border-warning/30'
                                )}
                              >
                                Late
                              </ToggleGroupItem>
                            </ToggleGroup>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}