import { useMemo, useState, useEffect } from 'react';
import { format, startOfWeek, addDays, endOfWeek, isSameDay, parseISO, isToday } from 'date-fns';
import { LessonWithDetails } from './types';
import { LessonCard } from './LessonCard';
import { TeacherWithColour, TeacherColourEntry, TEACHER_COLOURS } from './teacherColours';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';

interface ClosureInfo {
  date: Date;
  reason: string;
}

/**
 * Resolve teacher colour from the colour map using teacher_user_id.
 * The map is keyed by teachers.id, but lessons reference teacher_user_id.
 * We do a lookup via the userId field on TeacherWithColour.
 */
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
  const [closures, setClosures] = useState<ClosureInfo[]>([]);

  // Fetch closures for the visible week
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
  const days = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [currentDate]);

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

  // Current time for "now" indicator
  const now = new Date();
  const currentTimeLabel = format(now, 'HH:mm');

  return (
    <ScrollArea className="h-[calc(100vh-320px)]">
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
        {/* Day headers */}
        {days.map((day) => {
          const closure = getClosureForDay(day);
          const today = isToday(day);
          return (
            <div
              key={`header-${day.toISOString()}`}
              className={cn(
                'bg-background px-2 py-2.5 text-center',
                today && 'bg-primary/5'
              )}
            >
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {format(day, 'EEE')}
              </div>
              <div
                className={cn(
                  'text-lg font-bold mt-0.5',
                  today && 'text-primary'
                )}
              >
                {format(day, 'd')}
              </div>
              {closure && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 mt-1 bg-warning/20 text-warning-foreground dark:bg-warning/30 dark:text-warning"
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
                'bg-background min-h-[120px] flex flex-col',
                today && 'bg-primary/[0.02]',
                closure && 'bg-warning/5 dark:bg-warning/5'
              )}
            >
              {/* Now indicator */}
              {today && (
                <div className="flex items-center gap-1 px-2 py-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                  <span className="text-[10px] font-medium text-destructive tabular-nums">
                    {currentTimeLabel}
                  </span>
                  <div className="flex-1 h-px bg-destructive/40" />
                </div>
              )}

              {/* Stacked lesson cards */}
              <div className="flex-1 p-1.5 space-y-1.5">
                {dayLessons.length === 0 && (
                  <div className="text-xs text-muted-foreground/50 text-center py-4 italic">
                    No lessons
                  </div>
                )}
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

              {/* Add lesson affordance */}
              {!isParent && (
                <button
                  onClick={() => {
                    // Default to 9am on this day
                    const slotDate = new Date(day);
                    slotDate.setHours(9, 0, 0, 0);
                    onSlotClick(slotDate);
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground/60 hover:text-primary hover:bg-primary/5 transition-colors border-t border-dashed border-border/50 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span className="hidden sm:inline">Add</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
