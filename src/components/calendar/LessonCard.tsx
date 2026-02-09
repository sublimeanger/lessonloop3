import { format, differenceInMinutes, parseISO } from 'date-fns';
import { LessonWithDetails } from './types';
import { cn } from '@/lib/utils';
import { Repeat, GripHorizontal } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TeacherColourEntry, TEACHER_COLOURS } from './teacherColours';

interface LessonCardProps {
  lesson: LessonWithDetails;
  onClick: () => void;
  variant?: 'calendar' | 'agenda' | 'stacked';
  teacherColour?: TeacherColourEntry;
  /** Show the resize handle at the bottom edge (calendar variant only) */
  showResizeHandle?: boolean;
  /** Called when the user starts dragging the resize handle */
  onResizeStart?: (e: React.MouseEvent | React.TouchEvent) => void;
}

/**
 * Format student names: "Last, First" for single student,
 * "Last, First +N" for groups.
 */
function formatStudentNames(participants?: LessonWithDetails['participants']): string {
  if (!participants || participants.length === 0) return '';
  const first = participants[0].student;
  const name = `${first.last_name}, ${first.first_name}`;
  if (participants.length === 1) return name;
  return `${name} +${participants.length - 1}`;
}

/** Short student display for compact mobile cards */
function formatStudentShort(participants?: LessonWithDetails['participants']): string {
  if (!participants || participants.length === 0) return '';
  const first = participants[0].student;
  if (participants.length === 1) return `${first.first_name} ${first.last_name.charAt(0)}.`;
  return `${first.first_name} +${participants.length - 1}`;
}

/**
 * Build the secondary line: "w/ Teacher" or "Location · w/ Teacher"
 */
function buildSecondaryLine(lesson: LessonWithDetails): string {
  const teacherName = lesson.teacher?.full_name || lesson.teacher?.email || '';
  const locationName = lesson.location?.name || '';
  
  if (locationName && teacherName) {
    return `${locationName} · w/ ${teacherName}`;
  }
  if (teacherName) {
    return `w/ ${teacherName}`;
  }
  if (locationName) {
    return locationName;
  }
  return '';
}

export function LessonCard({ lesson, onClick, variant = 'calendar', teacherColour, showResizeHandle, onResizeStart }: LessonCardProps) {
  const startTime = parseISO(lesson.start_at);
  const endTime = parseISO(lesson.end_at);
  const duration = differenceInMinutes(endTime, startTime);
  const isRecurring = !!lesson.recurrence_id;
  const isCancelled = lesson.status === 'cancelled';
  const colour = teacherColour ?? TEACHER_COLOURS[0];

  const studentDisplay = formatStudentNames(lesson.participants);
  const studentShort = formatStudentShort(lesson.participants);
  const secondaryLine = buildSecondaryLine(lesson);

  // ─── Stacked variant — compact coloured cards for week view ───
  if (variant === 'stacked') {
    return (
      <div
        onClick={onClick}
        className={cn(
          'px-1 sm:px-1.5 py-0.5 sm:py-1 cursor-pointer transition-colors rounded-sm',
          colour.bgLight,
          isCancelled && 'opacity-40'
        )}
      >
        {/* Time */}
        <div className={cn(
          'text-[9px] sm:text-[10px] leading-tight tabular-nums',
          colour.text,
          isCancelled && 'line-through'
        )}>
          {format(startTime, 'HH:mm')}–{format(endTime, 'HH:mm')}
          {isRecurring && <Repeat className="h-2 w-2 sm:h-2.5 sm:w-2.5 inline-block ml-0.5 -mt-px" />}
        </div>

        {/* Student name */}
        {(studentDisplay || studentShort) && (
          <div className={cn(
            'text-[10px] sm:text-xs font-semibold truncate leading-snug',
            isCancelled && 'line-through text-muted-foreground'
          )}>
            <span className="hidden sm:inline">{studentDisplay}</span>
            <span className="sm:hidden">{studentShort}</span>
          </div>
        )}

        {/* Teacher / location — hide on very small screens */}
        {secondaryLine && (
          <div className={cn(
            'text-[9px] sm:text-[10px] truncate leading-tight hidden sm:block',
            colour.text
          )}>
            {secondaryLine}
          </div>
        )}
      </div>
    );
  }

  // ─── Agenda variant — teacher-tinted row ───
  if (variant === 'agenda') {
    return (
      <div
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 sm:gap-4 rounded-lg p-3 sm:p-4 cursor-pointer transition-colors',
          colour.bgLight,
          isCancelled && 'opacity-50'
        )}
      >
        <div className="flex flex-col items-center text-center min-w-[50px] sm:min-w-[60px]">
          <span className={cn('text-xl sm:text-2xl font-bold', colour.text)}>
            {format(startTime, 'HH:mm')}
          </span>
          <span className="text-[10px] sm:text-xs text-muted-foreground">{format(endTime, 'HH:mm')}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'font-semibold truncate text-sm sm:text-base',
              isCancelled && 'line-through'
            )}>
              {studentDisplay || lesson.title}
            </span>
            {isRecurring && (
              <Repeat className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground flex-shrink-0" />
            )}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
            {secondaryLine}
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            {duration} min · {lesson.lesson_type}
          </div>
        </div>
      </div>
    );
  }

  // ─── Calendar variant — compact card for time-grid ───
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          onClick={onClick}
          className={cn(
            'h-full w-full rounded-sm px-1.5 py-1 cursor-pointer overflow-hidden text-xs transition-all hover:shadow-md group relative',
            colour.bgLight,
            isCancelled && 'opacity-50'
          )}
        >
          <div className={cn(
            'flex items-center gap-1 font-semibold truncate',
            isCancelled && 'line-through'
          )}>
            {isRecurring && <Repeat className="h-3 w-3 flex-shrink-0" />}
            <span className="truncate">{studentDisplay || lesson.title}</span>
          </div>
          {duration >= 30 && (
            <div className={cn('truncate', colour.text)}>
              {format(startTime, 'HH:mm')} – {format(endTime, 'HH:mm')}
            </div>
          )}
          {duration >= 45 && secondaryLine && (
            <div className={cn('truncate', colour.text)}>{secondaryLine}</div>
          )}

          {/* Resize handle — visible on hover */}
          {showResizeHandle && !isCancelled && (
            <div
              className="absolute bottom-0 left-0 right-0 h-2 flex items-center justify-center cursor-s-resize opacity-0 group-hover:opacity-100 transition-opacity"
              onMouseDown={(e) => {
                e.stopPropagation();
                onResizeStart?.(e);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                onResizeStart?.(e);
              }}
            >
              <GripHorizontal className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {lesson.title} · Click to view or edit
      </TooltipContent>
    </Tooltip>
  );
}
