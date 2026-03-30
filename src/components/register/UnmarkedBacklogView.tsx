import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays, parseISO, isToday, isYesterday } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMarkLessonComplete } from '@/hooks/useRegisterData';
import type { RegisterLesson } from '@/hooks/useRegisterData';
import { RegisterRow as RegisterRowComponent } from '@/components/register/RegisterRow';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ListSkeleton } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface UnmarkedLesson {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: string;
  notes_shared: string | null;
  notes_private: string | null;
  recurrence_id: string | null;
  teacher_id: string | null;
  teacher_user_id: string | null;
  teachers: { display_name: string } | null;
  lesson_participants: Array<{
    student_id: string;
    students: { id: string; first_name: string; last_name: string; notes: string | null } | null;
  }>;
  attendance_records: Array<{
    student_id: string;
    attendance_status: string;
    cancellation_reason: string | null;
    absence_reason_category: string | null;
  }>;
}

function formatDateHeading(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, d MMMM yyyy');
}

export function UnmarkedBacklogView() {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const orgTimezone = currentOrg?.timezone || 'Europe/London';
  const markComplete = useMarkLessonComplete();
  const queryClient = useQueryClient();
  const [markingLessonId, setMarkingLessonId] = useState<string | null>(null);

  const isTeacher = currentRole === 'teacher';
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  const { data: rawLessons, isLoading } = useQuery({
    queryKey: ['unmarked-lessons-backlog', currentOrg?.id, user?.id, currentRole],
    queryFn: async () => {
      if (!currentOrg) return [];

      const thirtyDaysAgo = subDays(new Date(), 30);

      let query = supabase
        .from('lessons')
        .select(`
          id, title, start_at, end_at, status, notes_shared, notes_private,
          recurrence_id, teacher_id, teacher_user_id,
          teachers(display_name),
          lesson_participants(
            student_id,
            students(id, first_name, last_name, notes)
          ),
          attendance_records(
            student_id, attendance_status, cancellation_reason, absence_reason_category
          )
        `)
        .eq('org_id', currentOrg.id)
        .eq('status', 'scheduled')
        .lt('end_at', fromZonedTime(new Date(), orgTimezone).toISOString())
        .gte('end_at', thirtyDaysAgo.toISOString())
        .order('start_at', { ascending: false });

      // Teacher filter
      if (isTeacher && !isAdmin && user) {
        const { data: teacherRecord } = await supabase
          .from('teachers')
          .select('id')
          .eq('user_id', user.id)
          .eq('org_id', currentOrg.id)
          .maybeSingle();
        if (teacherRecord) {
          query = query.eq('teacher_id', teacherRecord.id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as UnmarkedLesson[];
    },
    enabled: !!currentOrg?.id,
  });

  // Transform to RegisterLesson format, filter out empty lessons, group by date
  const { grouped, totalCount, totalStudents } = useMemo(() => {
    if (!rawLessons) return { grouped: [] as Array<{ date: string; dateLabel: string; lessons: RegisterLesson[] }>, totalCount: 0, totalStudents: 0 };

    const lessons: RegisterLesson[] = rawLessons
      .filter((l) => (l.lesson_participants || []).length > 0) // Exclude open slots
      .map((l) => {
        const attendanceMap = new Map(
          (l.attendance_records || []).map((ar) => [ar.student_id, ar])
        );

        return {
          id: l.id,
          title: l.title,
          start_at: l.start_at,
          end_at: l.end_at,
          status: l.status as RegisterLesson['status'],
          notes_shared: l.notes_shared,
          notes_private: l.notes_private,
          recurrence_id: l.recurrence_id,
          teacher_id: l.teacher_id,
          teacher_user_id: l.teacher_user_id,
          location_name: null,
          room_name: null,
          participants: (l.lesson_participants || []).map((lp) => {
            const att = attendanceMap.get(lp.student_id);
            return {
              student_id: lp.student_id,
              student_name: lp.students
                ? `${lp.students.first_name} ${lp.students.last_name}`
                : 'Unknown Student',
              attendance_status: (att?.attendance_status as any) || null,
              attendance_notes: att?.cancellation_reason || null,
              absence_reason_category: att?.absence_reason_category || null,
              has_notes: !!lp.students?.notes,
            };
          }),
        };
      });

    // Group by date
    const dateMap = new Map<string, RegisterLesson[]>();
    for (const lesson of lessons) {
      const dateKey = format(parseISO(lesson.start_at), 'yyyy-MM-dd');
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, []);
      dateMap.get(dateKey)!.push(lesson);
    }

    const sorted = Array.from(dateMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, dateLessons]) => ({
        date,
        dateLabel: formatDateHeading(date),
        lessons: dateLessons,
      }));

    const studentCount = lessons.reduce((sum, l) => sum + l.participants.length, 0);

    return { grouped: sorted, totalCount: lessons.length, totalStudents: studentCount };
  }, [rawLessons]);

  const handleMarkAllPresent = async (lessonId: string) => {
    setMarkingLessonId(lessonId);
    try {
      await markComplete.mutateAsync(lessonId);
      queryClient.invalidateQueries({ queryKey: ['unmarked-lessons-backlog'] });
      queryClient.invalidateQueries({ queryKey: ['urgent-actions'] });
    } catch {
      toast({ title: 'Failed to mark lesson', variant: 'destructive' });
    } finally {
      setMarkingLessonId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Unmarked Lessons"
        description="Lessons from the last 30 days still needing attendance."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Register', href: '/register' },
          { label: 'Unmarked' },
        ]}
        actions={
          <Button variant="outline" size="sm" className="min-h-11 gap-1.5 sm:min-h-9" asChild>
            <Link to="/register">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Today's Register</span>
              <span className="sm:hidden">Today</span>
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <ListSkeleton count={6} />
      ) : totalCount === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="All caught up!"
          description="Every lesson from the last 30 days has attendance marked."
          actionLabel="Go to Today's Register"
          onAction={() => navigate('/register')}
        />
      ) : (
        <>
          {/* Summary stats */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:flex sm:gap-4">
            <Card className="sm:min-w-[140px]">
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <div className="rounded-lg bg-warning/10 p-2">
                  <ClipboardList className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums leading-none">{totalCount}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Lessons</div>
                </div>
              </CardContent>
            </Card>
            <Card className="sm:min-w-[140px]">
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums leading-none">{totalStudents}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Students</div>
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-2 sm:min-w-[140px]">
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <div className="rounded-lg bg-muted p-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums leading-none">{grouped.length}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Days</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Grouped lessons */}
          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {grouped.map(({ date, dateLabel, lessons }, groupIndex) => (
                <motion.div
                  key={date}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.25, delay: groupIndex * 0.03 }}
                >
                  {/* Date heading — sticky on scroll */}
                  <div className="sticky top-0 z-10 -mx-1 px-1 py-2 backdrop-blur-sm bg-background/80">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground tracking-tight">
                        {dateLabel}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          ({lessons.length} lesson{lessons.length !== 1 ? 's' : ''})
                        </span>
                      </h3>
                      {lessons.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-xs text-success hover:text-success hover:bg-success/10"
                          onClick={async () => {
                            for (const l of lessons) {
                              await handleMarkAllPresent(l.id);
                            }
                          }}
                          disabled={markingLessonId !== null}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Mark All Present</span>
                          <span className="sm:hidden">All</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Lesson rows */}
                  <div className="space-y-3">
                    {lessons.map((lesson) => (
                      <motion.div
                        key={lesson.id}
                        layout
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                      >
                        <RegisterRowComponent lesson={lesson} />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </>
  );
}
