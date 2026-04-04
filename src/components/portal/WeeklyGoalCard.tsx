import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { startOfWeek, endOfWeek, parseISO, isWithinInterval } from 'date-fns';
import { safeGetItem, safeSetItem } from '@/lib/storage';
import { PracticeLog } from '@/hooks/usePractice';

const GOAL_OPTIONS = [3, 4, 5, 6, 7];
const DEFAULT_GOAL = 5;

interface WeeklyGoalCardProps {
  childId: string | undefined;
  logs: PracticeLog[];
}

function getGoalKey(childId: string | undefined) {
  return `ll-practice-goal-${childId ?? 'default'}`;
}

function getStoredGoal(childId: string | undefined): number {
  const stored = safeGetItem(getGoalKey(childId));
  const parsed = stored ? parseInt(stored, 10) : NaN;
  return GOAL_OPTIONS.includes(parsed) ? parsed : DEFAULT_GOAL;
}

export function WeeklyGoalCard({ childId, logs }: WeeklyGoalCardProps) {
  const [goal, setGoal] = useState(() => getStoredGoal(childId));

  useEffect(() => {
    setGoal(getStoredGoal(childId));
  }, [childId]);

  const cycleGoal = useCallback(() => {
    const idx = GOAL_OPTIONS.indexOf(goal);
    const next = GOAL_OPTIONS[(idx + 1) % GOAL_OPTIONS.length];
    safeSetItem(getGoalKey(childId), String(next));
    setGoal(next);
  }, [goal, childId]);

  const daysPracticed = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const interval = { start: weekStart, end: weekEnd };

    const uniqueDays = new Set<string>();
    for (const log of logs) {
      const date = parseISO(log.practice_date);
      if (isWithinInterval(date, interval)) {
        uniqueDays.add(log.practice_date);
      }
    }
    return uniqueDays.size;
  }, [logs]);

  const progress = Math.min(daysPracticed / goal, 1);
  const size = 96;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - progress * circumference;

  return (
    <Card className="rounded-2xl shadow-card">
      <CardContent className="pt-6 flex flex-col items-center gap-3">
        <div className="relative" style={{ width: size, height: size }}>
          <svg className="transform -rotate-90" width={size} height={size}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-muted/30"
            />
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className="text-primary"
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{ strokeDasharray: circumference }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold">{daysPracticed}</span>
            <span className="text-[10px] text-muted-foreground">of {goal}</span>
          </div>
        </div>

        <div className="text-center space-y-1">
          <p className="text-sm font-medium">
            {daysPracticed >= goal
              ? '🎉 Goal reached!'
              : `${goal - daysPracticed} more day${goal - daysPracticed === 1 ? '' : 's'} to go`}
          </p>
          <button
            onClick={cycleGoal}
            className="text-xs text-primary hover:underline"
          >
            This week's goal: {goal} days ✏️
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
