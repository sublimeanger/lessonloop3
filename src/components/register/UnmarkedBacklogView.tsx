import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays, parseISO } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMarkLessonComplete } from '@/hooks/useRegisterData';
import { RegisterRow, type RegisterLesson } from '@/hooks/useRegisterData';
import { RegisterRow as RegisterRowComponent } from '@/components/register/RegisterRow';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ArrowLeft, CheckCircle2, ClipboardList, Loader2 } from 'lucide-react';

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

export function UnmarkedBacklogView() {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();
  const orgTimezone = currentOrg?.timezone || 'Europe/London';
  const markComplete = useMarkLessonComplete();
  const queryClient = useQueryClient();

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

  // Transform to RegisterLesson format and group by date
  const { grouped, totalCount } = useMemo(() => {
    if (!rawLessons) return { grouped: [] as Array<{ date: string; lessons: RegisterLesson[] }>, totalCount: 0 };

    const lessons: RegisterLesson[] = rawLessons.map((l) => {
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
      .map(([date, dateLessons]) => ({ date, lessons: dateLessons }));

    return { grouped: sorted, totalCount: lessons.length };
  }, [rawLessons]);

  const handleMarkAllPresent = async (lessonId: string) => {
    await markComplete.mutateAsync(lessonId);
    queryClient.invalidateQueries({ queryKey: ['unmarked-lessons-backlog'] });
    queryClient.invalidateQueries({ queryKey: ['urgent-actions'] });
  };

  return (
    <>
      <PageHeader
        title="Unmarked Lessons"
        description="Lessons from the last 30 days that still need attendance marked."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Register', href: '/register' },
          { label: 'Unmarked' },
        ]}
        actions={
          <Button variant="outline" size="sm" className="min-h-11 gap-1.5 sm:min-h-9" asChild>
            <Link to="/register">
              <ArrowLeft className="h-4 w-4" />
              Today's Register
            </Link>
          </Button>
        }
      />

      {/* Count */}
      <div className="mb-6">
        <Badge variant="secondary" className="text-sm px-3 py-1">
          {totalCount} lesson{totalCount !== 1 ? 's' : ''} need attendance
        </Badge>
      </div>

      {isLoading ? (
        <ListSkeleton count={6} />
      ) : totalCount === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="All caught up!"
          description="Every lesson from the last 30 days has attendance marked."
          actionLabel="Go to Today's Register"
          onAction={() => window.location.href = '/register'}
        />
      ) : (
        <div className="space-y-8">
          {grouped.map(({ date, lessons }) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {format(parseISO(date), 'EEEE, d MMMM yyyy')}
                <span className="ml-2 text-xs">({lessons.length})</span>
              </h3>
              <div className="space-y-3">
                {lessons.map((lesson) => (
                  <div key={lesson.id} className="relative">
                    <RegisterRowComponent lesson={lesson} />
                    {/* Quick "All Present" action */}
                    <div className="absolute right-2 top-2 sm:right-3 sm:top-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs text-success hover:text-success hover:bg-success/10"
                        onClick={() => handleMarkAllPresent(lesson.id)}
                        disabled={markComplete.isPending}
                      >
                        {markComplete.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        All Present
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
