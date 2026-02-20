import { Link } from 'react-router-dom';
import { useTodayLessons, TodayLesson } from '@/hooks/useTodayLessons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, CheckCircle2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TodayTimelineProps {
  className?: string;
}

function LessonRow({ lesson }: { lesson: TodayLesson }) {
  const isNow = lesson.status === 'in-progress';
  const isCancelled = lesson.status === 'cancelled';
  const isCompleted = lesson.status === 'completed';
  const lessonDate = format(lesson.startAt, 'yyyy-MM-dd');
  const studentName = lesson.students[0]?.name || lesson.title;

  return (
    <Link
      to={`/calendar?date=${lessonDate}`}
      className={cn(
        'flex items-stretch gap-0 py-2.5 px-1 transition-colors hover:bg-muted/50 rounded-lg group',
        isCancelled && 'opacity-40',
      )}
    >
      {/* Time */}
      <div className="w-14 shrink-0 text-right pr-3 pt-0.5">
        <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
          {format(lesson.startAt, 'H:mm')}
        </span>
      </div>

      {/* Color bar — using primary for now, teacher color would need extra data */}
      <div
        className={cn(
          'w-[3px] rounded-full shrink-0 self-stretch',
          isNow ? 'bg-primary' : isCompleted ? 'bg-success' : 'bg-border',
        )}
      />

      {/* Content */}
      <div className="flex-1 min-w-0 pl-3">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-sm font-semibold text-foreground truncate',
            isCancelled && 'line-through',
          )}>
            {studentName}
          </span>
          {isCompleted && (
            <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
          )}
          {isNow && (
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
              NOW
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {lesson.title !== studentName ? `${lesson.title} · ` : ''}
          {lesson.duration}min
          {lesson.teacherName && ` · ${lesson.teacherName}`}
          {lesson.location && ` · ${lesson.location.name}`}
        </p>
      </div>
    </Link>
  );
}

function EmptyTimeline() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
        <Calendar className="h-6 w-6 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium text-foreground">No lessons today</p>
      <p className="text-xs text-muted-foreground mt-0.5">Your schedule is clear.</p>
    </div>
  );
}

function AllDone({ completedCount }: { completedCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center mb-3">
        <CheckCircle2 className="h-6 w-6 text-success" />
      </div>
      <p className="text-sm font-medium text-foreground">All done for today ✓</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {completedCount} lesson{completedCount !== 1 ? 's' : ''} completed
      </p>
    </div>
  );
}

export function TodayTimeline({ className }: TodayTimelineProps) {
  const { data: lessons, isLoading } = useTodayLessons();

  const activeLessons = lessons?.filter(l => l.status !== 'cancelled') || [];
  const upcomingOrInProgress = activeLessons.filter(l => l.status === 'upcoming' || l.status === 'in-progress');
  const completedCount = activeLessons.filter(l => l.status === 'completed').length;

  // If all lessons are done and it's past the last one
  const allDone = activeLessons.length > 0 && upcomingOrInProgress.length === 0;

  // Show next 6 upcoming, or all if fewer
  const displayLessons = allDone
    ? activeLessons.slice(-3) // show last 3 completed
    : (lessons || []).slice(0, 6);

  return (
    <Card className={cn('', className)} data-tour="today-timeline">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Today's Schedule</CardTitle>
          {activeLessons.length > 0 && (
            <Link
              to="/calendar"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View full calendar
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 py-2">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        ) : activeLessons.length === 0 ? (
          <EmptyTimeline />
        ) : allDone ? (
          <AllDone completedCount={completedCount} />
        ) : (
          <div className="divide-y divide-border">
            {displayLessons.map((lesson) => (
              <LessonRow key={lesson.id} lesson={lesson} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
