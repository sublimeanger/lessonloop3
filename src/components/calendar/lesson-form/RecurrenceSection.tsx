import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarIcon, AlertTriangle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { DAY_NAMES } from './constants';
import { LessonWithDetails } from '../types';

interface RecurrenceSectionProps {
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  recurrenceDays: number[];
  onDayToggle: (day: number) => void;
  recurrenceEndDate: Date | null;
  setRecurrenceEndDate: (date: Date | null) => void;
  selectedDate: Date;
  closureCheck: {
    hasConflicts: boolean;
    warningMessage: string;
    conflicts: { date: Date; reason: string }[];
  };
  lesson?: LessonWithDetails | null;
}

export function RecurrenceSection({
  isRecurring,
  setIsRecurring,
  recurrenceDays,
  onDayToggle,
  recurrenceEndDate,
  setRecurrenceEndDate,
  selectedDate,
  closureCheck,
  lesson,
}: RecurrenceSectionProps) {
  const isMobile = useIsMobile();

  if (lesson) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between min-h-[44px]">
        <Label htmlFor="recurring">Recurring lesson</Label>
        <Switch
          id="recurring"
          checked={isRecurring}
          onCheckedChange={setIsRecurring}
        />
      </div>

      {isRecurring && (
        <div className="space-y-3 pl-1 border-l-2 border-primary/20 ml-1">
          <div className="space-y-2">
            <Label className="text-sm">Repeat on</Label>
            <div className="flex gap-1 flex-wrap">
              {DAY_NAMES.map((day, i) => (
                <Button
                  key={day}
                  type="button"
                  size="sm"
                  variant={recurrenceDays.includes(i) ? 'default' : 'outline'}
                  className="w-10 h-10 text-xs"
                  onClick={() => onDayToggle(i)}
                >
                  {day}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">End date (optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal min-h-[44px]">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {recurrenceEndDate ? format(recurrenceEndDate, 'dd MMM yyyy') : 'No end date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start" side={isMobile ? "top" : "bottom"}>
                <Calendar
                  mode="single"
                  selected={recurrenceEndDate || undefined}
                  onSelect={(date) => setRecurrenceEndDate(date || null)}
                  disabled={(date) => date < selectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {closureCheck.hasConflicts && (
            <Alert className="border-secondary bg-secondary/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">{closureCheck.warningMessage}</p>
                <p className="text-xs mt-1 text-muted-foreground">
                  These lessons will be skipped automatically.
                </p>
                {closureCheck.conflicts.length <= 5 && (
                  <ul className="text-xs mt-2 space-y-0.5 text-muted-foreground">
                    {closureCheck.conflicts.map((c, i) => (
                      <li key={i}>
                        • {format(c.date, 'EEE, d MMM')}: {c.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
