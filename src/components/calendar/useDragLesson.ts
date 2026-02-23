import { useState, useRef, useCallback, useEffect } from 'react';
import { parseISO, differenceInMinutes, setHours, setMinutes, startOfDay } from 'date-fns';
import { LessonWithDetails } from './types';

import { HOUR_HEIGHT } from './calendarConstants';

export interface DragLessonState {
  /** The lesson being dragged */
  lesson: LessonWithDetails;
  /** Current snapped top position (px from grid top) */
  currentTop: number;
  /** Current day column index */
  currentDayIndex: number;
  /** Original top before drag started */
  originalTop: number;
  /** Original day column index */
  originalDayIndex: number;
}

interface UseDragLessonOptions {
  days: Date[];
  onDrop: (lesson: LessonWithDetails, newStart: Date, newEnd: Date) => void;
  gridRef: React.RefObject<HTMLDivElement | null>;
  scrollViewportRef: React.RefObject<HTMLDivElement | null>;
  startHour?: number;
  endHour?: number;
  /** Pixels per hour — defaults to HOUR_HEIGHT (60). DayTimelineView passes 72. */
  hourHeight?: number;
}

function getTimeFromY(y: number, startHour: number, endHour: number, hh: number): { hour: number; minute: number } {
  const totalMinutes = (y / hh) * 60 + startHour * 60;
  let hour = Math.floor(totalMinutes / 60);
  let minute = Math.round((totalMinutes % 60) / 15) * 15;
  if (minute >= 60) {
    hour += 1;
    minute = 0;
  }
  hour = Math.min(Math.max(hour, startHour), endHour);
  if (hour >= endHour) {
    minute = 0;
  }
  return { hour, minute };
}

function snapToGrid(y: number, hh: number): number {
  const quarterHeight = hh / 4; // 15-minute intervals
  return Math.round(y / quarterHeight) * quarterHeight;
}

export function useDragLesson({
  days,
  onDrop,
  gridRef,
  scrollViewportRef,
  startHour = 7,
  endHour = 21,
  hourHeight = HOUR_HEIGHT,
}: UseDragLessonOptions) {
  const [dragState, setDragState] = useState<DragLessonState | null>(null);
  const dragStateRef = useRef<DragLessonState | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startMousePos = useRef<{ x: number; y: number } | null>(null);
  const pendingLesson = useRef<LessonWithDetails | null>(null);
  const isDraggingRef = useRef(false);
  /** Offset from the top of the lesson card to where the user grabbed */
  const grabOffsetY = useRef(0);

  // Keep ref in sync with state
  dragStateRef.current = dragState;

  /** Call on mousedown / touchstart on a lesson card */
  const startDragIntent = useCallback(
    (lesson: LessonWithDetails, e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      startMousePos.current = { x: clientX, y: clientY };
      pendingLesson.current = lesson;

      // 150ms hold to distinguish from click
      holdTimerRef.current = setTimeout(() => {
        if (!gridRef.current || !pendingLesson.current) return;

        const lessonStart = parseISO(lesson.start_at);
        const startMinutes = lessonStart.getHours() * 60 + lessonStart.getMinutes();
        const top = ((startMinutes - startHour * 60) / 60) * hourHeight;

        // Compute grab offset: where the user clicked relative to the lesson's top in the grid
        const rect = gridRef.current.getBoundingClientRect();
        const viewport = scrollViewportRef.current?.querySelector(
          '[data-radix-scroll-area-viewport]'
        );
        const scrollTop = viewport ? viewport.scrollTop : 0;
        const mouseY = (startMousePos.current?.y ?? clientY);
        const gridY = mouseY - rect.top + scrollTop;
        grabOffsetY.current = gridY - top;

        // Find which day column the lesson is in
        const dayIndex = days.findIndex(
          (d) => d.toDateString() === lessonStart.toDateString()
        );

        isDraggingRef.current = true;
        setDragState({
          lesson,
          currentTop: top,
          currentDayIndex: dayIndex >= 0 ? dayIndex : 0,
          originalTop: top,
          originalDayIndex: dayIndex >= 0 ? dayIndex : 0,
        });

        // Haptic feedback on touch devices
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }, 150);
    },
    [days, gridRef, scrollViewportRef, startHour, hourHeight]
  );

  /** Cancel the hold timer if we release early (click, not drag) */
  const cancelDragIntent = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    pendingLesson.current = null;
    startMousePos.current = null;
  }, []);

  /** Update position during drag */
  const updateDragPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragStateRef.current || !gridRef.current) return;

      const rect = gridRef.current.getBoundingClientRect();
      const viewport = scrollViewportRef.current?.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      const scrollTop = viewport ? viewport.scrollTop : 0;

      const y = clientY - rect.top + scrollTop;
      const x = clientX - rect.left;

      // Subtract the grab offset so the card stays under the cursor
      const adjustedY = y - grabOffsetY.current;
      const snappedY = snapToGrid(Math.max(0, adjustedY), hourHeight);
      const colWidth = rect.width / days.length;
      const colIndex = Math.min(Math.max(0, Math.floor(x / colWidth)), days.length - 1);

      setDragState((prev) =>
        prev
          ? { ...prev, currentTop: snappedY, currentDayIndex: colIndex }
          : null
      );
    },
    [days, gridRef, scrollViewportRef, hourHeight]
  );

  /** Complete the drag — compute new times and call onDrop */
  const completeDrag = useCallback(() => {
    const current = dragStateRef.current;
    if (!current) return;
    isDraggingRef.current = false;

    const { lesson, currentTop, currentDayIndex, originalTop, originalDayIndex } = current;

    // If position hasn't changed, just cancel
    if (currentTop === originalTop && currentDayIndex === originalDayIndex) {
      setDragState(null);
      return;
    }

    // Compute new start time
    const { hour, minute } = getTimeFromY(currentTop, startHour, endHour, hourHeight);
    const newDay = days[currentDayIndex];
    const newStart = setMinutes(setHours(startOfDay(newDay), hour), minute);

    // Preserve original duration
    const originalStart = parseISO(lesson.start_at);
    const originalEnd = parseISO(lesson.end_at);
    const duration = differenceInMinutes(originalEnd, originalStart);
    const newEnd = new Date(newStart.getTime() + duration * 60 * 1000);

    setDragState(null);
    onDrop(lesson, newStart, newEnd);
  }, [days, onDrop, startHour, endHour, hourHeight]);

  /** Cancel drag without saving */
  const cancelDrag = useCallback(() => {
    isDraggingRef.current = false;
    setDragState(null);
    cancelDragIntent();
  }, [cancelDragIntent]);

  // Global mouse/touch move and up listeners during drag
  const isDragActive = !!dragState;
  useEffect(() => {
    if (!isDragActive) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      updateDragPosition(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      updateDragPosition(touch.clientX, touch.clientY);
    };

    const handleMouseUp = () => completeDrag();
    const handleTouchEnd = () => completeDrag();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDrag();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDragActive, updateDragPosition, completeDrag, cancelDrag]);

  // Clean up hold timer on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  return {
    dragState,
    isDragging: isDraggingRef.current || !!dragState,
    startDragIntent,
    cancelDragIntent,
    cancelDrag,
  };
}
