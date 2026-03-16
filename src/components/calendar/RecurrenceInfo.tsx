import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfDay, addDays, addWeeks, isAfter, isBefore, getDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { STALE_STABLE } from '@/config/query-stale-times';
import { Repeat, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface RecurrenceInfoProps {
  recurrenceId: string;
  currentLessonId: string;
  currentStartAt: string;
  /** Compact mode hides the icon (used when already inside a row with icon) */
  compact?: boolean;
}

const STATUS_BADGE: Record<string, { className: string; label: string }> = {
  scheduled: { className: 'bg-primary/10 text-primary', label: 'Scheduled' },
  completed: { className: 'bg-success/10 text-success', label: 'Completed' },
  cancelled: { className: 'bg-muted text-muted-foreground line-through', label: 'Cancelled' },
};

export function RecurrenceInfo({
  recurrenceId,
  currentLessonId,
  currentStartAt,
  compact = false,
}: RecurrenceInfoProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  // Query recurrence rule
  const { data: rule } = useQuery({
    queryKey: ['recurrence-rule', recurrenceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurrence_rules')
        .select('days_of_week, end_date, interval_weeks, start_date')
        .eq('id', recurrenceId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: STALE_STABLE,
  });

  // Query all lessons in this series
  const { data: seriesLessons } = useQuery({
    queryKey: ['recurrence-lessons', recurrenceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lessons')
        .select('id, start_at, status')
        .eq('recurrence_id', recurrenceId)
        .order('start_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE_STABLE,
  });

  const summary = useMemo(() => {
    if (!rule) return null;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = (rule.days_of_week || []).sort().map((d: number) => dayNames[d]).join(', ');
    const freq = rule.interval_weeks === 1 ? 'Weekly' : `Every ${rule.interval_weeks} weeks`;
    const endDate = rule.end_date ? format(parseISO(rule.end_date), 'd MMM yyyy') : null;

    // Count remaining from actual lesson data if available
    let remaining: number | null = null;
    if (seriesLessons?.length) {
      const now = startOfDay(new Date());
      remaining = seriesLessons.filter(
        (l) => l.status !== 'cancelled' && !isBefore(parseISO(l.start_at), now)
      ).length;
    } else if (rule.end_date && rule.days_of_week?.length) {
      // Fallback: calculate from rule
      const now = startOfDay(new Date());
      const end = parseISO(rule.end_date);
      const daysSet = new Set(rule.days_of_week as number[]);
      const intervalWeeks = rule.interval_weeks || 1;
      let count = 0;
      if (intervalWeeks === 1) {
        let current = now;
        while (!isAfter(current, end)) {
          if (daysSet.has(getDay(current))) count++;
          current = addDays(current, 1);
        }
      } else {
        const seriesStart = rule.start_date ? startOfDay(parseISO(rule.start_date)) : now;
        let weekCursor = seriesStart;
        while (isBefore(addWeeks(weekCursor, intervalWeeks), now)) {
          weekCursor = addWeeks(weekCursor, intervalWeeks);
        }
        while (!isAfter(weekCursor, end)) {
          for (let d = 0; d < 7; d++) {
            const date = addDays(weekCursor, d);
            if (daysSet.has(getDay(date)) && !isBefore(date, now) && !isAfter(date, end)) count++;
          }
          weekCursor = addWeeks(weekCursor, intervalWeeks);
        }
      }
      remaining = count;
    }

    const total = seriesLessons?.length ?? null;
    let desc = `${freq} on ${days}`;
    if (endDate) desc += ` · Until ${endDate}`;
    if (remaining !== null && total !== null) {
      desc += ` · ${remaining} of ${total} remaining`;
    } else if (remaining !== null) {
      desc += ` · ${remaining} remaining`;
    }
    return desc;
  }, [rule, seriesLessons]);

  if (!rule && !seriesLessons?.length) {
    // Still loading or no data — show simple label
    return (
      <div className="flex items-center gap-3">
        {!compact && <Repeat className="h-4 w-4 text-muted-foreground shrink-0" />}
        <span className="text-sm text-muted-foreground">Recurring lesson</span>
      </div>
    );
  }

  const now = startOfDay(new Date());

  const handleNavigateToDate = (lessonId: string, startAt: string) => {
    const dateStr = format(parseISO(startAt), 'yyyy-MM-dd');
    navigate(`/calendar?date=${dateStr}&highlight=${lessonId}`);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-start gap-3">
        {!compact && <Repeat className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-foreground hover:text-primary transition-colors w-full text-left">
            <span className="flex-1 min-w-0">{summary}</span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
            />
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="mt-2 max-h-[200px] overflow-y-auto space-y-0.5 pr-1">
              {seriesLessons?.map((l) => {
                const lessonDate = parseISO(l.start_at);
                const isPast = isBefore(lessonDate, now);
                const isCurrent = l.id === currentLessonId;
                const isCancelled = l.status === 'cancelled';
                const statusInfo = STATUS_BADGE[l.status] ?? STATUS_BADGE.scheduled;

                return (
                  <button
                    key={l.id}
                    onClick={() => handleNavigateToDate(l.id, l.start_at)}
                    className={cn(
                      'flex items-center gap-2 w-full rounded-md px-2 py-1 text-left text-sm transition-colors',
                      'hover:bg-muted/80',
                      isCurrent && 'bg-primary/5 font-medium',
                      isPast && !isCurrent && 'text-muted-foreground',
                      isCancelled && 'line-through text-muted-foreground'
                    )}
                  >
                    <span className="tabular-nums flex-1 min-w-0 truncate">
                      {format(lessonDate, 'EEE d MMM yyyy · HH:mm')}
                    </span>
                    <Badge className={cn('text-micro shrink-0 px-1.5 py-0 h-4', statusInfo.className)}>
                      {statusInfo.label}
                    </Badge>
                    {isCurrent && (
                      <span className="text-micro text-primary font-medium shrink-0">← this</span>
                    )}
                  </button>
                );
              })}
            </div>
          </CollapsibleContent>
        </div>
      </div>
    </Collapsible>
  );
}
