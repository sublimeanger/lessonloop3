import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { format, isSameDay, parseISO, isToday } from 'date-fns';
import { LessonWithDetails } from './types';
import { LessonCard } from './LessonCard';
import { TeacherWithColour, TeacherColourEntry, TEACHER_COLOURS } from './teacherColours';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

interface ClosureInfo {
  date: Date;
  reason: string;
}

function resolveColourByUserId(
  colourMap: Map<string, TeacherWithColour>,
  teacherUserId: string | null | undefined
): TeacherColourEntry {
  if (!teacherUserId) return TEACHER_COLOURS[0];
  for (const entry of colourMap.values()) {
    if (entry.userId === teacherUserId) return entry.colour;
  }
  return TEACHER_COLOURS[0];
}

interface MobileWeekViewProps {
  days: Date[];
  lessons: LessonWithDetails[];
  teacherColourMap: Map<string, TeacherWithColour>;
  onLessonClick: (lesson: LessonWithDetails) => void;
  onSlotClick: (date: Date) => void;
  isParent: boolean;
  closures: ClosureInfo[];
  currentDate: Date;
}

export function MobileWeekView({
  days,
  lessons,
  teacherColourMap,
  onLessonClick,
  onSlotClick,
  isParent,
  closures,
  currentDate,
}: MobileWeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeDotIndex, setActiveDotIndex] = useState(0);
  const dayRefs = useRef<(HTMLDivElement | null)[]>([]);

  const lessonsByDay = useMemo(() => {
    const map = new Map<string, LessonWithDetails[]>();
    days.forEach((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const dayLessons = lessons
        .filter((l) => isSameDay(parseISO(l.start_at), day))
        .sort((a, b) => a.start_at.localeCompare(b.start_at));
      map.set(key, dayLessons);
    });
    return map;
  }, [days, lessons]);

  const getClosureForDay = useCallback(
    (day: Date): ClosureInfo | undefined => closures.find((c) => isSameDay(c.date, day)),
    [closures]
  );

  // Auto-scroll to today on mount / date change
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const todayIndex = days.findIndex((d) => isToday(d));
    const targetIndex = todayIndex >= 0 ? todayIndex : 0;
    const dayWidth = container.scrollWidth / days.length;

    // Scroll so the target day is roughly centered
    const scrollTarget = Math.max(0, dayWidth * targetIndex - container.clientWidth / 2 + dayWidth / 2);
    container.scrollTo({ left: scrollTarget, behavior: 'instant' });
  }, [days, currentDate]);

  // Track scroll position for dot indicators
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const dayWidth = container.scrollWidth / days.length;
      const centerX = container.scrollLeft + container.clientWidth / 2;
      const newIndex = Math.min(Math.floor(centerX / dayWidth), days.length - 1);
      setActiveDotIndex(newIndex);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // initial
    return () => container.removeEventListener('scroll', handleScroll);
  }, [days.length]);

  const scrollToDay = (index: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const dayWidth = container.scrollWidth / days.length;
    container.scrollTo({ left: dayWidth * index, behavior: 'smooth' });
  };

  const now = new Date();
  const currentTimeLabel = format(now, 'HH:mm');

  return (
    <div className="flex flex-col h-[calc(100vh-260px)]">
      {/* Swipeable day columns */}
      <div
        ref={scrollRef}
        className="flex-1 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {days.map((day, idx) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayLessons = lessonsByDay.get(key) || [];
          const closure = getClosureForDay(day);
          const today = isToday(day);

          return (
            <div
              key={key}
              ref={(el) => { dayRefs.current[idx] = el; }}
              className="min-w-[33.33vw] snap-start flex flex-col border-r last:border-r-0"
            >
              {/* Day header */}
              <button
                onClick={() => scrollToDay(idx)}
                className={cn(
                  'bg-muted/30 px-1 py-2 text-center border-b sticky top-0 z-10',
                  today && 'bg-primary/5'
                )}
              >
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  {format(day, 'EEE')}
                </div>
                <div
                  className={cn(
                    'text-lg font-bold leading-none',
                    today && 'text-primary'
                  )}
                >
                  {format(day, 'd')}
                </div>
                {closure && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 mt-0.5 bg-warning/20 text-warning-foreground dark:bg-warning/30 dark:text-warning"
                  >
                    {closure.reason}
                  </Badge>
                )}
              </button>

              {/* Day body */}
              <div
                className={cn(
                  'bg-background min-h-[80px] flex-1 flex flex-col overflow-y-auto',
                  today && 'bg-primary/[0.02]',
                  closure && 'bg-warning/5 dark:bg-warning/5'
                )}
              >
                {/* Now indicator */}
                {today && (
                  <div className="flex items-center gap-0.5 px-1 py-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
                    <span className="text-[9px] font-medium text-destructive tabular-nums">
                      {currentTimeLabel}
                    </span>
                    <div className="flex-1 h-px bg-destructive/30" />
                  </div>
                )}

                {/* Stacked lesson cards */}
                <div className="flex-1 p-0.5 space-y-px">
                  {dayLessons.map((lesson) => {
                    const colour = resolveColourByUserId(
                      teacherColourMap,
                      lesson.teacher_user_id
                    );
                    return (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        onClick={() => onLessonClick(lesson)}
                        variant="stacked"
                        teacherColour={colour}
                      />
                    );
                  })}
                </div>

                {/* Add lesson button */}
                {!isParent && (
                  <button
                    onClick={() => {
                      const slotDate = new Date(day);
                      slotDate.setHours(9, 0, 0, 0);
                      onSlotClick(slotDate);
                    }}
                    className="flex items-center justify-center py-1 text-muted-foreground/30 hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1.5 py-2 bg-background border-t">
        {days.map((day, idx) => (
          <button
            key={idx}
            onClick={() => scrollToDay(idx)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-200',
              idx === activeDotIndex
                ? 'w-4 bg-primary'
                : 'w-1.5 bg-muted-foreground/25'
            )}
            aria-label={format(day, 'EEEE d')}
          />
        ))}
      </div>
    </div>
  );
}
