import { useMemo, useState } from 'react';
import { startOfWeek, addDays, format, isToday } from 'date-fns';
import { LessonWithDetails } from './types';
import { LessonCard } from './LessonCard';
import { TeacherWithColour, getTeacherColour, TEACHER_COLOURS, TeacherColourEntry } from './teacherColours';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';

const COMPACT_THRESHOLD = 8;
const VISIBLE_WHEN_COLLAPSED = 5;

interface TeacherGroup {
  teacherId: string | null;
  teacherName: string;
  colour: TeacherColourEntry;
  lessons: LessonWithDetails[];
}

function groupByTeacher(
  lessons: LessonWithDetails[],
  colourMap: Map<string, TeacherWithColour>
): TeacherGroup[] {
  const map = new Map<string, TeacherGroup>();

  for (const lesson of lessons) {
    const tid = (lesson as any).teacher_id || null;
    const key = tid || '__none__';
    if (!map.has(key)) {
      const teacherName = lesson.teacher?.full_name || lesson.teacher?.email || 'Unassigned';
      map.set(key, {
        teacherId: tid,
        teacherName,
        colour: getTeacherColour(colourMap, tid),
        lessons: [],
      });
    }
    map.get(key)!.lessons.push(lesson);
  }

  // Sort groups alphabetically
  const groups = Array.from(map.values());
  groups.sort((a, b) => a.teacherName.localeCompare(b.teacherName));
  // Sort lessons within each group by time
  for (const g of groups) {
    g.lessons.sort((a, b) => a.start_at.localeCompare(b.start_at));
  }
  return groups;
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
      const key = format(new Date(lesson.start_at), 'yyyy-MM-dd');
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

  return (
    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd');
        const dayLessons = lessonsByDay.get(key) || [];
        const today = isToday(day);
        const count = dayLessons.length;
        const isHighVolume = count > COMPACT_THRESHOLD;
        const isExpanded = expandedDays.has(key);
        const useCompact = compact || isHighVolume;

        // Teacher grouping for high-volume days
        const teacherGroups = isHighVolume
          ? groupByTeacher(dayLessons, teacherColourMap)
          : null;

        // For non-grouped, determine visible lessons
        const visibleLessons = !teacherGroups
          ? dayLessons
          : []; // handled by groups

        return (
          <div
            key={key}
            className={cn(
              'bg-background flex flex-col min-h-[200px]',
              today && 'bg-accent/30'
            )}
          >
            {/* Day header */}
            <div
              className={cn(
                'px-1.5 py-1.5 text-center border-b select-none',
                today
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground'
              )}
            >
              <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide">
                {format(day, 'EEE')}
              </div>
              <div className="flex items-center justify-center gap-1">
                <span className={cn(
                  'text-sm sm:text-lg font-bold leading-tight',
                  today ? 'text-primary-foreground' : 'text-foreground'
                )}>
                  {format(day, 'd')}
                </span>
                {count > 0 && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[9px] px-1 py-0 h-4 leading-none',
                      today && 'bg-primary-foreground/20 text-primary-foreground'
                    )}
                  >
                    {count}
                  </Badge>
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
              ) : teacherGroups ? (
                // Teacher-grouped layout for high-volume days
                <div className="space-y-1">
                  {teacherGroups.map((group) => {
                    const groupLessons = isExpanded
                      ? group.lessons
                      : group.lessons.slice(0, 3);
                    return (
                      <div key={group.teacherId || '__none__'}>
                        {/* Teacher sub-header */}
                        <div className={cn(
                          'flex items-center gap-1 px-0.5 py-0.5 rounded-sm mb-0.5',
                          group.colour.bgLight
                        )}>
                          <div
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: group.colour.hex }}
                          />
                          <span className={cn(
                            'text-[9px] sm:text-[10px] font-semibold truncate',
                            group.colour.text
                          )}>
                            {group.teacherName}
                            <span className="font-normal ml-0.5 opacity-70">({group.lessons.length})</span>
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {groupLessons.map((lesson) => (
                            <LessonCard
                              key={lesson.id}
                              lesson={lesson}
                              variant="stacked"
                              teacherColour={group.colour}
                              onClick={() => onLessonClick(lesson)}
                              compact={useCompact}
                            />
                          ))}
                          {!isExpanded && group.lessons.length > 3 && (
                            <div className="text-[9px] text-muted-foreground/60 pl-1">
                              +{group.lessons.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {/* Expand/Collapse toggle */}
                  <button
                    className="w-full flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors py-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(key);
                    }}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        <span>Show less</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        <span>Show all {count}</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                // Standard flat layout
                <div className="space-y-0.5">
                  {(isHighVolume && !isExpanded
                    ? visibleLessons.slice(0, VISIBLE_WHEN_COLLAPSED)
                    : visibleLessons
                  ).map((lesson) => {
                    const colour = getTeacherColour(
                      teacherColourMap,
                      (lesson as any).teacher_id || null
                    );
                    return (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        variant="stacked"
                        teacherColour={colour}
                        onClick={() => onLessonClick(lesson)}
                        compact={useCompact}
                      />
                    );
                  })}
                  {isHighVolume && !isExpanded && (
                    <button
                      className="w-full flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors py-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(key);
                      }}
                    >
                      <ChevronDown className="h-3 w-3" />
                      <span>Show {count - VISIBLE_WHEN_COLLAPSED} more</span>
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
