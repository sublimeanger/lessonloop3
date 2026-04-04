import { useState, useMemo } from 'react';
import { format, parseISO, isBefore, isAfter, startOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, Clock, CalendarOff, Plus, Trash2, Pencil, Loader2 } from 'lucide-react';
import {
  useAvailabilityBlocks,
  useTimeOffBlocks,
  useCreateAvailabilityBlock,
  useDeleteAvailabilityBlock,
  useCreateTimeOffBlock,
  useDeleteTimeOffBlock,
  DAYS_OF_WEEK,
  type AvailabilityBlock,
  type DayOfWeek,
} from '@/hooks/useTeacherAvailability';
import { cn } from '@/lib/utils';

/* ── Time options (15-min increments) ────────────────────────── */

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const hours = Math.floor(i / 4);
  const mins = (i % 4) * 15;
  const value = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  const label = format(new Date(2000, 0, 1, hours, mins), 'h:mm a');
  return { value, label };
});

const DAY_SHORT: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

function formatTimeShort(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`;
}

/* ── Weekly Availability Summary ─────────────────────────────── */

function WeekSummary({ blocks }: { blocks: AvailabilityBlock[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, AvailabilityBlock[]>();
    for (const b of blocks) {
      const existing = map.get(b.day_of_week) || [];
      existing.push(b);
      map.set(b.day_of_week, existing);
    }
    return map;
  }, [blocks]);

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {DAYS_OF_WEEK.map(({ value }) => {
        const dayBlocks = grouped.get(value);
        if (!dayBlocks || dayBlocks.length === 0) {
          return (
            <span key={value} className="text-muted-foreground/50">
              {DAY_SHORT[value]} Off
            </span>
          );
        }
        const ranges = dayBlocks
          .sort((a, b) => a.start_time_local.localeCompare(b.start_time_local))
          .map(b => `${formatTimeShort(b.start_time_local)}–${formatTimeShort(b.end_time_local)}`)
          .join(', ');
        return (
          <span key={value} className="text-foreground">
            <span className="font-medium">{DAY_SHORT[value]}</span>{' '}
            <span className="text-muted-foreground">{ranges}</span>
          </span>
        );
      })}
    </div>
  );
}

/* ── Availability Editor Sheet ───────────────────────────────── */

function AvailabilityEditorSheet({ blocks }: { blocks: AvailabilityBlock[] }) {
  const [day, setDay] = useState<DayOfWeek>('monday');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const createBlock = useCreateAvailabilityBlock();
  const deleteBlock = useDeleteAvailabilityBlock();

  const handleAdd = () => {
    if (startTime >= endTime) return;
    createBlock.mutate({
      day_of_week: day,
      start_time_local: startTime,
      end_time_local: endTime,
    });
  };

  const grouped = useMemo(() => {
    const map = new Map<string, AvailabilityBlock[]>();
    for (const b of blocks) {
      const existing = map.get(b.day_of_week) || [];
      existing.push(b);
      map.set(b.day_of_week, existing);
    }
    return map;
  }, [blocks]);

  return (
    <>
      <div className="space-y-5">
        {/* Add new block */}
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">Add availability</p>
          <div className="grid grid-cols-3 gap-2">
            <Select value={day} onValueChange={(v) => setDay(v as DayOfWeek)}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map(d => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={startTime} onValueChange={setStartTime}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={endTime} onValueChange={setEndTime}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={createBlock.isPending || startTime >= endTime}
            className="w-full gap-1.5"
          >
            {createBlock.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add Slot
          </Button>
        </div>

        {/* Current blocks by day */}
        <div className="space-y-3">
          {DAYS_OF_WEEK.map(({ value, label }) => {
            const dayBlocks = grouped.get(value) || [];
            return (
              <div key={value}>
                <p className="text-xs font-semibold text-muted-foreground mb-1">{label}</p>
                {dayBlocks.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50 italic">No availability</p>
                ) : (
                  <div className="space-y-1">
                    {dayBlocks
                      .sort((a, b) => a.start_time_local.localeCompare(b.start_time_local))
                      .map(b => (
                        <div key={b.id} className="flex items-center justify-between rounded border px-2 py-1.5 text-xs">
                          <span>{formatTimeShort(b.start_time_local)} – {formatTimeShort(b.end_time_local)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setDeleteId(b.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove availability?</AlertDialogTitle>
            <AlertDialogDescription>This slot will be removed from your weekly schedule.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteId) deleteBlock.mutate(deleteId); setDeleteId(null); }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ── Request Time Off Dialog ─────────────────────────────────── */

function RequestTimeOffDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState('');

  const createTimeOff = useCreateTimeOffBlock();

  const handleSubmit = () => {
    if (!startDate || !endDate) return;
    createTimeOff.mutate(
      {
        start_at: format(startDate, 'yyyy-MM-dd'),
        end_at: format(endDate, 'yyyy-MM-dd'),
        reason: reason.trim() || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setStartDate(undefined);
          setEndDate(undefined);
          setReason('');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Time Off</DialogTitle>
          <DialogDescription>Block out dates when you're unavailable.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Start date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left text-xs', !startDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {startDate ? format(startDate, 'dd MMM yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    disabled={(d) => isBefore(d, startOfDay(new Date()))}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left text-xs', !endDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {endDate ? format(endDate, 'dd MMM yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(d) => isBefore(d, startDate || startOfDay(new Date()))}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Holiday, personal, etc."
              rows={2}
              className="text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!startDate || !endDate || createTimeOff.isPending}
          >
            {createTimeOff.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main Card ───────────────────────────────────────────────── */

export function TeacherAvailabilityCard() {
  const { data: blocks = [], isLoading: blocksLoading } = useAvailabilityBlocks();
  const { data: timeOffs = [], isLoading: timeOffLoading } = useTimeOffBlocks();
  const deleteTimeOff = useDeleteTimeOffBlock();
  const [showTimeOffDialog, setShowTimeOffDialog] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const today = startOfDay(new Date());
  const upcomingTimeOffs = useMemo(
    () => timeOffs.filter(t => isAfter(parseISO(t.end_at), today)),
    [timeOffs, today]
  );

  const isLoading = blocksLoading || timeOffLoading;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-body-strong flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              My Availability
            </CardTitle>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Weekly Availability</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <AvailabilityEditorSheet blocks={blocks} />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Weekly summary */}
          {isLoading ? (
            <div className="h-12 animate-pulse rounded bg-muted" />
          ) : blocks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No availability set. Tap "Edit" to add your weekly hours.</p>
          ) : (
            <WeekSummary blocks={blocks} />
          )}

          {/* Time Off Section */}
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <CalendarOff className="h-3.5 w-3.5" />
                Time Off
              </h4>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1 h-7"
                onClick={() => setShowTimeOffDialog(true)}
              >
                <Plus className="h-3 w-3" />
                Request
              </Button>
            </div>

            {upcomingTimeOffs.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic">No upcoming time off</p>
            ) : (
              <div className="space-y-1.5">
                {upcomingTimeOffs.map(t => {
                  const start = parseISO(t.start_at);
                  const end = parseISO(t.end_at);
                  const canCancel = isAfter(start, today);
                  const sameDay = format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd');
                  return (
                    <div key={t.id} className="flex items-center justify-between rounded border px-2.5 py-1.5 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium shrink-0">
                          {sameDay
                            ? format(start, 'dd MMM')
                            : `${format(start, 'dd MMM')} – ${format(end, 'dd MMM')}`}
                        </span>
                        {t.reason && (
                          <Badge variant="secondary" className="text-[10px] truncate max-w-[120px]">
                            {t.reason}
                          </Badge>
                        )}
                      </div>
                      {canCancel && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => setCancelId(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <RequestTimeOffDialog open={showTimeOffDialog} onOpenChange={setShowTimeOffDialog} />

      <AlertDialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel time off?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the time-off entry and make you available again for those dates.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (cancelId) deleteTimeOff.mutate(cancelId); setCancelId(null); }}
            >
              Cancel Time Off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
