import { useState, useMemo } from 'react';
import { format, addMonths, addWeeks, parseISO } from 'date-fns';
import { CalendarIcon, ChevronDown, SplitSquareHorizontal } from 'lucide-react';
import { cn, formatCurrencyMinor } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface PaymentPlanToggleProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  count: number;
  onCountChange: (count: number) => void;
  frequency: 'monthly' | 'fortnightly';
  onFrequencyChange: (frequency: 'monthly' | 'fortnightly') => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  totalMinor: number;
  currency: string;
}

const PRESET_COUNTS = [2, 3, 4, 6];

export function PaymentPlanToggle({
  enabled,
  onEnabledChange,
  count,
  onCountChange,
  frequency,
  onFrequencyChange,
  startDate,
  onStartDateChange,
  totalMinor,
  currency,
}: PaymentPlanToggleProps) {
  const [customCount, setCustomCount] = useState(false);

  const installments = useMemo(() => {
    if (!enabled || totalMinor <= 0 || count < 2) return [];
    const perInstallment = Math.floor(totalMinor / count);
    const lastAmount = totalMinor - perInstallment * (count - 1);
    const result: { number: number; amount: number; dueDate: string }[] = [];
    let currentDate = startDate ? parseISO(startDate) : new Date();

    for (let i = 1; i <= count; i++) {
      result.push({
        number: i,
        amount: i === count ? lastAmount : perInstallment,
        dueDate: format(currentDate, 'yyyy-MM-dd'),
      });
      currentDate = frequency === 'monthly'
        ? addMonths(currentDate, 1)
        : addWeeks(currentDate, 2);
    }
    return result;
  }, [enabled, totalMinor, count, frequency, startDate]);

  return (
    <Collapsible open={enabled} onOpenChange={onEnabledChange}>
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 space-y-3">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <SplitSquareHorizontal className="h-4 w-4 text-muted-foreground" />
              <Label className="cursor-pointer font-medium">Split into installments</Label>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={onEnabledChange}
              onClick={(e) => e.stopPropagation()}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-4">
          {/* Config row */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Installment count */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Installments</Label>
              {!customCount ? (
                <Select
                  value={count.toString()}
                  onValueChange={(v) => {
                    if (v === 'custom') {
                      setCustomCount(true);
                    } else {
                      onCountChange(parseInt(v));
                    }
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_COUNTS.map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} installments
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="number"
                  min={2}
                  max={24}
                  value={count}
                  onChange={(e) => onCountChange(Math.max(2, Math.min(24, parseInt(e.target.value) || 2)))}
                  className="h-9"
                  autoFocus
                />
              )}
            </div>

            {/* Frequency */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Frequency</Label>
              <Select value={frequency} onValueChange={(v) => onFrequencyChange(v as 'monthly' | 'fortnightly')}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start date */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">First due date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'h-9 w-full justify-start text-left font-normal',
                      !startDate && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {startDate ? format(parseISO(startDate), 'dd MMM yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate ? parseISO(startDate) : undefined}
                    onSelect={(d) => d && onStartDateChange(format(d, 'yyyy-MM-dd'))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Live preview */}
          {installments.length > 0 && totalMinor > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Installment preview</Label>
              {/* Desktop table */}
              <div className="hidden sm:block rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Amount</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installments.map((inst) => (
                      <tr key={inst.number} className="border-b last:border-0">
                        <td className="px-3 py-2">{inst.number}</td>
                        <td className="px-3 py-2 font-medium">{formatCurrencyMinor(inst.amount, currency)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{format(parseISO(inst.dueDate), 'dd MMM yyyy')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {installments.map((inst) => (
                  <div key={inst.number} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="text-sm">
                      <span className="font-medium">#{inst.number}</span>
                      <span className="ml-2 text-muted-foreground">{format(parseISO(inst.dueDate), 'dd MMM yyyy')}</span>
                    </div>
                    <span className="text-sm font-medium">{formatCurrencyMinor(inst.amount, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
