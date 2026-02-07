import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO, differenceInMinutes, startOfDay, setHours, setMinutes, endOfWeek, endOfDay } from 'date-fns';
import { LessonWithDetails, CalendarView } from './types';
import { LessonCard } from './LessonCard';
import { computeOverlapLayout } from './overlapLayout';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface ClosureInfo {
  date: Date;
  reason: string;
}

interface CalendarGridProps {
  currentDate: Date;
  view: CalendarView;
  lessons: LessonWithDetails[];
  onLessonClick: (lesson: LessonWithDetails) => void;
  onSlotClick: (date: Date) => void;
  onSlotDrag: (start: Date, end: Date) => void;
}

const HOUR_HEIGHT = 60; // pixels per hour
const START_HOUR = 7;
const END_HOUR = 21;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const TIME_GUTTER_WIDTH = 64; // 16 * 4 = 64px (w-16)

export function CalendarGrid({ 
  currentDate, 
  view, 
  lessons, 
  onLessonClick, 
  onSlotClick,
  onSlotDrag 
}: CalendarGridProps) {
  const { currentOrg } = useOrg();
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ date: Date; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [closures, setClosures] = useState<ClosureInfo[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const dayColumnsRef = useRef<HTMLDivElement>(null); // Ref ONLY for day columns (excludes time gutter)
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // Track if this was a drag operation to prevent click from firing
  const wasDragging = useRef(false);
  // Use ref for isDragging check in click handler to avoid stale closure
  const isDraggingRef = useRef(false);

  const days = useMemo(() => {
    if (view === 'day') {
      return [currentDate];
    }
    // Week view: Monday to Sunday
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [currentDate, view]);

  // Fetch closures for visible date range
  useEffect(() => {
    if (!currentOrg) return;
    
    const fetchClosures = async () => {
      const start = view === 'day' ? startOfDay(currentDate) : startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = view === 'day' ? endOfDay(currentDate) : endOfWeek(currentDate, { weekStartsOn: 1 });
      
      const { data } = await supabase
        .from('closure_dates')
        .select('date, reason')
        .eq('org_id', currentOrg.id)
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'));
      
      if (data) {
        setClosures(data.map(c => ({ date: parseISO(c.date), reason: c.reason })));
      }
    };
    
    fetchClosures();
  }, [currentOrg, currentDate, view]);

  const getClosureForDay = (day: Date): ClosureInfo | undefined => {
    return closures.find(c => isSameDay(c.date, day));
  };

  // No longer need getLessonPosition - handled by overlapLayout utility

  const getTimeFromY = (y: number): { hour: number; minute: number } => {
    const totalMinutes = ((y / HOUR_HEIGHT) * 60) + (START_HOUR * 60);
    const hour = Math.floor(totalMinutes / 60);
    const minute = Math.round((totalMinutes % 60) / 15) * 15; // Snap to 15-min intervals
    return { hour: Math.min(Math.max(hour, START_HOUR), END_HOUR), minute: minute % 60 };
  };

  /**
   * Get Y position relative to the day columns grid (excludes header)
   * This is the accurate calculation that accounts for:
   * 1. The dayColumnsRef bounding rect (excludes time gutter)
   * 2. Scroll position within the ScrollArea
   */
  const getAccurateY = (e: React.MouseEvent): number => {
    if (!dayColumnsRef.current) return 0;
    const rect = dayColumnsRef.current.getBoundingClientRect();
    return e.clientY - rect.top;
  };

  const handleMouseDown = (e: React.MouseEvent, day: Date) => {
    if (e.button !== 0) return;
    
    const y = getAccurateY(e);
    if (y < 0) return; // Click was above the grid (in header)
    
    const { hour, minute } = getTimeFromY(y);
    const startDate = setMinutes(setHours(startOfDay(day), hour), minute);
    
    setDragStart({ date: startDate, y });
    setDragEnd(y + 30); // Default 30 min
    setIsDragging(true);
    isDraggingRef.current = true;
    wasDragging.current = false;
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dayColumnsRef.current) return;
    
    const y = getAccurateY(e);
    const clampedY = Math.max(0, y);
    
    // If we've moved more than 10px, this is a drag operation
    if (dragStart && Math.abs(clampedY - dragStart.y) > 10) {
      wasDragging.current = true;
    }
    
    setDragEnd(clampedY);
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !dragStart || dragEnd === null) {
      setIsDragging(false);
      isDraggingRef.current = false;
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    // Only trigger drag callback if we actually dragged (moved significantly)
    if (wasDragging.current) {
      const startY = Math.min(dragStart.y, dragEnd);
      const endY = Math.max(dragStart.y, dragEnd);
      
      const { hour: startHour, minute: startMin } = getTimeFromY(startY);
      const { hour: endHour, minute: endMin } = getTimeFromY(endY);
      
      const startDate = setMinutes(setHours(startOfDay(dragStart.date), startHour), startMin);
      let endDate = setMinutes(setHours(startOfDay(dragStart.date), endHour), endMin);
      
      // Minimum 15 min duration
      if (differenceInMinutes(endDate, startDate) < 15) {
        endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
      }
      
      onSlotDrag(startDate, endDate);
    }
    
    setIsDragging(false);
    isDraggingRef.current = false;
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, onSlotDrag]);

  const handleSlotClick = (e: React.MouseEvent, day: Date) => {
    // Don't trigger if we were dragging
    if (wasDragging.current) {
      wasDragging.current = false;
      return;
    }
    
    // Don't trigger if still in drag mode (use ref for up-to-date value)
    if (isDraggingRef.current) return;
    
    const y = getAccurateY(e);
    if (y < 0) return; // Click was above the grid
    
    const { hour, minute } = getTimeFromY(y);
    const clickDate = setMinutes(setHours(startOfDay(day), hour), minute);
    
    onSlotClick(clickDate);
  };

  return (
    <ScrollArea className="h-[calc(100vh-280px)]" ref={scrollAreaRef}>
      <div 
        ref={gridRef}
        className="relative select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Header row */}
        <div className="sticky top-0 z-20 flex bg-background border-b">
          <div className="w-16 shrink-0" /> {/* Time gutter */}
          {days.map((day) => {
            const closure = getClosureForDay(day);
            return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'flex-1 text-center py-3 border-l',
                    isSameDay(day, new Date()) && 'bg-primary/5',
                    closure && 'bg-warning/10 dark:bg-warning/5'
                  )}
                >
                  <div className="text-sm text-muted-foreground">{format(day, 'EEE')}</div>
                  <div className={cn(
                    'text-lg font-semibold',
                    isSameDay(day, new Date()) && 'text-primary'
                  )}>
                    {format(day, 'd')}
                  </div>
                  {closure && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 mt-1 bg-warning/20 text-warning-foreground dark:bg-warning/30 dark:text-warning">
                      {closure.reason}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="flex">
          {/* Time labels */}
          <div className="w-16 shrink-0">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="relative border-b"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-2.5 right-2 text-xs text-muted-foreground">
                  {`${hour.toString().padStart(2, '0')}:00`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns - THIS ref is used for accurate click position */}
          <div ref={dayColumnsRef} className="flex flex-1">
            {days.map((day) => {
              const dayLessons = lessons.filter(l => isSameDay(parseISO(l.start_at), day));
              const closure = getClosureForDay(day);
              const overlapPositions = computeOverlapLayout(dayLessons, HOUR_HEIGHT, START_HOUR);
              
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'flex-1 relative border-l',
                    isSameDay(day, new Date()) && 'bg-primary/5',
                    closure && 'bg-warning/5 dark:bg-warning/5'
                  )}
                  onMouseDown={(e) => handleMouseDown(e, day)}
                  onClick={(e) => handleSlotClick(e, day)}
                >
                  {/* Hour grid lines */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-dashed border-muted"
                      style={{ height: HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Lessons with overlap layout */}
                  {dayLessons.map((lesson) => {
                    const pos = overlapPositions.get(lesson.id);
                    if (!pos) return null;
                    
                    const { top, height, columnIndex, totalColumns } = pos;
                    const widthPercent = 100 / totalColumns;
                    const leftPercent = columnIndex * widthPercent;
                    // Add small gap between columns
                    const gapPx = totalColumns > 1 ? 2 : 0;
                    
                    return (
                      <div
                        key={lesson.id}
                        className="absolute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded"
                        style={{ 
                          top, 
                          height,
                          left: `calc(${leftPercent}% + ${gapPx}px)`,
                          width: `calc(${widthPercent}% - ${gapPx * 2}px)`,
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${lesson.title} - ${format(parseISO(lesson.start_at), 'HH:mm')}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onLessonClick(lesson);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            onLessonClick(lesson);
                          }
                        }}
                      >
                        <LessonCard lesson={lesson} onClick={() => onLessonClick(lesson)} />
                      </div>
                    );
                  })}

                  {/* Drag selection overlay */}
                  {isDragging && dragStart && dragEnd !== null && isSameDay(dragStart.date, day) && (
                    <div
                      className="absolute left-1 right-1 bg-primary/20 border-2 border-primary border-dashed rounded"
                      style={{
                        top: Math.min(dragStart.y, dragEnd),
                        height: Math.abs(dragEnd - dragStart.y),
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
  );
}
