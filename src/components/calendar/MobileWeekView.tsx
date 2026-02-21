import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { format, isSameDay, parseISO, isToday, differenceInMinutes, addMinutes, setHours, setMinutes, startOfDay } from 'date-fns';
import { LessonWithDetails } from './types';
import { LessonCard } from './LessonCard';
import { TeacherWithColour, TeacherColourEntry, TEACHER_COLOURS, getTeacherColour } from './teacherColours';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

interface ClosureInfo {
  date: Date;
  reason: string;
}

function resolveColour(
  colourMap: Map<string, TeacherWithColour>,
  teacherId: string | null | undefined
): TeacherColourEntry {
  return getTeacherColour(colourMap, teacherId);
}

interface MobileWeekViewProps {
  days: Date[];
  lessons: LessonWithDetails[];
  teacherColourMap: Map<string, TeacherWithColour>;
  onLessonClick: (lesson: LessonWithDetails) => void;
  onSlotClick: (date: Date) => void;
  onLessonDrop?: (lesson: LessonWithDetails, newStart: Date, newEnd: Date) => void;
  isParent: boolean;
  closures: ClosureInfo[];
  currentDate: Date;
  savingLessonIds?: Set<string>;
}

export function MobileWeekView({
  days,
  lessons,
  teacherColourMap,
  onLessonClick,
  onSlotClick,
  onLessonDrop,
  isParent,
  closures,
  currentDate,
  savingLessonIds,
}: MobileWeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeDotIndex, setActiveDotIndex] = useState(0);
  const dayRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Long-press drag state
  const [dragLesson, setDragLesson] = useState<LessonWithDetails | null>(null);
  const [dragTargetDayIdx, setDragTargetDayIdx] = useState<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent, lesson: LessonWithDetails) => {
    if (isParent || !onLessonDrop) return;
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    longPressTimerRef.current = setTimeout(() => {
      try { navigator.vibrate?.(50); } catch {}
      setDragLesson(lesson);
    }, 300);
  }, [isParent, onLessonDrop]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragLesson) {
      // Cancel long-press if finger moved before activation
      if (longPressTimerRef.current && touchStartPos.current) {
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - touchStartPos.current.x);
        const dy = Math.abs(touch.clientY - touchStartPos.current.y);
        if (dx > 10 || dy > 10) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
      return;
    }
    e.preventDefault();
    const touch = e.touches[0];
    // Determine which day column the finger is over
    const container = scrollRef.current;
    if (!container) return;
    const dayWidth = container.scrollWidth / days.length;
    const scrollLeft = container.scrollLeft;
    const relativeX = touch.clientX - container.getBoundingClientRect().left + scrollLeft;
    const dayIdx = Math.min(Math.max(Math.floor(relativeX / dayWidth), 0), days.length - 1);
    setDragTargetDayIdx(dayIdx);
  }, [dragLesson, days.length]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (dragLesson && dragTargetDayIdx !== null && onLessonDrop) {
      const targetDay = days[dragTargetDayIdx];
      const originalStart = parseISO(dragLesson.start_at);
      const originalEnd = parseISO(dragLesson.end_at);
      const durationMs = originalEnd.getTime() - originalStart.getTime();
      // Keep same time of day, change the date
      const newStart = setMinutes(setHours(startOfDay(targetDay), originalStart.getHours()), originalStart.getMinutes());
      const newEnd = new Date(newStart.getTime() + durationMs);
      
      if (!isSameDay(originalStart, targetDay)) {
        onLessonDrop(dragLesson, newStart, newEnd);
      }
    }
    setDragLesson(null);
    setDragTargetDayIdx(null);
    touchStartPos.current = null;
  }, [dragLesson, dragTargetDayIdx, days, onLessonDrop]);

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
    <div
      className="flex flex-col h-[calc(100vh-260px)]"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Drag indicator */}
      {dragLesson && (
        <div className="bg-primary/10 border border-primary/30 rounded-md px-3 py-1.5 mx-2 mb-1 text-xs text-center text-primary font-medium animate-pulse">
          Drop on a day to reschedule · {dragLesson.title}
        </div>
      )}

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
              className="min-w-[80vw] snap-start flex flex-col border-r last:border-r-0"
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
                  'bg-background min-h-[80px] flex-1 flex flex-col overflow-y-auto transition-colors',
                  today && 'bg-primary/[0.02]',
                  closure && 'bg-warning/5 dark:bg-warning/5',
                  dragLesson && dragTargetDayIdx === idx && 'bg-primary/10 ring-2 ring-primary/30 ring-inset'
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
                    const colour = resolveColour(
                      teacherColourMap,
                      lesson.teacher_id
                    );
                    const isDragging = dragLesson?.id === lesson.id;
                    return (
                      <div
                        key={lesson.id}
                        onTouchStart={(e) => handleTouchStart(e, lesson)}
                        className={cn(
                          'transition-all',
                          isDragging && 'opacity-30 scale-95'
                        )}
                      >
                        <LessonCard
                          lesson={lesson}
                          onClick={() => { if (!dragLesson) onLessonClick(lesson); }}
                          variant="stacked"
                          teacherColour={colour}
                          isSaving={savingLessonIds?.has(lesson.id)}
                        />
                      </div>
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
                    aria-label={`Add lesson on ${format(day, 'EEEE, d MMMM')}`}
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
      <div className="flex items-center justify-center gap-1.5 py-2 bg-background border-t" role="tablist" aria-label="Day navigation">
        {days.map((day, idx) => (
          <button
            key={idx}
            onClick={() => scrollToDay(idx)}
            role="tab"
            aria-selected={idx === activeDotIndex}
            aria-current={isToday(day) ? 'date' : undefined}
            className={cn(
              'h-1.5 rounded-full transition-all duration-200',
              idx === activeDotIndex
                ? 'w-4 bg-primary'
                : 'w-1.5 bg-muted-foreground/25'
            )}
            aria-label={`Day ${idx + 1} of ${days.length}, ${format(day, 'EEEE d MMMM')}`}
          />
        ))}
      </div>
    </div>
  );
}
