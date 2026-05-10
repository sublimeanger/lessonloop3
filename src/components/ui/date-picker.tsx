import * as React from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface DatePickerProps {
  /** ISO date string yyyy-MM-dd */
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  /** Disable specific dates */
  disabled?: (date: Date) => boolean;
  /** Earliest selectable ISO date */
  min?: string;
  /** Latest selectable ISO date */
  max?: string;
  className?: string;
  id?: string;
  /**
   * Enables year + month dropdown navigation and opens on a sensible historical
   * default month (~10 years ago) when no value is set. Use for date-of-birth,
   * anniversary dates, or any date that may be many years in the past.
   * Defaults to false — existing call sites unchanged.
   */
  longRange?: boolean;
  /**
   * Override the year-dropdown range when longRange is true.
   * Default: current year - 100.
   */
  fromYear?: number;
  /**
   * Override the year-dropdown range when longRange is true.
   * Default: current year + 5.
   */
  toYear?: number;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled: disabledFn,
  min,
  max,
  className,
  id,
  longRange = false,
  fromYear,
  toYear,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selected = value ? parseISO(value) : undefined;

  const minDate = min ? parseISO(min) : undefined;
  const maxDate = max ? parseISO(max) : undefined;

  const isDisabled = React.useCallback(
    (date: Date) => {
      if (minDate && date < minDate) return true;
      if (maxDate && date > maxDate) return true;
      if (disabledFn) return disabledFn(date);
      return false;
    },
    [minDate, maxDate, disabledFn],
  );

  const computedDefaultMonth = React.useMemo(() => {
    if (selected) return selected;
    if (longRange) {
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      return tenYearsAgo;
    }
    return undefined;
  }, [selected, longRange]);

  const currentYear = new Date().getFullYear();
  const computedFromYear = fromYear ?? (longRange ? currentYear - 100 : undefined);
  const computedToYear = toYear ?? (longRange ? currentYear + 5 : undefined);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal h-11 sm:h-10 text-base md:text-sm',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {selected ? format(selected, 'd MMM yyyy') : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) {
              onChange(format(date, 'yyyy-MM-dd'));
              setOpen(false);
            }
          }}
          disabled={isDisabled}
          defaultMonth={computedDefaultMonth}
          captionLayout={longRange ? 'dropdown-buttons' : 'buttons'}
          fromYear={computedFromYear}
          toYear={computedToYear}
          initialFocus
          className={cn('p-3 pointer-events-auto')}
        />
      </PopoverContent>
    </Popover>
  );
}
