import React from 'react';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { LessonWithDetails } from './types';
import { cn } from '@/lib/utils';
import { Repeat, GripHorizontal, Check, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TeacherColourEntry, TEACHER_COLOURS } from './teacherColours';
import { useBulkSelection } from './BulkSelectionContext';

interface LessonCardProps {
  lesson: LessonWithDetails;
  onClick: () => void;
  variant?: 'calendar' | 'agenda' | 'stacked';
  teacherColour?: TeacherColourEntry;
  /** Show the resize handle at the bottom edge (calendar variant only) */
  showResizeHandle?: boolean;
  /** Called when the user starts dragging the resize handle */
  onResizeStart?: (e: React.MouseEvent | React.TouchEvent) => void;
  /** Ultra-compact mode for narrow columns (≥3 overlapping) */
  compact?: boolean;
  /** Show a pulsing animation while saving */
  isSaving?: boolean;
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
  const locationName = lesson.location?.name ? `${lesson.location.name}${lesson.location.is_archived ? ' (Archived)' : ''}` : '';
  
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

export const LessonCard = React.memo(function LessonCard({ lesson, onClick, variant = 'calendar', teacherColour, showResizeHandle, onResizeStart, compact, isSaving }: LessonCardProps) {
  const { selectionMode, selectedIds } = useBulkSelection();
  const isSelected = selectionMode && selectedIds.has(lesson.id);
  const startTime = parseISO(lesson.start_at);
  const endTime = parseISO(lesson.end_at);
  const duration = differenceInMinutes(endTime, startTime);
  const isRecurring = !!lesson.recurrence_id;
  const isEditedException = isRecurring && !!lesson.is_series_exception;
  const isCancelled = lesson.status === 'cancelled';
  const isOpenSlot = !!lesson.is_open_slot;
  const isOnline = !!lesson.is_online;
  const hasMakeup = (lesson.makeupStudentIds?.length ?? 0) > 0;
  const colour = teacherColour ?? TEACHER_COLOURS[0];

  // Selection checkbox overlay element
  const selectionCheckbox = selectionMode ? (
    <div className={cn(
      'absolute top-0.5 left-0.5 z-10 h-4 w-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors',
      isSelected
        ? 'bg-primary border-primary text-primary-foreground'
        : 'border-muted-foreground/40 bg-background/80'
    )}>
      {isSelected && <Check className="h-3 w-3" />}
    </div>
  ) : null;

  const studentDisplay = formatStudentNames(lesson.participants);
  const studentShort = formatStudentShort(lesson.participants);
  const secondaryLine = buildSecondaryLine(lesson);

  // ─── Stacked variant — compact coloured cards for week view ───
  if (variant === 'stacked') {
    // Ultra-compact: single line with time + first student name
    if (compact) {
      return (
        <div
          onClick={onClick}
          aria-label={`${lesson.title}, ${format(startTime, 'EEEE')} at ${format(startTime, 'h:mm a')}, ${lesson.status}`}
          className={cn(
            'px-1 py-px cursor-pointer transition-colors rounded-sm flex items-center gap-1 min-h-0',
            colour.bgLight,
            isCancelled && 'opacity-40',
            isOpenSlot && 'border border-dashed border-primary/40',
            isSaving && 'animate-pulse ring-1 ring-primary/30'
          )}
        >
          <span className={cn(
            'text-micro tabular-nums shrink-0',
            colour.text,
            isCancelled && 'line-through'
          )}>
            {format(startTime, 'HH:mm')}
          </span>
          <span className={cn(
            'text-micro font-semibold truncate',
            isCancelled && 'line-through text-muted-foreground'
          )}>
            {studentShort || lesson.title}
          </span>
          {isRecurring && <Repeat className="h-2 w-2 shrink-0 text-muted-foreground" />}
          {isEditedException && (
            <span className="text-micro font-medium text-warning bg-warning/20 px-0.5 rounded shrink-0">
              Edited
            </span>
          )}
          {hasMakeup && (
            <span className="text-micro font-medium text-warning bg-warning/20 px-0.5 rounded shrink-0">MU</span>
          )}
          {isOpenSlot && (
            <span className="text-micro font-medium text-primary bg-primary/15 px-0.5 rounded shrink-0">Open</span>
          )}
          {isOnline && (
            <Video className="h-2 w-2 shrink-0 text-primary" />
          )}
        </div>
      );
    }

    return (
      <div
        onClick={onClick}
        aria-label={`${lesson.title}, ${format(startTime, 'EEEE')} at ${format(startTime, 'h:mm a')}, ${lesson.status}`}
        className={cn(
          'px-1 sm:px-1.5 py-0.5 sm:py-1 cursor-pointer transition-colors rounded-sm relative',
          colour.bgLight,
          isCancelled && 'opacity-40',
          isOpenSlot && 'border border-dashed border-primary/40',
          isSaving && 'animate-pulse ring-1 ring-primary/30',
          isSelected && 'ring-2 ring-primary',
        )}
      >
        {selectionCheckbox}
        {/* Time */}
        <div className={cn(
          'text-micro leading-tight tabular-nums',
          colour.text,
          isCancelled && 'line-through'
        )}>
          {format(startTime, 'HH:mm')}–{format(endTime, 'HH:mm')}
          {isRecurring && <Repeat className="h-2 w-2 sm:h-2.5 sm:w-2.5 inline-block ml-0.5 -mt-px" />}
          {isEditedException && (
            <span className="text-micro font-medium text-warning bg-warning/20 px-0.5 rounded ml-0.5 inline-block -mt-px">
              Edited
            </span>
          )}
          {isOnline && (
            <span className="inline-flex items-center ml-0.5 -mt-px">
              <Video className="h-2.5 w-2.5 text-primary" />
            </span>
          )}
        </div>

        {/* Student name */}
        {(studentDisplay || studentShort) && (
          <div className={cn(
            'text-micro sm:text-xs font-semibold truncate leading-snug',
            isCancelled && 'line-through text-muted-foreground'
          )}>
            <span className="hidden sm:inline">{studentDisplay}</span>
            <span className="sm:hidden">{studentShort}</span>
          </div>
        )}

        {/* Teacher / location — hide on very small screens */}
        {secondaryLine && (
          <div className={cn(
            'text-micro truncate leading-tight hidden sm:block',
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
        aria-label={`${lesson.title}, ${format(startTime, 'EEEE')} at ${format(startTime, 'h:mm a')}, ${lesson.status}`}
        className={cn(
          'flex items-center gap-3 sm:gap-4 rounded-lg p-3 sm:p-4 cursor-pointer transition-colors relative',
          colour.bgLight,
          isCancelled && 'opacity-50',
          isSelected && 'ring-2 ring-primary',
        )}
      >
        {selectionCheckbox}
        <div className="flex flex-col items-center text-center min-w-[50px] sm:min-w-[60px]">
          <span className={cn('text-xl sm:text-2xl font-semibold', colour.text)}>
            {format(startTime, 'HH:mm')}
          </span>
          <span className="text-micro sm:text-xs text-muted-foreground">{format(endTime, 'HH:mm')}</span>
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
            {isEditedException && (
              <Badge variant="outline" className="text-micro px-1 py-0 h-4 border-warning/50 text-warning bg-warning/10">
                Edited
              </Badge>
            )}
            {hasMakeup && (
              <Badge variant="outline" className="text-micro px-1 py-0 h-4 border-warning/50 text-warning bg-warning/10">
                Make-up
              </Badge>
            )}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
            {secondaryLine}
          </div>
          <div className="text-micro sm:text-xs text-muted-foreground mt-0.5">
            {duration} min · {lesson.lesson_type}
          </div>
        </div>
      </div>
    );
  }

  // ─── Calendar variant — compact card for time-grid ───
  // Ultra-compact: only first name, no time/secondary
  const compactStudentName = compact
    ? (lesson.participants?.[0]?.student.first_name || lesson.title)
    : (studentDisplay || lesson.title);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          onClick={onClick}
          aria-label={`${lesson.title}, ${format(startTime, 'EEEE')} at ${format(startTime, 'h:mm a')}, ${lesson.status}`}
          className={cn(
            'h-full w-full rounded-sm px-1.5 py-1 cursor-pointer overflow-hidden text-xs transition-all hover:shadow-md group relative',
            colour.bgLight,
            isCancelled && 'opacity-50',
            isOpenSlot && 'border border-dashed border-primary/40',
            isSaving && 'animate-pulse ring-1 ring-primary/30',
            isSelected && 'ring-2 ring-primary',
          )}
        >
          {selectionCheckbox}
          <div className={cn(
            'flex items-center gap-1 font-semibold truncate',
            isCancelled && 'line-through'
          )}>
            {isRecurring && !compact && <Repeat className="h-3 w-3 flex-shrink-0" />}
            {isEditedException && !compact && (
              <span className="text-micro font-medium text-warning bg-warning/20 px-0.5 rounded shrink-0">Ed.</span>
            )}
            {hasMakeup && !compact && (
              <span className="text-micro font-medium text-warning bg-warning/20 px-0.5 rounded shrink-0">MU</span>
            )}
            {isOpenSlot && !compact && (
              <Badge variant="outline" className="text-micro px-1 py-0 h-4 border-primary/50 text-primary bg-primary/10">Open</Badge>
            )}
            <span className="truncate">{compactStudentName}</span>
          </div>
          {!compact && duration >= 30 && (
            <div className={cn('truncate', colour.text)}>
              {format(startTime, 'HH:mm')} – {format(endTime, 'HH:mm')}
            </div>
          )}
          {!compact && duration >= 45 && secondaryLine && (
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
});
