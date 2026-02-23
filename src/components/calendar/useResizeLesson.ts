import { useState, useRef, useCallback, useEffect } from 'react';
import { parseISO } from 'date-fns';
import { LessonWithDetails } from './types';

import { HOUR_HEIGHT } from './calendarConstants';
const MIN_DURATION = 15; // minutes

export interface ResizeState {
  lesson: LessonWithDetails;
  /** Current bottom position in px from grid top */
  currentBottom: number;
  /** Original bottom before resize started */
  originalBottom: number;
  /** Fixed top position (start doesn't move) */
  top: number;
}

interface UseResizeLessonOptions {
  onResize: (lesson: LessonWithDetails, newEndDate: Date) => void;
  gridRef: React.RefObject<HTMLDivElement | null>;
  scrollViewportRef: React.RefObject<HTMLDivElement | null>;
  startHour?: number;
  endHour?: number;
  /** Pixels per hour — defaults to HOUR_HEIGHT (60). DayTimelineView passes 72. */
  hourHeight?: number;
}

function snapToGrid(y: number, hh: number): number {
  const quarterHeight = hh / 4;
  return Math.round(y / quarterHeight) * quarterHeight;
}

export function useResizeLesson({
  onResize,
  gridRef,
  scrollViewportRef,
  startHour = 7,
  endHour = 21,
  hourHeight = HOUR_HEIGHT,
}: UseResizeLessonOptions) {
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const isResizingRef = useRef(false);

  // Keep ref in sync with state
  resizeStateRef.current = resizeState;

  const startResize = useCallback(
    (lesson: LessonWithDetails, e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const start = parseISO(lesson.start_at);
      const end = parseISO(lesson.end_at);
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();

      const top = ((startMinutes - startHour * 60) / 60) * hourHeight;
      const bottom = ((endMinutes - startHour * 60) / 60) * hourHeight;

      isResizingRef.current = true;
      setResizeState({
        lesson,
        currentBottom: bottom,
        originalBottom: bottom,
        top,
      });
    },
    [startHour, hourHeight]
  );

  const updateResize = useCallback(
    (clientY: number) => {
      const current = resizeStateRef.current;
      if (!current || !gridRef.current) return;

      const rect = gridRef.current.getBoundingClientRect();
      const viewport = scrollViewportRef.current?.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      const scrollTop = viewport ? viewport.scrollTop : 0;
      const y = clientY - rect.top + scrollTop;

      // Enforce minimum duration (15 minutes = hourHeight/4)
      const minBottom = current.top + (MIN_DURATION / 60) * hourHeight;
      const maxBottom = (endHour - startHour) * hourHeight;
      const snapped = snapToGrid(Math.min(Math.max(y, minBottom), maxBottom), hourHeight);

      setResizeState((prev) => (prev ? { ...prev, currentBottom: snapped } : null));
    },
    [gridRef, scrollViewportRef, startHour, endHour, hourHeight]
  );

  const completeResize = useCallback(() => {
    const current = resizeStateRef.current;
    if (!current) return;
    isResizingRef.current = false;

    const { lesson, currentBottom, originalBottom } = current;

    if (currentBottom === originalBottom) {
      setResizeState(null);
      return;
    }

    // Compute new end time from currentBottom
    const endMinutesFromGridTop = (currentBottom / hourHeight) * 60;
    const totalEndMinutes = endMinutesFromGridTop + startHour * 60;
    let endHr = Math.floor(totalEndMinutes / 60);
    let endMinute = Math.round(totalEndMinutes % 60);
    if (endMinute >= 60) {
      endHr += 1;
      endMinute = 0;
    }

    const originalStart = parseISO(lesson.start_at);
    const newEnd = new Date(originalStart);
    newEnd.setHours(endHr, endMinute, 0, 0);

    setResizeState(null);
    onResize(lesson, newEnd);
  }, [onResize, startHour, hourHeight]);

  const cancelResize = useCallback(() => {
    isResizingRef.current = false;
    setResizeState(null);
  }, []);

  // Global listeners during resize
  const isResizeActive = !!resizeState;
  useEffect(() => {
    if (!isResizeActive) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      updateResize(e.clientY);
    };
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      updateResize(e.touches[0].clientY);
    };
    const handleUp = () => completeResize();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelResize();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isResizeActive, updateResize, completeResize, cancelResize]);

  return {
    resizeState,
    isResizing: isResizingRef.current || !!resizeState,
    startResize,
    cancelResize,
  };
}
