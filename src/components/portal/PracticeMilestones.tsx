import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Lock } from 'lucide-react';
import { parseISO, startOfWeek, startOfMonth, format } from 'date-fns';
import { PracticeLog } from '@/hooks/usePractice';
import { cn } from '@/lib/utils';

interface MilestoneDef {
  id: string;
  label: string;
  icon: string;
  check: (logs: PracticeLog[]) => string | null; // returns date achieved or null
}

const milestones: MilestoneDef[] = [
  {
    id: 'first-practice',
    label: 'First Practice',
    icon: '🎵',
    check: (logs) => {
      if (logs.length === 0) return null;
      const sorted = [...logs].sort((a, b) => a.practice_date.localeCompare(b.practice_date));
      return sorted[0].practice_date;
    },
  },
  {
    id: 'week-warrior',
    label: 'Week Warrior',
    icon: '⭐',
    check: (logs) => {
      const weekMap = new Map<string, Set<string>>();
      for (const log of logs) {
        const ws = format(startOfWeek(parseISO(log.practice_date), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        if (!weekMap.has(ws)) weekMap.set(ws, new Set());
        weekMap.get(ws)!.add(log.practice_date);
      }
      let earliest: string | null = null;
      weekMap.forEach((days, ws) => {
        if (days.size >= 5) {
          if (!earliest || ws < earliest) earliest = ws;
        }
      });
      return earliest;
    },
  },
  {
    id: 'month-master',
    label: 'Month Master',
    icon: '🏆',
    check: (logs) => {
      const monthMap = new Map<string, Set<string>>();
      for (const log of logs) {
        const ms = format(startOfMonth(parseISO(log.practice_date)), 'yyyy-MM');
        if (!monthMap.has(ms)) monthMap.set(ms, new Set());
        monthMap.get(ms)!.add(log.practice_date);
      }
      let earliest: string | null = null;
      monthMap.forEach((days, ms) => {
        if (days.size >= 20) {
          if (!earliest || ms < earliest) earliest = ms;
        }
      });
      return earliest;
    },
  },
  {
    id: 'century-club',
    label: 'Century Club',
    icon: '💯',
    check: (logs) => {
      if (logs.length < 100) return null;
      const sorted = [...logs].sort((a, b) => a.practice_date.localeCompare(b.practice_date));
      return sorted[99].practice_date;
    },
  },
];

interface PracticeMilestonesProps {
  logs: PracticeLog[];
}

export function PracticeMilestones({ logs }: PracticeMilestonesProps) {
  const results = useMemo(
    () => milestones.map(m => ({ ...m, achievedDate: m.check(logs) })),
    [logs]
  );

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground px-1">Practice Milestones</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {results.map(m => {
          const unlocked = !!m.achievedDate;
          return (
            <Card
              key={m.id}
              className={cn(
                'min-w-[120px] flex-shrink-0 rounded-xl shadow-card transition-colors',
                !unlocked && 'opacity-50'
              )}
            >
              <CardContent className="p-3 flex flex-col items-center gap-1.5 text-center">
                <span className="text-2xl">
                  {unlocked ? m.icon : <Lock className="h-5 w-5 text-muted-foreground" />}
                </span>
                <span className="text-xs font-medium leading-tight">{m.label}</span>
                {unlocked && m.achievedDate && (
                  <span className="text-[10px] text-muted-foreground">
                    {format(parseISO(m.achievedDate), 'dd MMM yyyy')}
                  </span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
