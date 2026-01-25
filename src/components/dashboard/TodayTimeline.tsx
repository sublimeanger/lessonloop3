import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTodayLessons, TodayLesson } from '@/hooks/useTodayLessons';
import { Calendar, Clock, MapPin, Plus, Users, PlayCircle, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TodayTimelineProps {
  className?: string;
}

const statusConfig = {
  'upcoming': {
    icon: Clock,
    label: 'Upcoming',
    className: 'bg-muted text-muted-foreground',
  },
  'in-progress': {
    icon: PlayCircle,
    label: 'In Progress',
    className: 'bg-teal/10 text-teal border-teal/20',
  },
  'completed': {
    icon: CheckCircle2,
    label: 'Completed',
    className: 'bg-success/10 text-success border-success/20',
  },
  'cancelled': {
    icon: XCircle,
    label: 'Cancelled',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
};

function LessonItem({ lesson, index }: { lesson: TodayLesson; index: number }) {
  const config = statusConfig[lesson.status];
  const StatusIcon = config.icon;
  const isNow = lesson.status === 'in-progress';
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        'group relative flex gap-4 rounded-lg p-4 transition-colors',
        isNow && 'bg-teal/5 ring-1 ring-teal/20',
        lesson.status === 'cancelled' && 'opacity-60'
      )}
    >
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full border-2',
            isNow
              ? 'border-teal bg-teal text-white'
              : lesson.status === 'completed'
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-border bg-background text-muted-foreground'
          )}
        >
          <StatusIcon className="h-5 w-5" />
        </div>
        {/* Connecting line (not on last item) */}
        <div className="flex-1 w-0.5 bg-border mt-2" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            {/* Time */}
            <p className="text-sm font-medium text-muted-foreground">
              {format(lesson.startAt, 'HH:mm')} – {format(lesson.endAt, 'HH:mm')}
              <span className="ml-2 text-xs">({lesson.duration} min)</span>
            </p>
            
            {/* Title */}
            <h4 className={cn(
              'mt-1 text-base font-semibold',
              lesson.status === 'cancelled' && 'line-through'
            )}>
              {lesson.title}
            </h4>
            
            {/* Students */}
            {lesson.students.length > 0 && (
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>
                  {lesson.students.map(s => s.name).join(', ')}
                </span>
              </div>
            )}
            
            {/* Location */}
            {lesson.location && (
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>
                  {lesson.location.name}
                  {lesson.room && ` – ${lesson.room.name}`}
                </span>
              </div>
            )}
          </div>

          {/* Status badge */}
          <Badge variant="outline" className={cn('shrink-0', config.className)}>
            {isNow ? 'NOW' : config.label}
          </Badge>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Calendar className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">No lessons today</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Your schedule is clear. Take the day off or schedule a new lesson!
      </p>
      <Link to="/calendar">
        <Button className="mt-6 gap-2">
          <Plus className="h-4 w-4" />
          Schedule Lesson
        </Button>
      </Link>
    </motion.div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TodayTimeline({ className }: TodayTimelineProps) {
  const { data: lessons, isLoading } = useTodayLessons();
  
  const activeLessons = lessons?.filter(l => l.status !== 'cancelled') || [];
  
  return (
    <Card className={cn('overflow-hidden', className)} data-tour="today-timeline">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Today's Schedule</CardTitle>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), 'EEEE, d MMMM')}
            </p>
          </div>
        </div>
        {activeLessons.length > 0 && (
          <Link to="/calendar">
            <Button variant="ghost" size="sm" className="gap-1">
              View All
              <Calendar className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4">
            <TimelineSkeleton />
          </div>
        ) : activeLessons.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="p-4">
            {lessons?.map((lesson, index) => (
              <LessonItem key={lesson.id} lesson={lesson} index={index} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
