import { Link } from 'react-router-dom';
import { useTodayLessons, TodayLesson } from '@/hooks/useTodayLessons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, CheckCircle2, ArrowRight, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useLoopAssistUI } from '@/contexts/LoopAssistContext';
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
        'group flex min-h-11 items-stretch gap-0 rounded-xl px-1 py-2.5 sm:py-3 transition-colors hover:bg-muted/50',
        isCancelled && 'opacity-40',
      )}
    >
      {/* Time */}
      <div className="w-12 sm:w-14 shrink-0 text-right pr-2 sm:pr-3 pt-0.5">
        <span className="text-caption font-semibold text-foreground tabular-nums">
          {format(lesson.startAt, 'H:mm')}
        </span>
      </div>

      {/* Color bar */}
      <div
        className={cn(
          'w-[3px] rounded-full shrink-0 self-stretch',
          isNow ? 'bg-primary' : isCompleted ? 'bg-success' : 'bg-border',
        )}
      />

      {/* Content */}
      <div className="flex-1 min-w-0 pl-2 sm:pl-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className={cn(
            'text-body-strong text-foreground truncate',
            isCancelled && 'line-through',
          )}>
            {studentName}
          </span>
          {isCompleted && (
            <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-success shrink-0" />
          )}
          {isNow && (
            <span className="text-micro font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
              NOW
            </span>
          )}
        </div>
        <p className="text-micro text-muted-foreground line-clamp-2 mt-0.5">
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
  const { openDrawerWithMessage } = useLoopAssistUI();

  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-10 text-center">
      <div className="mb-3">
        <Calendar className="h-12 w-12 text-muted-foreground/50" />
      </div>
      <p className="text-body-strong text-foreground">No lessons today</p>
      <p className="text-caption text-muted-foreground mt-0.5">Your schedule is clear.</p>
      <button
        onClick={() => openDrawerWithMessage("What's coming up this week?")}
        className="mt-3 inline-flex min-h-11 items-center gap-1 text-body text-muted-foreground transition-colors hover:text-primary"
      >
        <Sparkles className="h-3 w-3" />
        <span>or ask LoopAssist →</span>
      </button>
    </div>
  );
}

function AllDone({ completedCount }: { completedCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-10 text-center">
      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-success/10 flex items-center justify-center mb-3">
        <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
      </div>
      <p className="text-sm font-medium text-foreground">All done for today ✓</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {completedCount} lesson{completedCount !== 1 ? 's' : ''} completed
      </p>
    </div>
  );
}

export function TodayTimeline({ className }: TodayTimelineProps) {
  const { data: lessons, isLoading, isError, refetch } = useTodayLessons();

  const activeLessons = lessons?.filter(l => l.status !== 'cancelled') || [];
  const upcomingOrInProgress = activeLessons.filter(l => l.status === 'upcoming' || l.status === 'in-progress');
  const completedCount = activeLessons.filter(l => l.status === 'completed').length;

  const allDone = activeLessons.length > 0 && upcomingOrInProgress.length === 0;

  const displayLessons = allDone
    ? activeLessons.slice(-3)
    : (lessons || []).slice(0, 6);

  return (
    <Card className={cn('', className)} data-tour="today-timeline">
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-body-strong">Today's Schedule</CardTitle>
          {activeLessons.length > 0 && (
            <Link
              to="/calendar"
              className="inline-flex items-center gap-1 text-micro sm:text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="hidden sm:inline">View full calendar</span>
              <span className="sm:hidden">Calendar</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 py-2">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center mb-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <p className="text-sm font-medium text-foreground">Failed to load today's schedule</p>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="mt-2 gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
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
