import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WeeklyActivityProps {
  lessonsThisWeek: number;
  hoursThisWeek: number;
  className?: string;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeeklyActivity({ lessonsThisWeek, hoursThisWeek, className }: WeeklyActivityProps) {
  const today = new Date();
  const todayDayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;

  const dayActivity = DAY_LABELS.map((label, i) => ({
    label,
    isToday: i === todayDayIdx,
    isPast: i < todayDayIdx,
    isFuture: i > todayDayIdx,
  }));

  return (
    <div className={cn('', className)}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">This Week</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary stats */}
          <div className="flex items-baseline gap-6">
            <div>
              <p className="text-2xl font-bold tracking-tight">{lessonsThisWeek}</p>
              <p className="text-xs text-muted-foreground">lessons</p>
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{hoursThisWeek.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground">teaching</p>
            </div>
          </div>

          {/* Day indicators */}
          <div className="flex items-end gap-1.5">
            {dayActivity.map((day) => (
              <div key={day.label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn(
                    'h-8 w-full rounded-sm',
                    day.isToday && 'bg-primary',
                    day.isPast && 'bg-primary/30',
                    day.isFuture && 'bg-muted',
                  )}
                />
                <span
                  className={cn(
                    'text-[10px]',
                    day.isToday ? 'font-semibold text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {day.label}
                </span>
              </div>
            ))}
          </div>

          {/* Motivational footer */}
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground text-center">
              {todayDayIdx < 5
                ? `${5 - todayDayIdx} teaching days remaining`
                : 'Weekend — enjoy the break!'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
