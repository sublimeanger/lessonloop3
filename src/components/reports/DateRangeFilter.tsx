import { format, subMonths, startOfMonth, endOfMonth, startOfQuarter } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

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

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  presets?: DatePreset[];
}

export function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  presets = DEFAULT_PRESETS,
}: DateRangeFilterProps) {
  const applyPreset = (preset: DatePreset) => {
    const { start, end } = preset.getRange();
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
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-[180px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-[180px]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
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
