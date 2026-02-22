import { useState } from 'react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const ABSENCE_REASONS = [
  { value: 'sick', label: '🤒 Sick', shortLabel: 'Sick' },
  { value: 'school_commitment', label: '🏫 School commitment', shortLabel: 'School' },
  { value: 'family_emergency', label: '🏠 Family emergency', shortLabel: 'Emergency' },
  { value: 'holiday', label: '✈️ Holiday', shortLabel: 'Holiday' },
  { value: 'no_show', label: '👻 No show', shortLabel: 'No show' },
  { value: 'other', label: '📋 Other', shortLabel: 'Other' },
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
  return (
    <div className={cn(
      "flex items-center gap-2 flex-wrap",
      compact ? "mt-1" : "mt-2"
    )}>
      <Select
        value={reason || ''}
        onValueChange={(v) => onReasonChange(v as AbsenceReasonValue)}
      >
        <SelectTrigger className={cn("h-7 text-xs", compact ? "w-[140px]" : "w-[180px]")}>
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

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2">
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
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Returns true if the status requires showing the reason picker */
export function needsAbsenceReason(status: string | null): boolean {
  return status === 'absent' || status === 'cancelled_by_student';
}

export { ABSENCE_REASONS };
