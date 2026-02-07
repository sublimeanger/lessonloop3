import { format, differenceInMinutes, parseISO } from 'date-fns';
import { LessonWithDetails } from './types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Clock, MapPin, User, Repeat } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TeacherColourEntry } from './teacherColours';

interface LessonCardProps {
  lesson: LessonWithDetails;
  onClick: () => void;
  variant?: 'calendar' | 'agenda' | 'stacked';
  teacherColour?: TeacherColourEntry;
}

export function LessonCard({ lesson, onClick, variant = 'calendar', teacherColour }: LessonCardProps) {
  const startTime = parseISO(lesson.start_at);
  const endTime = parseISO(lesson.end_at);
  const duration = differenceInMinutes(endTime, startTime);
  const isRecurring = !!lesson.recurrence_id;
  const isCancelled = lesson.status === 'cancelled';
  
  const statusColors = {
    scheduled: 'bg-primary/10 border-primary/30 hover:bg-primary/20',
    completed: 'bg-success/10 border-success/30 hover:bg-success/20',
    cancelled: 'bg-muted border-muted-foreground/20 opacity-60',
  };

  const studentNames = lesson.participants?.map(p => 
    `${p.student.first_name} ${p.student.last_name}`
  ).join(', ') || '';

  // Stacked variant — used in the new week view
  if (variant === 'stacked') {
    return (
      <div
        onClick={onClick}
        className={cn(
          'rounded-lg border-l-4 border bg-card p-2.5 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] group',
          isCancelled && 'opacity-50',
          teacherColour?.border ?? 'border-l-primary'
        )}
      >
        {/* Time range */}
        <div className={cn(
          'text-sm font-semibold tabular-nums',
          isCancelled && 'line-through'
        )}>
          {format(startTime, 'HH:mm')} – {format(endTime, 'HH:mm')}
        </div>

        {/* Title */}
        <div className={cn(
          'text-sm font-medium truncate mt-0.5',
          isCancelled && 'line-through text-muted-foreground'
        )}>
          {lesson.title}
        </div>

        {/* Student names */}
        {studentNames && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {studentNames}
          </div>
        )}

        {/* Bottom row: teacher + location + badges */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {lesson.teacher && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {teacherColour && (
                <span className={cn('h-2 w-2 rounded-full shrink-0', teacherColour.bg)} />
              )}
              <span className="truncate max-w-[90px]">
                {lesson.teacher.full_name || lesson.teacher.email}
              </span>
            </span>
          )}
          {lesson.location && (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[70px]">{lesson.location.name}</span>
            </span>
          )}
          {isRecurring && (
            <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          <Badge variant="outline" className="text-[10px] px-1 py-0 capitalize ml-auto">
            {lesson.lesson_type}
          </Badge>
        </div>
      </div>
    );
  }

  if (variant === 'agenda') {
    return (
      <div
        onClick={onClick}
        className={cn(
          'flex items-center gap-4 rounded-lg border p-4 cursor-pointer transition-colors',
          statusColors[lesson.status]
        )}
      >
        <div className="flex flex-col items-center text-center min-w-[60px]">
          <span className="text-2xl font-bold">{format(startTime, 'HH:mm')}</span>
          <span className="text-xs text-muted-foreground">{format(endTime, 'HH:mm')}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{lesson.title}</span>
            <Badge variant="outline" className="text-xs capitalize">
              {lesson.lesson_type}
            </Badge>
            {isRecurring && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Repeat className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent>Recurring series</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            {lesson.teacher && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {lesson.teacher.full_name || lesson.teacher.email}
              </span>
            )}
            {lesson.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {lesson.location.name}
                {lesson.room && ` - ${lesson.room.name}`}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {duration} min
            </span>
          </div>
          {studentNames && (
            <p className="text-sm text-muted-foreground mt-1 truncate">
              Students: {studentNames}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Calendar variant - compact card for day view time-grid
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          onClick={onClick}
          className={cn(
            'h-full w-full rounded px-2 py-1 cursor-pointer overflow-hidden border text-xs transition-all hover:scale-[1.02] hover:shadow-md',
            teacherColour ? `border-l-2 ${teacherColour.border}` : '',
            statusColors[lesson.status]
          )}
        >
          <div className="flex items-center gap-1 font-medium truncate">
            {isRecurring && <Repeat className="h-3 w-3 flex-shrink-0" />}
            <span className="truncate">{lesson.title}</span>
          </div>
          {duration >= 30 && (
            <div className="text-muted-foreground truncate">
              {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
            </div>
          )}
          {duration >= 45 && studentNames && (
            <div className="text-muted-foreground truncate">{studentNames}</div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        Click to view, edit, or cancel
      </TooltipContent>
    </Tooltip>
  );
}
