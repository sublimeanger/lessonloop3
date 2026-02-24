import { useState } from 'react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const ABSENCE_REASONS = [
  { value: 'sick', label: 'Sick', shortLabel: 'Sick' },
  { value: 'school_commitment', label: 'School commitment', shortLabel: 'School' },
  { value: 'family_emergency', label: 'Family emergency', shortLabel: 'Emergency' },
  { value: 'holiday', label: 'Holiday', shortLabel: 'Holiday' },
  { value: 'no_show', label: 'No show', shortLabel: 'No show' },
  { value: 'other', label: 'Other', shortLabel: 'Other' },
] as const;

export type AbsenceReasonValue = typeof ABSENCE_REASONS[number]['value'];

interface AbsenceReasonPickerProps {
  reason: AbsenceReasonValue | null;
  notifiedAt: Date;
  onReasonChange: (reason: AbsenceReasonValue) => void;
  onNotifiedAtChange: (date: Date) => void;
  compact?: boolean;
}

export function AbsenceReasonPicker({
  reason,
  notifiedAt,
  onReasonChange,
  onNotifiedAtChange,
  compact = false,
}: AbsenceReasonPickerProps) {
  const isMobile = useIsMobile();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [reasonSheetOpen, setReasonSheetOpen] = useState(false);

  const selectedReasonLabel = reason
    ? ABSENCE_REASONS.find((r) => r.value === reason)?.[compact ? 'shortLabel' : 'label'] || reason
    : null;

  return (
    <div className={cn('mt-2 flex w-full flex-wrap items-center gap-2', compact && 'mt-1')}>
      {/* Reason picker: Sheet on mobile, Select on desktop */}
      {isMobile ? (
        <Sheet open={reasonSheetOpen} onOpenChange={setReasonSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'h-11 justify-start text-xs',
                compact ? 'w-full' : 'w-full',
                !reason && 'text-muted-foreground'
              )}
            >
              {selectedReasonLabel || 'Reason (optional)'}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="p-4">
            <SheetHeader>
              <SheetTitle>Absence reason</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-1">
              {ABSENCE_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    onReasonChange(r.value);
                    setReasonSheetOpen(false);
                  }}
                  className={cn(
                    'flex w-full min-h-[44px] items-center rounded-lg px-3 py-2 text-sm transition-colors',
                    reason === r.value
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-accent'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Select value={reason || ''} onValueChange={(v) => onReasonChange(v as AbsenceReasonValue)}>
          <SelectTrigger className={cn('h-8 text-xs', compact ? 'w-[160px]' : 'w-[220px]')}>
            <SelectValue placeholder="Reason (optional)" />
          </SelectTrigger>
          <SelectContent>
            {ABSENCE_REASONS.map((r) => (
              <SelectItem key={r.value} value={r.value} className="text-xs">
                {compact ? r.shortLabel : r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Date picker: Sheet on mobile, Popover on desktop */}
      {isMobile ? (
        <Sheet open={calendarOpen} onOpenChange={setCalendarOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-11 gap-1.5 px-3 text-xs">
              <CalendarIcon className="h-3.5 w-3.5" />
              {format(notifiedAt, 'dd/MM')}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="p-4">
            <SheetHeader>
              <SheetTitle>Select notified date</SheetTitle>
            </SheetHeader>
            <div className="mt-4 overflow-auto">
              <Calendar
                mode="single"
                selected={notifiedAt}
                onSelect={(d) => {
                  if (d) {
                    onNotifiedAtChange(d);
                    setCalendarOpen(false);
                  }
                }}
                disabled={(d) => d > new Date()}
                className={cn('mx-auto p-3 pointer-events-auto')}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs">
              <CalendarIcon className="h-3 w-3" />
              {format(notifiedAt, 'dd/MM')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={notifiedAt}
              onSelect={(d) => d && onNotifiedAtChange(d)}
              disabled={(d) => d > new Date()}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

/** Returns true if the status requires showing the reason picker */
export function needsAbsenceReason(status: string | null): boolean {
  return status === 'absent' || status === 'cancelled_by_student';
}

export { ABSENCE_REASONS };
