import { useState, useEffect, useRef, useMemo } from 'react';
import { format, subMonths, startOfMonth, endOfMonth, startOfQuarter } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import type { Term } from '@/hooks/useTerms';

export type DatePreset = {
  label: string;
  getRange: () => { start: string; end: string };
};

const DEFAULT_PRESETS: DatePreset[] = [
  {
    label: 'This Month',
    getRange: () => ({
      start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    }),
  },
  {
    label: 'Last Month',
    getRange: () => {
      const lm = subMonths(new Date(), 1);
      return {
        start: format(startOfMonth(lm), 'yyyy-MM-dd'),
        end: format(endOfMonth(lm), 'yyyy-MM-dd'),
      };
    },
  },
  {
    label: 'This Quarter',
    getRange: () => ({
      start: format(startOfQuarter(new Date()), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    }),
  },
  {
    label: 'Last 12 Months',
    getRange: () => ({
      start: format(subMonths(new Date(), 11), 'yyyy-MM-01'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    }),
  },
  {
    label: 'This Year',
    getRange: () => {
      const year = new Date().getFullYear();
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    },
  },
];

// Validates a date string is a complete yyyy-MM-dd format
function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
}

function buildTermPresets(terms: Term[]): DatePreset[] {
  const today = format(new Date(), 'yyyy-MM-dd');
  const presets: DatePreset[] = [];

  const currentTerm = terms.find(t => t.start_date <= today && t.end_date >= today);
  if (currentTerm) {
    presets.push({
      label: `This Term (${currentTerm.name})`,
      getRange: () => ({ start: currentTerm.start_date, end: currentTerm.end_date }),
    });
  }

  // Last term = most recent term that ended before today (or before current term start)
  const cutoff = currentTerm ? currentTerm.start_date : today;
  const pastTerms = terms.filter(t => t.end_date < cutoff).sort((a, b) => b.end_date.localeCompare(a.end_date));
  if (pastTerms.length > 0) {
    const lastTerm = pastTerms[0];
    presets.push({
      label: `Last Term (${lastTerm.name})`,
      getRange: () => ({ start: lastTerm.start_date, end: lastTerm.end_date }),
    });
  }

  return presets;
}

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  presets?: DatePreset[];
  terms?: Term[];
}

export function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  presets = DEFAULT_PRESETS,
  terms,
}: DateRangeFilterProps) {
  const allPresets = useMemo(() => {
    const termPresets = terms && terms.length > 0 ? buildTermPresets(terms) : [];
    return [...termPresets, ...presets];
  }, [terms, presets]);
  const today = format(new Date(), 'yyyy-MM-dd');

  // Internal working state — updates on every keystroke
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd] = useState(endDate);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync internal state when parent changes (e.g. from preset)
  useEffect(() => { setLocalStart(startDate); }, [startDate]);
  useEffect(() => { setLocalEnd(endDate); }, [endDate]);

  // Debounced flush to parent — only fires when both dates are valid
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (isValidDate(localStart) && isValidDate(localEnd)) {
        const s = localStart <= localEnd ? localStart : localEnd;
        const e = localStart <= localEnd ? localEnd : localStart;
        if (s !== startDate) onStartDateChange(s);
        if (e !== endDate) onEndDateChange(e);
      }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // Only re-run when local values change — parent callbacks are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStart, localEnd]);

  // Presets bypass debounce and apply immediately
  const applyPreset = (preset: DatePreset) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const { start, end } = preset.getRange();
    setLocalStart(start);
    setLocalEnd(end);
    onStartDateChange(start);
    onEndDateChange(end);
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={localStart}
              max={localEnd}
              onChange={(e) => setLocalStart(e.target.value)}
              className="w-[180px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={localEnd}
              min={localStart}
              max={today}
              onChange={(e) => setLocalEnd(e.target.value)}
              className="w-[180px]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {allPresets.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
