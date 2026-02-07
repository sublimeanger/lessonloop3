import { format, differenceInMinutes, isSameDay, parseISO } from 'date-fns';
import { LessonWithDetails } from './types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Clock, MapPin, User, Repeat } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface LessonCardProps {
  lesson: LessonWithDetails;
  onClick: () => void;
  variant?: 'calendar' | 'agenda';
}

export function LessonCard({ lesson, onClick, variant = 'calendar' }: LessonCardProps) {
  const startTime = parseISO(lesson.start_at);
  const endTime = parseISO(lesson.end_at);
  const duration = differenceInMinutes(endTime, startTime);
  const isRecurring = !!lesson.recurrence_id;
  
  const statusColors = {
    scheduled: 'bg-primary/10 border-primary/30 hover:bg-primary/20',
    completed: 'bg-success/10 border-success/30 hover:bg-success/20',
    cancelled: 'bg-muted border-muted-foreground/20 opacity-60',
  };

  const studentNames = lesson.participants?.map(p => 
    `${p.student.first_name} ${p.student.last_name}`
  ).join(', ') || '';

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

  // Calendar variant - compact card for week/day view
  return (
    <div
      onClick={onClick}
      className={cn(
        'absolute left-1 right-1 rounded px-2 py-1 cursor-pointer overflow-hidden border text-xs transition-colors',
        statusColors[lesson.status]
      )}
      style={{
        // Height and position will be calculated by parent grid
      }}
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
  );
}
