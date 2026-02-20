import { useState, useRef, useCallback, useEffect } from 'react';
import { parseISO, differenceInMinutes, setHours, setMinutes, startOfDay, addDays } from 'date-fns';
import { LessonWithDetails } from './types';

const HOUR_HEIGHT = 60;

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
}

function getTimeFromY(y: number, startHour: number, endHour: number): { hour: number; minute: number } {
  const totalMinutes = (y / HOUR_HEIGHT) * 60 + startHour * 60;
  const hour = Math.floor(totalMinutes / 60);
  const minute = Math.round((totalMinutes % 60) / 15) * 15;
  return {
    hour: Math.min(Math.max(hour, startHour), endHour),
    minute: minute >= 60 ? 0 : minute,
  };
}

function snapToGrid(y: number): number {
  const quarterHeight = HOUR_HEIGHT / 4; // 15-minute intervals
  return Math.round(y / quarterHeight) * quarterHeight;
}

export function useDragLesson({ days, onDrop, gridRef, scrollViewportRef, startHour = 7, endHour = 21 }: UseDragLessonOptions) {
  const [dragState, setDragState] = useState<DragLessonState | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startMousePos = useRef<{ x: number; y: number } | null>(null);
  const pendingLesson = useRef<LessonWithDetails | null>(null);
  const isDraggingRef = useRef(false);

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
        const top = ((startMinutes - startHour * 60) / 60) * HOUR_HEIGHT;

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
    [days, gridRef]
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
      if (!dragState || !gridRef.current) return;

      const rect = gridRef.current.getBoundingClientRect();
      const viewport = scrollViewportRef.current?.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      const scrollTop = viewport ? viewport.scrollTop : 0;

      const y = clientY - rect.top + scrollTop;
      const x = clientX - rect.left;

      const snappedY = snapToGrid(Math.max(0, y));
      const colWidth = rect.width / days.length;
      const colIndex = Math.min(Math.max(0, Math.floor(x / colWidth)), days.length - 1);

      setDragState((prev) =>
        prev
          ? { ...prev, currentTop: snappedY, currentDayIndex: colIndex }
          : null
      );
    },
    [dragState, days, gridRef, scrollViewportRef]
  );

  /** Complete the drag — compute new times and call onDrop */
  const completeDrag = useCallback(() => {
    if (!dragState) return;
    isDraggingRef.current = false;

    const { lesson, currentTop, currentDayIndex, originalTop, originalDayIndex } = dragState;

    // If position hasn't changed, just cancel
    if (currentTop === originalTop && currentDayIndex === originalDayIndex) {
      setDragState(null);
      return;
    }

    // Compute new start time
    const { hour, minute } = getTimeFromY(currentTop, startHour, endHour);
    const newDay = days[currentDayIndex];
    const newStart = setMinutes(setHours(startOfDay(newDay), hour), minute);

    // Preserve original duration
    const originalStart = parseISO(lesson.start_at);
    const originalEnd = parseISO(lesson.end_at);
    const duration = differenceInMinutes(originalEnd, originalStart);
    const newEnd = new Date(newStart.getTime() + duration * 60 * 1000);

    setDragState(null);
    onDrop(lesson, newStart, newEnd);
  }, [dragState, days, onDrop]);

  /** Cancel drag without saving */
  const cancelDrag = useCallback(() => {
    isDraggingRef.current = false;
    setDragState(null);
    cancelDragIntent();
  }, [cancelDragIntent]);

  // Global mouse/touch move and up listeners during drag
  useEffect(() => {
    if (!dragState) return;

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
  }, [dragState, updateDragPosition, completeDrag, cancelDrag]);

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
