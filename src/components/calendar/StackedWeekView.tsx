import { useMemo } from 'react';
import { startOfWeek, addDays, format, isToday, isSameDay } from 'date-fns';
import { LessonWithDetails } from './types';
import { LessonCard } from './LessonCard';
import { TeacherWithColour, getTeacherColour } from './teacherColours';
import { cn } from '@/lib/utils';

interface StackedWeekViewProps {
  currentDate: Date;
  lessons: LessonWithDetails[];
  teacherColourMap: Map<string, TeacherWithColour>;
  onLessonClick: (lesson: LessonWithDetails) => void;
  onDayClick: (date: Date) => void;
  isParent: boolean;
}

export function StackedWeekView({
  currentDate,
  lessons,
  teacherColourMap,
  onLessonClick,
  onDayClick,
  isParent,
}: StackedWeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

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
    // Sort each day by start time
    for (const [, dayLessons] of map) {
      dayLessons.sort((a, b) => a.start_at.localeCompare(b.start_at));
    }
    return map;
  }, [lessons, days]);

  return (
    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd');
        const dayLessons = lessonsByDay.get(key) || [];
        const today = isToday(day);

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
              <div className={cn(
                'text-sm sm:text-lg font-bold leading-tight',
                today ? 'text-primary-foreground' : 'text-foreground'
              )}>
                {format(day, 'd')}
              </div>
            </div>

            {/* Lesson cards */}
            <div
              className={cn(
                'flex-1 p-0.5 sm:p-1 space-y-0.5 overflow-y-auto',
                !isParent && 'cursor-pointer'
              )}
              onClick={(e) => {
                // Only fire if clicking the empty area, not a card
                if (e.target === e.currentTarget && !isParent) {
                  // Default to 9am on that day
                  const noon = new Date(day);
                  noon.setHours(9, 0, 0, 0);
                  onDayClick(noon);
                }
              }}
            >
              {dayLessons.length === 0 ? (
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
                dayLessons.map((lesson) => {
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
                    />
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
