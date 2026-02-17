import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import {
  format,
  startOfWeek,
  addDays,
  endOfWeek,
  isSameDay,
  parseISO,
  differenceInMinutes,
  startOfDay,
  setHours,
  setMinutes,
  isToday,
  isSaturday,
  isSunday,
} from 'date-fns';
import { LessonWithDetails } from './types';
import { LessonCard } from './LessonCard';
import { computeOverlapLayout } from './overlapLayout';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { TeacherWithColour, TeacherColourEntry, TEACHER_COLOURS } from './teacherColours';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileWeekView } from './MobileWeekView';
import { useDragLesson, DragLessonState } from './useDragLesson';
import { useResizeLesson } from './useResizeLesson';

// ─── Constants ───────────────────────────────────────────────
const HOUR_HEIGHT = 60;
const START_HOUR = 7;
const END_HOUR = 21;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

interface ClosureInfo {
  date: Date;
  reason: string;
}

// ─── Helpers ─────────────────────────────────────────────────
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

function getTimeFromY(y: number): { hour: number; minute: number } {
  const totalMinutes = (y / HOUR_HEIGHT) * 60 + START_HOUR * 60;
  const hour = Math.floor(totalMinutes / 60);
  const minute = Math.round((totalMinutes % 60) / 15) * 15;
  return { hour: Math.min(Math.max(hour, START_HOUR), END_HOUR), minute: minute % 60 };
}

function formatTimeFromTop(top: number): string {
  const { hour, minute } = getTimeFromY(top);
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

// ─── Props ───────────────────────────────────────────────────
interface WeekTimeGridProps {
  currentDate: Date;
  lessons: LessonWithDetails[];
  teacherColourMap: Map<string, TeacherWithColour>;
  onLessonClick: (lesson: LessonWithDetails) => void;
  onSlotClick: (date: Date) => void;
  onSlotDrag: (start: Date, end: Date) => void;
  onLessonDrop?: (lesson: LessonWithDetails, newStart: Date, newEnd: Date) => void;
  onLessonResize?: (lesson: LessonWithDetails, newEnd: Date) => void;
  isParent: boolean;
}

export function WeekTimeGrid({
  currentDate,
  lessons,
  teacherColourMap,
  onLessonClick,
  onSlotClick,
  onSlotDrag,
  onLessonDrop,
  onLessonResize,
  isParent,
}: WeekTimeGridProps) {
  const { currentOrg } = useOrg();
  const isMobile = useIsMobile();
  const [closures, setClosures] = useState<ClosureInfo[]>([]);
  const dayColumnsRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  // Drag-to-create state
  const [isSlotDragging, setIsSlotDragging] = useState(false);
  const [slotDragStart, setSlotDragStart] = useState<{ date: Date; y: number } | null>(null);
  const [slotDragEnd, setSlotDragEnd] = useState<number | null>(null);
  const wasSlotDragging = useRef(false);
  const isSlotDraggingRef = useRef(false);

  // Now indicator
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // ─── Compute days (5 or 7 columns) ───────────────────────
  const allDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [currentDate]);

  const hasWeekendLessons = useMemo(
    () => lessons.some((l) => { const d = parseISO(l.start_at); return isSaturday(d) || isSunday(d); }),
    [lessons]
  );

  const days = useMemo(
    () => (hasWeekendLessons ? allDays : allDays.slice(0, 5)),
    [allDays, hasWeekendLessons]
  );

  // ─── Drag-to-reschedule hook ──────────────────────────────
  const handleLessonDrop = useCallback(
    (lesson: LessonWithDetails, newStart: Date, newEnd: Date) => {
      onLessonDrop?.(lesson, newStart, newEnd);
    },
    [onLessonDrop]
  );

  const { dragState, isDragging: isLessonDragging, startDragIntent, cancelDragIntent } = useDragLesson({
    days,
    onDrop: handleLessonDrop,
    gridRef: dayColumnsRef,
    scrollViewportRef,
  });

  // ─── Drag-to-resize hook ──────────────────────────────────
  const handleLessonResize = useCallback(
    (lesson: LessonWithDetails, newEnd: Date) => {
      onLessonResize?.(lesson, newEnd);
    },
    [onLessonResize]
  );

  const { resizeState, isResizing, startResize } = useResizeLesson({
    onResize: handleLessonResize,
    gridRef: dayColumnsRef,
    scrollViewportRef,
  });

  // ─── Fetch closures ──────────────────────────────────────
  useEffect(() => {
    if (!currentOrg) return;
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    supabase
      .from('closure_dates')
      .select('date, reason')
      .eq('org_id', currentOrg.id)
      .gte('date', format(start, 'yyyy-MM-dd'))
      .lte('date', format(end, 'yyyy-MM-dd'))
      .then(({ data }) => {
        if (data) setClosures(data.map((c) => ({ date: parseISO(c.date), reason: c.reason })));
      });
  }, [currentOrg, currentDate]);

  const getClosureForDay = (day: Date): ClosureInfo | undefined =>
    closures.find((c) => isSameDay(c.date, day));

  // ─── Auto-scroll to current time on mount ─────────────────
  useEffect(() => {
    if (hasScrolledRef.current) return;
    const tryScroll = () => {
      const viewport = scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (!viewport) return;
      const scrollHour = Math.max(START_HOUR, Math.min(new Date().getHours() - 1, END_HOUR - 2));
      const scrollTop = (scrollHour - START_HOUR) * HOUR_HEIGHT;
      viewport.scrollTop = scrollTop;
      hasScrolledRef.current = true;
    };
    const timer = setTimeout(tryScroll, 100);
    return () => clearTimeout(timer);
  }, [currentDate]);

  useEffect(() => { hasScrolledRef.current = false; }, [currentDate]);

  // ─── Mouse handlers for click-to-create & drag-to-create ──
  const getAccurateY = (e: React.MouseEvent): number => {
    if (!dayColumnsRef.current) return 0;
    const rect = dayColumnsRef.current.getBoundingClientRect();
    const viewport = scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    const scrollTop = viewport ? viewport.scrollTop : 0;
    return e.clientY - rect.top + scrollTop;
  };

  const getDayFromX = (e: React.MouseEvent): Date | null => {
    if (!dayColumnsRef.current) return null;
    const rect = dayColumnsRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const colWidth = rect.width / days.length;
    const colIndex = Math.floor(x / colWidth);
    if (colIndex < 0 || colIndex >= days.length) return null;
    return days[colIndex];
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isParent || isLessonDragging || isResizing) return;
    const day = getDayFromX(e);
    if (!day) return;
    const y = getAccurateY(e);
    if (y < 0) return;
    const { hour, minute } = getTimeFromY(y);
    const startDate = setMinutes(setHours(startOfDay(day), hour), minute);
    setSlotDragStart({ date: startDate, y });
    setSlotDragEnd(y + (HOUR_HEIGHT / 2));
    setIsSlotDragging(true);
    isSlotDraggingRef.current = true;
    wasSlotDragging.current = false;
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isSlotDragging || !dayColumnsRef.current) return;
      const y = getAccurateY(e);
      const clampedY = Math.max(0, y);
      if (slotDragStart && Math.abs(clampedY - slotDragStart.y) > 10) {
        wasSlotDragging.current = true;
      }
      setSlotDragEnd(clampedY);
    },
    [isSlotDragging, slotDragStart]
  );

  const handleMouseUp = useCallback(() => {
    if (!isSlotDragging || !slotDragStart || slotDragEnd === null) {
      setIsSlotDragging(false);
      isSlotDraggingRef.current = false;
      setSlotDragStart(null);
      setSlotDragEnd(null);
      return;
    }
    if (wasSlotDragging.current) {
      const startY = Math.min(slotDragStart.y, slotDragEnd);
      const endY = Math.max(slotDragStart.y, slotDragEnd);
      const { hour: startHour, minute: startMin } = getTimeFromY(startY);
      const { hour: endHour, minute: endMin } = getTimeFromY(endY);
      const startDate = setMinutes(setHours(startOfDay(slotDragStart.date), startHour), startMin);
      let endDate = setMinutes(setHours(startOfDay(slotDragStart.date), endHour), endMin);
      if (differenceInMinutes(endDate, startDate) < 15) {
        endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
      }
      onSlotDrag(startDate, endDate);
    }
    setIsSlotDragging(false);
    isSlotDraggingRef.current = false;
    setSlotDragStart(null);
    setSlotDragEnd(null);
  }, [isSlotDragging, slotDragStart, slotDragEnd, onSlotDrag]);

  const handleSlotClick = (e: React.MouseEvent) => {
    if (wasSlotDragging.current) { wasSlotDragging.current = false; return; }
    if (isSlotDraggingRef.current || isParent || isLessonDragging || isResizing) return;
    const day = getDayFromX(e);
    if (!day) return;
    const y = getAccurateY(e);
    if (y < 0) return;
    const { hour, minute } = getTimeFromY(y);
    const clickDate = setMinutes(setHours(startOfDay(day), hour), minute);
    onSlotClick(clickDate);
  };

  // ─── Now-line position ────────────────────────────────────
  const nowTop = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const showNowLine = nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60;

  // ─── Mobile: delegate ─────────────────────────────────────
  if (isMobile) {
    return (
      <MobileWeekView
        days={days}
        lessons={lessons}
        teacherColourMap={teacherColourMap}
        onLessonClick={onLessonClick}
        onSlotClick={onSlotClick}
        onLessonDrop={onLessonDrop}
        isParent={isParent}
        closures={closures}
        currentDate={currentDate}
      />
    );
  }

  // ─── Desktop: time-grid ────────────────────────────────────
  return (
    <div ref={scrollViewportRef}>
      <ScrollArea className="h-[calc(100vh-260px)]">
        <div
          className={cn('relative select-none', (isLessonDragging || isResizing) && 'cursor-grabbing')}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* ── Sticky day headers ── */}
          <div className="sticky top-0 z-20 flex bg-background border-b">
            <div className="w-16 shrink-0" />
            {days.map((day) => {
              const closure = getClosureForDay(day);
              const today = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'flex-1 text-center py-2 border-l',
                    today && 'bg-primary/5',
                    closure && 'bg-warning/10 dark:bg-warning/5'
                  )}
                >
                  <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    {format(day, 'EEE')}
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <span className={cn('text-lg font-bold leading-none', today && 'text-primary')}>
                      {format(day, 'd')}
                    </span>
                    {(() => {
                      const dayCount = lessons.filter((l) => isSameDay(parseISO(l.start_at), day)).length;
                      return dayCount > 10 ? (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 leading-none">
                          {dayCount}
                        </Badge>
                      ) : null;
                    })()}
                  </div>
                  {closure && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1 py-0 mt-0.5 bg-warning/20 text-warning-foreground dark:bg-warning/30 dark:text-warning"
                    >
                      {closure.reason}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Time grid body ── */}
          <div className="flex">
            {/* Time gutter */}
            <div className="w-16 shrink-0">
              {HOURS.map((hour) => (
                <div key={hour} className="relative border-b" style={{ height: HOUR_HEIGHT }}>
                  <span className="absolute -top-2.5 right-2 text-xs text-muted-foreground tabular-nums">
                    {`${hour.toString().padStart(2, '0')}:00`}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            <div
              ref={dayColumnsRef}
              className="flex flex-1 relative"
              onMouseDown={handleMouseDown}
              onClick={handleSlotClick}
            >
              {days.map((day, dayIndex) => {
                const dayLessons = lessons.filter((l) => isSameDay(parseISO(l.start_at), day));
                const closure = getClosureForDay(day);
                const today = isToday(day);
                const { positions: overlapPositions, overflowBuckets } = computeOverlapLayout(dayLessons, HOUR_HEIGHT, START_HOUR, 4);

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'flex-1 relative border-l',
                      today && 'bg-primary/[0.03]',
                      closure && 'bg-warning/5 dark:bg-warning/5'
                    )}
                  >
                    {/* Hour grid lines + half-hour dividers */}
                    {HOURS.map((hour) => (
                      <div key={hour} className="relative border-b border-muted/40" style={{ height: HOUR_HEIGHT }}>
                        <div className="absolute top-1/2 left-0 right-0 border-b border-dashed border-muted/20" />
                      </div>
                    ))}

                    {/* Now indicator */}
                    {today && showNowLine && (
                      <div
                        className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
                        style={{ top: nowTop }}
                      >
                        <div className="h-2.5 w-2.5 rounded-full bg-destructive -ml-[5px] shrink-0" />
                        <div className="flex-1 h-[2px] bg-destructive" />
                      </div>
                    )}

                    {/* Positioned lesson cards */}
                    {dayLessons.map((lesson) => {
                      const pos = overlapPositions.get(lesson.id);
                      if (!pos) return null;
                      const { top, height, columnIndex, totalColumns } = pos;
                      const widthPercent = 100 / totalColumns;
                      const leftPercent = columnIndex * widthPercent;
                      const gapPx = totalColumns > 1 ? 2 : 0;

                      const isDragGhost = dragState?.lesson.id === lesson.id;
                      const isBeingResized = resizeState?.lesson.id === lesson.id;
                      const displayHeight = isBeingResized
                        ? resizeState!.currentBottom - resizeState!.top
                        : height;

                      return (
                        <div
                          key={lesson.id}
                          className={cn(
                            'absolute z-[5] rounded transition-opacity',
                            isDragGhost && 'opacity-30',
                            !isDragGhost && !isParent && 'cursor-grab'
                          )}
                          style={{
                            top,
                            height: displayHeight,
                            left: `calc(${leftPercent}% + ${gapPx}px)`,
                            width: `calc(${widthPercent}% - ${gapPx * 2}px)`,
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`${lesson.title} - ${format(parseISO(lesson.start_at), 'HH:mm')}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isLessonDragging && !isResizing) onLessonClick(lesson);
                          }}
                          onMouseDown={(e) => {
                            if (!isParent && onLessonDrop) {
                              startDragIntent(lesson, e);
                            }
                          }}
                          onMouseUp={() => {
                            if (!isLessonDragging) cancelDragIntent();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              onLessonClick(lesson);
                            }
                          }}
                        >
                          <LessonCard
                            lesson={lesson}
                            onClick={() => {
                              if (!isLessonDragging && !isResizing) onLessonClick(lesson);
                            }}
                            teacherColour={resolveColourByUserId(teacherColourMap, lesson.teacher_user_id)}
                            showResizeHandle={!isParent && !!onLessonResize}
                            onResizeStart={(e) => startResize(lesson, e)}
                            compact={totalColumns >= 3}
                          />
                        </div>
                      );
                    })}

                    {/* Overflow "+N more" pills */}
                    {Array.from(overflowBuckets.entries()).map(([bucketKey, bucket]) => {
                      const maxCols = 4;
                      const pillCol = maxCols - 1;
                      const widthPercent = 100 / maxCols;
                      const leftPercent = pillCol * widthPercent;
                      return (
                        <Popover key={`overflow-${bucketKey}`}>
                          <PopoverTrigger asChild>
                            <button
                              className="absolute z-[6] rounded-sm bg-muted/80 hover:bg-muted text-[10px] font-semibold text-muted-foreground px-1 py-0.5 cursor-pointer transition-colors truncate text-center"
                              style={{
                                top: bucket.top,
                                height: Math.max(bucket.height, 20),
                                left: `calc(${leftPercent}% + 2px)`,
                                width: `calc(${widthPercent}% - 4px)`,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              +{bucket.lessons.length} more
                            </button>
                          </PopoverTrigger>
                          <PopoverContent side="right" className="w-64 p-2 max-h-60 overflow-y-auto" align="start">
                            <div className="text-xs font-semibold text-muted-foreground mb-1.5">
                              {bucket.lessons.length} more lesson{bucket.lessons.length > 1 ? 's' : ''}
                            </div>
                            <div className="flex flex-col gap-1">
                              {bucket.lessons.map((lesson) => (
                                <LessonCard
                                  key={lesson.id}
                                  lesson={lesson}
                                  variant="stacked"
                                  onClick={() => onLessonClick(lesson)}
                                  teacherColour={resolveColourByUserId(teacherColourMap, lesson.teacher_user_id)}
                                />
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })}

                    {/* Drag ghost preview (the floating copy) */}
                    {dragState && dragState.currentDayIndex === dayIndex && (
                      <div
                        className="absolute z-[20] left-1 right-1 pointer-events-none"
                        style={{
                          top: dragState.currentTop,
                          height: (() => {
                            const start = parseISO(dragState.lesson.start_at);
                            const end = parseISO(dragState.lesson.end_at);
                            const dur = differenceInMinutes(end, start);
                            return (dur / 60) * HOUR_HEIGHT;
                          })(),
                        }}
                      >
                        <div className="h-full w-full rounded-sm shadow-lg ring-2 ring-primary/50 opacity-80">
                          <LessonCard
                            lesson={dragState.lesson}
                            onClick={() => {}}
                            teacherColour={resolveColourByUserId(teacherColourMap, dragState.lesson.teacher_user_id)}
                          />
                        </div>
                        {/* Time tooltip */}
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-mono px-1.5 py-0.5 rounded shadow">
                          {formatTimeFromTop(dragState.currentTop)}
                        </div>
                      </div>
                    )}

                    {/* Drag-to-create selection overlay */}
                    {isSlotDragging &&
                      slotDragStart &&
                      slotDragEnd !== null &&
                      isSameDay(slotDragStart.date, day) && (
                        <div
                          className="absolute left-1 right-1 bg-primary/20 border-2 border-primary border-dashed rounded z-[15]"
                          style={{
                            top: Math.min(slotDragStart.y, slotDragEnd),
                            height: Math.abs(slotDragEnd - slotDragStart.y),
                          }}
                        />
                      )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
