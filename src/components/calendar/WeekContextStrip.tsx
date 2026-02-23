import { useMemo } from 'react';
import { format, startOfWeek, addDays, isSameDay, isToday, isWeekend } from 'date-fns';
import { cn } from '@/lib/utils';
import { LessonWithDetails } from './types';
import type { CalendarView } from './types';

interface WeekContextStripProps {
  currentDate: Date;
  onDayClick: (date: Date) => void;
  lessonsByDay: Map<string, LessonWithDetails[]>;
  view: CalendarView;
}

export function WeekContextStrip({
  currentDate,
  onDayClick,
  lessonsByDay,
  view,
}: WeekContextStripProps) {
  const weekStartKey = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartKey]);

  const monthLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    if (start.getMonth() === end.getMonth()) {
      return format(start, 'MMMM yyyy');
    }
    return `${format(start, 'MMM')} – ${format(end, 'MMM yyyy')}`;
  }, [weekDays]);

  return (
    <div className="space-y-1.5">
      {/* Month label */}
      <p className="text-caption text-muted-foreground font-medium tracking-wide uppercase">
        {monthLabel}
      </p>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayLessons = lessonsByDay.get(key) ?? [];
          const count = dayLessons.length;
          const isSelected = isSameDay(day, currentDate);
          const isTodayDate = isToday(day);
          const isWeekendDay = isWeekend(day);
          const dots = Math.min(Math.ceil(count / 10), 5);

          return (
            <button
              key={key}
              onClick={() => onDayClick(day)}
              className={cn(
                'flex flex-col items-center py-1.5 sm:py-2 rounded-xl transition-all duration-150 cursor-pointer',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                isSelected
                  ? 'bg-foreground text-background shadow-sm'
                  : isTodayDate
                    ? 'bg-accent text-accent-foreground'
                    : isWeekendDay && count === 0
                      ? 'text-muted-foreground/60 hover:bg-muted/50'
                      : 'text-foreground hover:bg-muted/70',
              )}
            >
              <span className={cn(
                'text-[10px] sm:text-caption font-medium uppercase tracking-wider leading-none',
                isSelected ? 'text-background/70' : 'text-muted-foreground',
              )}>
                {format(day, 'EEE').toUpperCase()}
              </span>
              <span className={cn(
                'text-base sm:text-lg font-bold leading-tight mt-0.5',
              )}>
                {format(day, 'd')}
              </span>
              {/* Lesson dots */}
              <div className="flex gap-0.5 mt-1 h-1.5">
                {dots > 0 &&
                  Array.from({ length: dots }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-1 w-1 rounded-full',
                        isSelected ? 'bg-background/50' : 'bg-primary/60',
                      )}
                    />
                  ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
