import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { format, parseISO, isSameDay, setHours, setMinutes, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { LessonWithDetails } from './types';
import { TeacherWithColour, TeacherColourEntry, getTeacherColour } from './teacherColours';
import { computeOverlapLayout } from './overlapLayout';
import { useDragLesson } from './useDragLesson';
import { useResizeLesson } from './useResizeLesson';
import { DEFAULT_START_HOUR, DEFAULT_END_HOUR } from './calendarConstants';
import { useOrg } from '@/contexts/OrgContext';
import { ScrollArea } from '@/components/ui/scroll-area';

const DAY_HOUR_HEIGHT = 72;

function resolveColour(
  colourMap: Map<string, TeacherWithColour>,
  teacherId: string | null | undefined
): TeacherColourEntry {
  return getTeacherColour(colourMap, teacherId);
}

interface DayTimelineViewProps {
  currentDate: Date;
  lessons: LessonWithDetails[];
  teacherColourMap: Map<string, TeacherWithColour>;
  onLessonClick: (lesson: LessonWithDetails) => void;
  onSlotClick: (date: Date) => void;
  onSlotDrag: (start: Date, end: Date) => void;
  onLessonDrop?: (lesson: LessonWithDetails, newStart: Date, newEnd: Date) => void;
  onLessonResize?: (lesson: LessonWithDetails, newEnd: Date) => void;
  isParent: boolean;
  savingLessonIds?: Set<string>;
}

function roundTo15(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

const EMPTY_SAVING_SET = new Set<string>();

export function DayTimelineView({
  currentDate,
  lessons,
  teacherColourMap,
  onLessonClick,
  onSlotClick,
  onSlotDrag,
  onLessonDrop,
  onLessonResize,
  isParent,
  savingLessonIds = EMPTY_SAVING_SET,
}: DayTimelineViewProps) {
  const { currentOrg } = useOrg();
  const orgStartHour = currentOrg?.schedule_start_hour ?? DEFAULT_START_HOUR;
  const orgEndHour = currentOrg?.schedule_end_hour ?? DEFAULT_END_HOUR;

  // Filter lessons to current day
  const dayLessons = useMemo(
    () => lessons.filter((l) => isSameDay(parseISO(l.start_at), currentDate)),
    [lessons, currentDate]
  );

  // Expand hour range to include any out-of-range lessons
  const startHour = useMemo(() => {
    if (dayLessons.length === 0) return orgStartHour;
    const minHour = Math.min(...dayLessons.map(l => parseISO(l.start_at).getHours()));
    return Math.min(orgStartHour, minHour);
  }, [orgStartHour, dayLessons]);

  const endHour = useMemo(() => {
    if (dayLessons.length === 0) return orgEndHour;
    const maxHour = Math.max(...dayLessons.map(l => {
      const end = parseISO(l.end_at);
      return end.getMinutes() > 0 ? end.getHours() + 1 : end.getHours();
    }));
    return Math.max(orgEndHour, maxHour);
  }, [orgEndHour, dayLessons]);

  const totalHours = endHour - startHour;
  const gridHeight = totalHours * DAY_HOUR_HEIGHT;
  const hours = useMemo(() => Array.from({ length: totalHours }, (_, i) => startHour + i), [startHour, totalHours]);

  const gridRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  // Overlap layout
  const { positions } = useMemo(
    () => computeOverlapLayout(dayLessons, DAY_HOUR_HEIGHT, startHour),
    [dayLessons, startHour]
  );

  // Drag-to-reschedule
  const { dragState, startDragIntent, cancelDragIntent } = useDragLesson({
    days: [currentDate],
    onDrop: (lesson, newStart, newEnd) => onLessonDrop?.(lesson, newStart, newEnd),
    gridRef,
    scrollViewportRef,
    startHour,
    endHour,
  });

  // Resize
  const { resizeState, startResize } = useResizeLesson({
    onResize: (lesson, newEnd) => onLessonResize?.(lesson, newEnd),
    gridRef,
    scrollViewportRef,
    startHour,
    endHour,
  });

  // Drag-to-create state
  const [createDrag, setCreateDrag] = useState<{ startY: number; currentY: number } | null>(null);
  const createDragRef = useRef(createDrag);
  createDragRef.current = createDrag;

  const getTimeFromY = useCallback(
    (y: number): Date => {
      const totalMinutes = (y / DAY_HOUR_HEIGHT) * 60 + startHour * 60;
      const rounded = roundTo15(totalMinutes);
      const hour = Math.floor(rounded / 60);
      const minute = rounded % 60;
      return setMinutes(setHours(startOfDay(currentDate), Math.min(Math.max(hour, startHour), endHour)), minute);
    },
    [currentDate, startHour, endHour]
  );

  const handleGridMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isParent) return;
      if ((e.target as HTMLElement).closest('[data-lesson-block]')) return;
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      const scrollTop = viewport ? viewport.scrollTop : 0;
      const y = e.clientY - rect.top + scrollTop;
      setCreateDrag({ startY: y, currentY: y });
    },
    [isParent]
  );

  useEffect(() => {
    if (!createDrag) return;

    const handleMove = (e: MouseEvent) => {
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      const scrollTop = viewport ? viewport.scrollTop : 0;
      const y = e.clientY - rect.top + scrollTop;
      setCreateDrag((prev) => (prev ? { ...prev, currentY: y } : null));
    };

    const handleUp = () => {
      const drag = createDragRef.current;
      if (!drag) return;
      const topY = Math.min(drag.startY, drag.currentY);
      const bottomY = Math.max(drag.startY, drag.currentY);

      if (bottomY - topY < 10) {
        // Click — not a drag
        onSlotClick(getTimeFromY(topY));
      } else {
        onSlotDrag(getTimeFromY(topY), getTimeFromY(bottomY));
      }
      setCreateDrag(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [createDrag, getTimeFromY, onSlotClick, onSlotDrag]);

  // Now indicator
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const isToday = isSameDay(currentDate, now);
  const nowTop = useMemo(() => {
    if (!isToday) return null;
    const minutes = now.getHours() * 60 + now.getMinutes();
    const top = ((minutes - startHour * 60) / 60) * DAY_HOUR_HEIGHT;
    return top >= 0 && top <= gridHeight ? top : null;
  }, [isToday, now, startHour, gridHeight]);

  // Auto-scroll on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const viewport = scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (!viewport) return;

      let scrollTarget: number;
      if (dayLessons.length > 0) {
        const firstLesson = dayLessons.reduce((a, b) =>
          a.start_at < b.start_at ? a : b
        );
        const start = parseISO(firstLesson.start_at);
        const mins = start.getHours() * 60 + start.getMinutes();
        scrollTarget = ((mins - startHour * 60) / 60) * DAY_HOUR_HEIGHT - 20;
      } else if (isToday && nowTop !== null) {
        scrollTarget = nowTop - 80;
      } else {
        // Default to 9am
        scrollTarget = ((9 - startHour) * DAY_HOUR_HEIGHT) - 20;
      }

      viewport.scrollTop = Math.max(0, scrollTarget);
    }, 100);
    return () => clearTimeout(timer);
  }, [currentDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Create drag preview rectangle
  const createPreview = useMemo(() => {
    if (!createDrag) return null;
    const top = Math.min(createDrag.startY, createDrag.currentY);
    const height = Math.abs(createDrag.currentY - createDrag.startY);
    if (height < 5) return null;
    return { top, height };
  }, [createDrag]);

  return (
    <ScrollArea className="h-[calc(100vh-220px)] rounded-lg border bg-card" ref={scrollViewportRef}>
      <div className="flex select-none">
        {/* Time gutter */}
        <div className="w-14 shrink-0 border-r bg-muted/30">
          {hours.map((hour) => (
            <div
              key={hour}
              className="relative"
              style={{ height: DAY_HOUR_HEIGHT }}
            >
              <span className="absolute -top-2 right-2 text-caption text-muted-foreground tabular-nums">
                {format(setHours(new Date(), hour), 'HH:mm')}
              </span>
            </div>
          ))}
        </div>

        {/* Main grid area */}
        <div
          ref={gridRef}
          className="relative flex-1 cursor-crosshair"
          style={{ height: gridHeight }}
          onMouseDown={handleGridMouseDown}
        >
          {/* Hour lines */}
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-border/40"
              style={{ top: (hour - startHour) * DAY_HOUR_HEIGHT }}
            />
          ))}

          {/* Now indicator */}
          {nowTop !== null && (
            <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: nowTop }}>
              <div className="relative flex items-center">
                <div className="h-2.5 w-2.5 rounded-full bg-destructive -ml-[5px] shrink-0" />
                <div className="flex-1 h-px bg-destructive" />
              </div>
            </div>
          )}

          {/* Create drag preview */}
          {createPreview && (
            <div
              className="absolute left-2 right-2 rounded-md bg-primary/10 border border-primary/30 z-20 pointer-events-none"
              style={{ top: createPreview.top, height: createPreview.height }}
            />
          )}

          {/* Lesson blocks */}
          {dayLessons.map((lesson) => {
            const pos = positions.get(lesson.id);
            if (!pos) return null;

            const teacherColour = resolveColour(teacherColourMap, lesson.teacher_id);
            const colorHex = teacherColour.hex;
            const isCancelled = lesson.status === 'cancelled';
            const isSaving = savingLessonIds.has(lesson.id);
            const isDragging = dragState?.lesson.id === lesson.id;
            const isResizing = resizeState?.lesson.id === lesson.id;

            const top = isDragging ? dragState!.currentTop : pos.top;
            const height = isResizing
              ? resizeState!.currentBottom - resizeState!.top
              : pos.height;

            const students = lesson.participants
              ?.map((p) => `${p.student.first_name} ${p.student.last_name}`)
              .join(', ');

            const startTime = format(parseISO(lesson.start_at), 'HH:mm');
            const endTime = format(parseISO(lesson.end_at), 'HH:mm');

            // Column positioning for overlaps
            const colWidth = 100 / pos.totalColumns;
            const left = `${pos.columnIndex * colWidth}%`;
            const width = `calc(${colWidth}% - 4px)`;

            return (
              <div
                key={lesson.id}
                data-lesson-block
                className={cn(
                  'absolute rounded-md px-2 py-1.5 cursor-pointer overflow-hidden group',
                  'transition-all duration-150 ease-out',
                  'hover:shadow-card-hover hover:scale-[1.005]',
                  isCancelled && 'opacity-40',
                  isSaving && 'animate-pulse',
                  (isDragging || isResizing) && 'z-40 shadow-float opacity-80',
                )}
                style={{
                  top,
                  height: Math.max(height, 28),
                  left: `calc(${left} + 2px)`,
                  width,
                  borderLeft: `3px solid ${colorHex}`,
                  backgroundColor: `${colorHex}0F`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!dragState && !resizeState) onLessonClick(lesson);
                }}
                onMouseDown={(e) => {
                  if (!isParent && onLessonDrop) startDragIntent(lesson, e);
                }}
                onMouseUp={() => cancelDragIntent()}
              >
                {/* Hover ring */}
                <div
                  className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
                  style={{ boxShadow: `inset 0 0 0 2px ${colorHex}4D` }}
                />

                {/* Content */}
                <div className="relative z-10 min-w-0">
                  <p className={cn(
                    'text-body-strong truncate leading-tight',
                    isCancelled && 'line-through'
                  )}>
                    {students || lesson.title}
                  </p>
                  {height >= 44 && (
                    <p className="text-caption text-muted-foreground truncate mt-0.5">
                      {lesson.title}
                      {lesson.location && ` · ${lesson.location.name}`}
                    </p>
                  )}
                  {height >= 60 && (
                    <p className="text-micro text-muted-foreground tabular-nums mt-0.5">
                      {startTime}–{endTime}
                    </p>
                  )}
                </div>

                {/* Resize handle */}
                {!isParent && onLessonResize && height >= 36 && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => startResize(lesson, e)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
