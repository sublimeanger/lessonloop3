import { useState, useMemo } from 'react';
import { format, parseISO, addDays, addWeeks, addMonths, isBefore, startOfToday } from 'date-fns';
import { CalendarIcon, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrencyMinor } from '@/lib/utils';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useInstallments, useGenerateInstallments, useRemovePaymentPlan,
} from '@/hooks/useInvoiceInstallments';

type Frequency = 'monthly' | 'fortnightly' | 'weekly';

interface PaymentPlanSetupProps {
  invoice: {
    id: string;
    invoice_number: string;
    total_minor: number;
    paid_minor?: number | null;
    due_date: string;
    status: string;
    currency_code: string;
    payment_plan_enabled?: boolean | null;
    installment_count?: number | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function addInterval(date: Date, frequency: Frequency, intervals: number): Date {
  switch (frequency) {
    case 'weekly': return addWeeks(date, intervals);
    case 'fortnightly': return addWeeks(date, intervals * 2);
    case 'monthly': return addMonths(date, intervals);
  }
}

export function PaymentPlanSetup({ invoice, open, onOpenChange }: PaymentPlanSetupProps) {
  const currency = invoice.currency_code || 'GBP';
  const remaining = invoice.total_minor - (invoice.paid_minor || 0);
  const today = startOfToday();

  const { data: existingInstallments, isLoading: loadingInstallments } = useInstallments(
    invoice.payment_plan_enabled ? invoice.id : undefined
  );
  const generateMutation = useGenerateInstallments();
  const removeMutation = useRemovePaymentPlan();

  const [mode, setMode] = useState<'equal' | 'custom'>('equal');
  const [count, setCount] = useState(3);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [startDate, setStartDate] = useState<Date>(() => {
    const due = parseISO(invoice.due_date);
    return isBefore(due, today) ? addDays(today, 7) : due;
  });
  const [customRows, setCustomRows] = useState<Array<{ amount_minor: number; due_date: string }>>([]);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  // Equal mode preview
  const previewInstallments = useMemo(() => {
    if (mode !== 'equal') return [];
    const perInstallment = Math.floor(remaining / count);
    const lastInstallment = remaining - perInstallment * (count - 1);
    return Array.from({ length: count }, (_, i) => ({
      installment_number: i + 1,
      amount_minor: i === count - 1 ? lastInstallment : perInstallment,
      due_date: format(addInterval(startDate, frequency, i), 'yyyy-MM-dd'),
    }));
  }, [mode, count, frequency, startDate, remaining]);

  // Custom mode validation
  const customTotal = customRows.reduce((sum, r) => sum + r.amount_minor, 0);
  const customDatesAscending = customRows.every((r, i) =>
    i === 0 || r.due_date > customRows[i - 1].due_date
  );
  const customValid = customRows.length >= 2 &&
    customRows.length <= 12 &&
    customRows.every(r => r.amount_minor >= 100 && isBefore(today, parseISO(r.due_date))) &&
    customDatesAscending &&
    customTotal === remaining;

  // Validation for equal mode
  const equalValid = remaining >= 200 &&
    previewInstallments.length >= 2 &&
    previewInstallments.every(p => p.amount_minor >= 100 && isBefore(today, parseISO(p.due_date)));

  const canSubmit = remaining >= 200 && (mode === 'equal' ? equalValid : customValid);

  const initCustomRows = () => {
    const perInstallment = Math.floor(remaining / 3);
    const last = remaining - perInstallment * 2;
    setCustomRows([
      { amount_minor: perInstallment, due_date: format(addMonths(today, 1), 'yyyy-MM-dd') },
      { amount_minor: perInstallment, due_date: format(addMonths(today, 2), 'yyyy-MM-dd') },
      { amount_minor: last, due_date: format(addMonths(today, 3), 'yyyy-MM-dd') },
    ]);
  };

  const handleModeChange = (newMode: string) => {
    setMode(newMode as 'equal' | 'custom');
    if (newMode === 'custom' && customRows.length === 0) {
      initCustomRows();
    }
  };

  const updateCustomRow = (index: number, field: 'amount_minor' | 'due_date', value: number | string) => {
    setCustomRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const addCustomRow = () => {
    if (customRows.length >= 12) return;
    const lastDate = customRows.length > 0 ? parseISO(customRows[customRows.length - 1].due_date) : today;
    setCustomRows(prev => [...prev, { amount_minor: 0, due_date: format(addMonths(lastDate, 1), 'yyyy-MM-dd') }]);
  };

  const removeCustomRow = (index: number) => {
    if (customRows.length <= 2) return;
    setCustomRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (mode === 'equal') {
      generateMutation.mutate({
        invoiceId: invoice.id,
        count,
        frequency,
        startDate: format(startDate, 'yyyy-MM-dd'),
      }, { onSuccess: () => onOpenChange(false) });
    } else {
      generateMutation.mutate({
        invoiceId: invoice.id,
        count: customRows.length,
        frequency: 'monthly', // ignored for custom
        customSchedule: customRows,
      }, { onSuccess: () => onOpenChange(false) });
    }
  };

  const handleRemove = () => {
    removeMutation.mutate(invoice.id, {
      onSuccess: () => {
        setRemoveConfirmOpen(false);
        onOpenChange(false);
      },
    });
  };

  const isSubmitting = generateMutation.isPending || removeMutation.isPending;

  // ─── Existing plan view ──────────────────────────────────
  if (invoice.payment_plan_enabled && existingInstallments) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Payment Plan</SheetTitle>
            <SheetDescription>
              {invoice.installment_count} installments for {invoice.invoice_number}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            {loadingInstallments ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingInstallments.map(inst => (
                    <TableRow key={inst.id}>
                      <TableCell>{inst.installment_number}</TableCell>
                      <TableCell>{formatCurrencyMinor(inst.amount_minor, currency)}</TableCell>
                      <TableCell>{format(parseISO(inst.due_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant={
                          inst.status === 'paid' ? 'default' :
                          inst.status === 'overdue' ? 'destructive' : 'secondary'
                        } className={inst.status === 'paid' ? 'bg-success text-success-foreground' : undefined}>
                          {inst.status.charAt(0).toUpperCase() + inst.status.slice(1)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell />
                    <TableCell className="font-bold">
                      {formatCurrencyMinor(existingInstallments.reduce((s, i) => s + i.amount_minor, 0), currency)}
                    </TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </div>

          <SheetFooter className="mt-6">
            <Button
              variant="destructive"
              onClick={() => setRemoveConfirmOpen(true)}
              disabled={isSubmitting}
              className="w-full"
            >
              Remove Payment Plan
            </Button>
          </SheetFooter>

          <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Payment Plan</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all pending installments. Paid installment records will be preserved. Continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {removeMutation.isPending ? 'Removing...' : 'Remove'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SheetContent>
      </Sheet>
    );
  }

  // ─── Create plan view ────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Set Up Payment Plan</SheetTitle>
          <SheetDescription>
            Split {formatCurrencyMinor(remaining, currency)} across multiple installments.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Mode selector */}
          <div className="space-y-2">
            <Label>Plan Type</Label>
            <Select value={mode} onValueChange={handleModeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal">Equal installments</SelectItem>
                <SelectItem value="custom">Custom schedule</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === 'equal' && (
            <>
              {/* Count */}
              <div className="space-y-2">
                <Label>Number of Installments</Label>
                <Select value={String(count)} onValueChange={v => setCount(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 11 }, (_, i) => i + 2).map(n => (
                      <SelectItem key={n} value={String(n)}>{n} installments</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Frequency */}
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={v => setFrequency(v as Frequency)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Start date */}
              <div className="space-y-2">
                <Label>First Payment Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !startDate && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(startDate, 'dd MMMM yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={d => d && setStartDate(d)}
                      disabled={date => isBefore(date, today)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>Preview</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewInstallments.map(p => (
                      <TableRow key={p.installment_number}>
                        <TableCell>{p.installment_number}</TableCell>
                        <TableCell>{formatCurrencyMinor(p.amount_minor, currency)}</TableCell>
                        <TableCell>{format(parseISO(p.due_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell><Badge variant="secondary">Pending</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell />
                      <TableCell className="font-bold">{formatCurrencyMinor(remaining, currency)}</TableCell>
                      <TableCell>Total</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </>
          )}

          {mode === 'custom' && (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customRows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          step={0.01}
                          value={(row.amount_minor / 100).toFixed(2)}
                          onChange={e => updateCustomRow(i, 'amount_minor', Math.round(parseFloat(e.target.value || '0') * 100))}
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-1 h-3 w-3" />
                              {format(parseISO(row.due_date), 'dd MMM yyyy')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={parseISO(row.due_date)}
                              onSelect={d => d && updateCustomRow(i, 'due_date', format(d, 'yyyy-MM-dd'))}
                              disabled={date => isBefore(date, today)}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeCustomRow(i)} disabled={customRows.length <= 2}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell />
                    <TableCell className={cn('font-bold', customTotal !== remaining && 'text-destructive')}>
                      {formatCurrencyMinor(customTotal, currency)}
                      {customTotal !== remaining && (
                        <span className="block text-xs font-normal">
                          Target: {formatCurrencyMinor(remaining, currency)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
              {customRows.length < 12 && (
                <Button variant="outline" size="sm" onClick={addCustomRow} className="w-full">
                  Add Installment
                </Button>
              )}
              {customTotal !== remaining && (
                <p className="text-sm text-destructive">
                  Amounts must sum to {formatCurrencyMinor(remaining, currency)} (difference: {formatCurrencyMinor(Math.abs(customTotal - remaining), currency)})
                </p>
              )}
              {!customDatesAscending && (
                <p className="text-sm text-destructive">
                  Due dates must be in ascending order.
                </p>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Payment Plan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
