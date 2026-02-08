import { useMemo, useState, useEffect } from 'react';
import { format, startOfWeek, addDays, endOfWeek, isSameDay, parseISO, isToday, isSaturday, isSunday } from 'date-fns';
import { LessonWithDetails } from './types';
import { LessonCard } from './LessonCard';
import { TeacherWithColour, TeacherColourEntry, TEACHER_COLOURS } from './teacherColours';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileWeekView } from './MobileWeekView';

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

interface StackedWeekViewProps {
  currentDate: Date;
  lessons: LessonWithDetails[];
  teacherColourMap: Map<string, TeacherWithColour>;
  onLessonClick: (lesson: LessonWithDetails) => void;
  onSlotClick: (date: Date) => void;
  isParent: boolean;
}

export function StackedWeekView({
  currentDate,
  lessons,
  teacherColourMap,
  onLessonClick,
  onSlotClick,
  isParent,
}: StackedWeekViewProps) {
  const { currentOrg } = useOrg();
  const isMobile = useIsMobile();
  const [closures, setClosures] = useState<ClosureInfo[]>([]);

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
        if (data) {
          setClosures(data.map(c => ({ date: parseISO(c.date), reason: c.reason })));
        }
      });
  }, [currentOrg, currentDate]);

  // Build all 7 days (Mon–Sun)
  const allDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [currentDate]);

  // Auto-detect: show 5 columns if no weekend lessons, 7 if there are
  const hasWeekendLessons = useMemo(() => {
    return lessons.some((l) => {
      const d = parseISO(l.start_at);
      return isSaturday(d) || isSunday(d);
    });
  }, [lessons]);

  const days = useMemo(
    () => (hasWeekendLessons ? allDays : allDays.slice(0, 5)),
    [allDays, hasWeekendLessons]
  );
  const colCount = days.length;

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

  const getClosureForDay = (day: Date): ClosureInfo | undefined =>
    closures.find((c) => isSameDay(c.date, day));

  const now = new Date();
  const currentTimeLabel = format(now, 'HH:mm');

  // Mobile: swipeable horizontal layout
  if (isMobile) {
    return (
      <MobileWeekView
        days={days}
        lessons={lessons}
        teacherColourMap={teacherColourMap}
        onLessonClick={onLessonClick}
        onSlotClick={onSlotClick}
        isParent={isParent}
        closures={closures}
        currentDate={currentDate}
      />
    );
  }

  // Desktop: existing grid layout
  return (
    <ScrollArea className="h-[calc(100vh-260px)]">
      <div>
        <div
          className="grid border rounded-lg overflow-hidden"
          style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
        >
          {/* Day headers */}
          {days.map((day) => {
            const closure = getClosureForDay(day);
            const today = isToday(day);
            return (
              <div
                key={`header-${day.toISOString()}`}
                className={cn(
                  'bg-muted/30 px-0.5 sm:px-1.5 py-1.5 sm:py-2 text-center border-b border-r last:border-r-0',
                  today && 'bg-primary/5'
                )}
              >
                <div className="text-[10px] sm:text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                  {format(day, 'EEE')}
                </div>
                <div
                  className={cn(
                    'text-base sm:text-lg font-bold leading-none',
                    today && 'text-primary'
                  )}
                >
                  {format(day, 'd')}
                </div>
                {closure && (
                  <Badge
                    variant="outline"
                    className="text-[9px] sm:text-[10px] px-1 py-0 mt-0.5 bg-warning/20 text-warning-foreground dark:bg-warning/30 dark:text-warning"
                  >
                    {closure.reason}
                  </Badge>
                )}
              </div>
            );
          })}

          {/* Day columns with stacked cards */}
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayLessons = lessonsByDay.get(key) || [];
            const closure = getClosureForDay(day);
            const today = isToday(day);

            return (
              <div
                key={`col-${day.toISOString()}`}
                className={cn(
                  'bg-background min-h-[80px] flex flex-col border-r last:border-r-0',
                  today && 'bg-primary/[0.02]',
                  closure && 'bg-warning/5 dark:bg-warning/5'
                )}
              >
                {/* Now indicator */}
                {today && (
                  <div className="flex items-center gap-0.5 px-1 py-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
                    <span className="text-[9px] sm:text-[10px] font-medium text-destructive tabular-nums">
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
                    className="flex items-center justify-center py-0.5 text-muted-foreground/30 hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
