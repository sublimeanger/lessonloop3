import { useMemo, useState } from 'react';
import { startOfWeek, addDays, format, isToday, isWeekend, parseISO } from 'date-fns';
import { LessonWithDetails } from './types';
import { TeacherWithColour, getTeacherColour, TEACHER_COLOURS, TeacherColourEntry } from './teacherColours';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

const VISIBLE_WHEN_COLLAPSED = 6;

/** Inline stacked card — color bar + time + student name */
function StackedCard({
  lesson,
  colour,
  compact,
  onClick,
}: {
  lesson: LessonWithDetails;
  colour: TeacherColourEntry;
  compact: boolean;
  onClick: () => void;
}) {
  const startTime = parseISO(lesson.start_at);
  const isCancelled = lesson.status === 'cancelled';
  const isGroup = (lesson.participants?.length ?? 0) > 1;

  // Student display
  let studentLabel: string;
  if (isGroup) {
    studentLabel = `♪ Group (${lesson.participants!.length})`;
  } else if (lesson.participants?.[0]) {
    const s = lesson.participants[0].student;
    studentLabel = compact ? s.first_name : `${s.first_name} ${s.last_name}`;
  } else {
    studentLabel = lesson.title;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-stretch gap-0 text-left rounded-sm transition-colors hover:bg-muted/60 active:bg-muted',
        isCancelled && 'opacity-40',
      )}
    >
      {/* Color bar */}
      <div
        className="w-[3px] rounded-full shrink-0 my-0.5"
        style={{ backgroundColor: colour.hex }}
      />
      {/* Content */}
      <div className="flex-1 min-w-0 pl-1 pr-0.5 py-px">
        <span className={cn(
          'text-[9px] sm:text-[10px] text-muted-foreground tabular-nums',
          isCancelled && 'line-through',
        )}>
          {format(startTime, 'H:mm')}
        </span>
        <span className={cn(
          'ml-1 text-[10px] sm:text-xs font-semibold text-foreground truncate',
          isCancelled && 'line-through text-muted-foreground',
        )}>
          {studentLabel}
        </span>
      </div>
    </button>
  );
}

interface StackedWeekViewProps {
  currentDate: Date;
  lessons: LessonWithDetails[];
  teacherColourMap: Map<string, TeacherWithColour>;
  onLessonClick: (lesson: LessonWithDetails) => void;
  onDayClick: (date: Date) => void;
  isParent: boolean;
  compact?: boolean;
}

export function StackedWeekView({
  currentDate,
  lessons,
  teacherColourMap,
  onLessonClick,
  onDayClick,
  isParent,
  compact = false,
}: StackedWeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Group lessons by day
  const lessonsByDay = useMemo(() => {
    const map = new Map<string, LessonWithDetails[]>();
    for (const day of days) {
      map.set(format(day, 'yyyy-MM-dd'), []);
    }
    for (const lesson of lessons) {
      const key = format(parseISO(lesson.start_at), 'yyyy-MM-dd');
      map.get(key)?.push(lesson);
    }
    for (const [, dayLessons] of map) {
      dayLessons.sort((a, b) => a.start_at.localeCompare(b.start_at));
    }
    return map;
  }, [lessons, days]);

  const toggleExpanded = (key: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Compute grid template: weekdays 1fr, empty weekends 0.6fr
  const gridCols = useMemo(() => {
    return days.map((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const count = lessonsByDay.get(key)?.length ?? 0;
      const weekend = isWeekend(day);
      return weekend && count === 0 ? '0.6fr' : '1fr';
    }).join(' ');
  }, [days, lessonsByDay]);

  return (
    <div
      className="grid gap-px bg-border rounded-lg overflow-hidden border"
      style={{ gridTemplateColumns: gridCols }}
    >
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd');
        const dayLessons = lessonsByDay.get(key) || [];
        const today = isToday(day);
        const count = dayLessons.length;
        const isExpanded = expandedDays.has(key);

        const visibleLessons = isExpanded
          ? dayLessons
          : dayLessons.slice(0, VISIBLE_WHEN_COLLAPSED);
        const hiddenCount = count - VISIBLE_WHEN_COLLAPSED;

        return (
          <div
            key={key}
            className={cn(
              'bg-background flex flex-col min-h-[280px]',
              today && 'border-l-2 border-l-primary',
            )}
          >
            {/* Day header — compact */}
            <div
              className={cn(
                'px-1.5 py-1 text-center border-b select-none',
                'bg-muted/50 text-muted-foreground',
              )}
            >
              <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide">
                {format(day, 'EEE')}
              </div>
              <div className="flex items-center justify-center gap-0.5">
                {today && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                )}
                <span className={cn(
                  'text-sm sm:text-lg font-bold leading-tight',
                  today ? 'text-primary' : 'text-foreground'
                )}>
                  {format(day, 'd')}
                </span>
                {count > 0 && (
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-normal">
                    ({count})
                  </span>
                )}
              </div>
            </div>

            {/* Lesson cards */}
            <div
              className={cn(
                'flex-1 p-0.5 sm:p-1 overflow-y-auto',
                !isParent && 'cursor-pointer'
              )}
              onClick={(e) => {
                if (e.target === e.currentTarget && !isParent) {
                  const noon = new Date(day);
                  noon.setHours(9, 0, 0, 0);
                  onDayClick(noon);
                }
              }}
            >
              {count === 0 ? (
                <div
                  className="flex items-center justify-center h-full text-[10px] sm:text-xs text-muted-foreground/50 select-none"
                  onClick={() => {
                    if (!isParent) {
                      const d = new Date(day);
                      d.setHours(9, 0, 0, 0);
                      onDayClick(d);
                    }
                  }}
                >
                  <span className="hidden sm:inline">No lessons</span>
                </div>
              ) : (
                <div className="space-y-px">
                  {visibleLessons.map((lesson) => {
                    const colour = getTeacherColour(
                      teacherColourMap,
                      lesson.teacher_id || null
                    );
                    return (
                      <StackedCard
                        key={lesson.id}
                        lesson={lesson}
                        colour={colour}
                        compact={compact}
                        onClick={() => onLessonClick(lesson)}
                      />
                    );
                  })}
                  {/* Show more / show less pill */}
                  {count > VISIBLE_WHEN_COLLAPSED && (
                    <button
                      className={cn(
                        'mx-auto flex items-center justify-center gap-0.5 rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs',
                        'bg-muted/50 hover:bg-muted text-muted-foreground transition-colors',
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(key);
                      }}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3" />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" />
                          +{hiddenCount} more
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
