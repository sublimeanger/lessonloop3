import { useState } from 'react';
import { format, parseISO, isBefore, isAfter, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Plus, Trash2, Clock, CalendarOff, Calendar } from 'lucide-react';
import {
  useAvailabilityBlocks,
  useTimeOffBlocks,
  useCreateAvailabilityBlock,
  useDeleteAvailabilityBlock,
  useCreateTimeOffBlock,
  useDeleteTimeOffBlock,
  DAYS_OF_WEEK,
  type DayOfWeek,
  type AvailabilityBlock,
  type TimeOffBlock,
} from '@/hooks/useTeacherAvailability';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';

// Time slot options (15-min increments)
const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const hours = Math.floor(i / 4);
  const mins = (i % 4) * 15;
  const value = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  const label = format(new Date(2000, 0, 1, hours, mins), 'h:mm a');
  return { value, label };
});

interface AvailabilityFormData {
  day_of_week: DayOfWeek;
  start_time_local: string;
  end_time_local: string;
}

interface TimeOffFormData {
  start_date: string;
  end_date: string;
  reason: string;
}

const defaultAvailabilityForm: AvailabilityFormData = {
  day_of_week: 'monday',
  start_time_local: '09:00',
  end_time_local: '17:00',
};

const defaultTimeOffForm: TimeOffFormData = {
  start_date: format(new Date(), 'yyyy-MM-dd'),
  end_date: format(new Date(), 'yyyy-MM-dd'),
  reason: '',
};

export function TeacherAvailabilityTab() {
  const { data: availabilityBlocks = [], isLoading: loadingAvailability } = useAvailabilityBlocks();
  const { data: timeOffBlocks = [], isLoading: loadingTimeOff } = useTimeOffBlocks();
  
  const createAvailability = useCreateAvailabilityBlock();
  const deleteAvailability = useDeleteAvailabilityBlock();
  const createTimeOff = useCreateTimeOffBlock();
  const deleteTimeOff = useDeleteTimeOffBlock();

  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);
  const [timeOffDialogOpen, setTimeOffDialogOpen] = useState(false);
  const [deleteAvailabilityId, setDeleteAvailabilityId] = useState<string | null>(null);
  const [deleteTimeOffId, setDeleteTimeOffId] = useState<string | null>(null);

  const [availabilityForm, setAvailabilityForm] = useState<AvailabilityFormData>(defaultAvailabilityForm);
  const [timeOffForm, setTimeOffForm] = useState<TimeOffFormData>(defaultTimeOffForm);

  const isLoading = loadingAvailability || loadingTimeOff;

  // Group availability by day
  const availabilityByDay = DAYS_OF_WEEK.map(day => ({
    ...day,
    blocks: availabilityBlocks.filter(b => b.day_of_week === day.value),
  }));

  // Filter time-off to show upcoming only
  const upcomingTimeOff = timeOffBlocks.filter(
    t => isAfter(parseISO(t.end_at), startOfDay(new Date()))
  );

  const { toast } = useToast();

  const handleCreateAvailability = async () => {
    // Check for overlapping blocks on the same day
    const existingOnDay = availabilityBlocks.filter(
      b => b.day_of_week === availabilityForm.day_of_week
    );
    const hasOverlap = existingOnDay.some(
      b => availabilityForm.start_time_local < b.end_time_local && availabilityForm.end_time_local > b.start_time_local
    );
    if (hasOverlap) {
      toast({
        title: 'Overlapping time slot',
        description: 'This overlaps with an existing time slot. Consider editing the existing one.',
        variant: 'destructive',
      });
      return;
    }

    await createAvailability.mutateAsync({
      day_of_week: availabilityForm.day_of_week,
      start_time_local: availabilityForm.start_time_local,
      end_time_local: availabilityForm.end_time_local,
    });
    setAvailabilityDialogOpen(false);
    setAvailabilityForm(defaultAvailabilityForm);
  };

  const handleCreateTimeOff = async () => {
    await createTimeOff.mutateAsync({
      start_at: `${timeOffForm.start_date}T00:00:00`,
      end_at: `${timeOffForm.end_date}T23:59:59`,
      reason: timeOffForm.reason || undefined,
    });
    setTimeOffDialogOpen(false);
    setTimeOffForm(defaultTimeOffForm);
  };

  const handleDeleteAvailability = async () => {
    if (deleteAvailabilityId) {
      await deleteAvailability.mutateAsync(deleteAvailabilityId);
      setDeleteAvailabilityId(null);
    }
  };

  const handleDeleteTimeOff = async () => {
    if (deleteTimeOffId) {
      await deleteTimeOff.mutateAsync(deleteTimeOffId);
      setDeleteTimeOffId(null);
    }
  };

  const formatTime = (time: string) => {
    const [hours, mins] = time.split(':').map(Number);
    return format(new Date(2000, 0, 1, hours, mins), 'h:mm a');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weekly Availability */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Weekly Availability
            </CardTitle>
            <CardDescription>
              Set your regular teaching hours for each day of the week
            </CardDescription>
          </div>
          <Button onClick={() => setAvailabilityDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Hours
          </Button>
        </CardHeader>
        <CardContent>
          {availabilityBlocks.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No availability set"
              description="Add your regular teaching hours so the system can detect scheduling conflicts."
              actionLabel="Add Availability"
              onAction={() => setAvailabilityDialogOpen(true)}
              size="sm"
            />
          ) : (
            <div className="grid gap-3">
              {availabilityByDay.map(day => (
                <div
                  key={day.value}
                  className={cn(
                    'flex items-center justify-between rounded-lg border p-3',
                    day.blocks.length === 0 && 'bg-muted/30'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-24 font-medium">{day.label}</span>
                    {day.blocks.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Not available</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {day.blocks.map(block => (
                          <div key={block.id} className="flex items-center gap-1">
                            <Badge variant="secondary">
                              {formatTime(block.start_time_local)} - {formatTime(block.end_time_local)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDeleteAvailabilityId(block.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">Remove time slot</span>
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time Off */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5" />
              Time Off
            </CardTitle>
            <CardDescription>
              Block dates when you're unavailable for lessons (holidays, sick leave, etc.)
            </CardDescription>
          </div>
          <Button onClick={() => setTimeOffDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Time Off
          </Button>
        </CardHeader>
        <CardContent>
          {upcomingTimeOff.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No time off scheduled"
              description="Add time off periods to block scheduling during holidays or leave."
              actionLabel="Add Time Off"
              onAction={() => setTimeOffDialogOpen(true)}
              size="sm"
            />
          ) : (
            <div className="space-y-2">
              {upcomingTimeOff.map(timeOff => {
                const startDate = parseISO(timeOff.start_at);
                const endDate = parseISO(timeOff.end_at);
                const isSameDay = format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd');
                const isPast = isBefore(endDate, new Date());

                return (
                  <div
                    key={timeOff.id}
                    className={cn(
                      'flex items-center justify-between rounded-lg border p-3',
                      isPast && 'opacity-50'
                    )}
                  >
                    <div>
                      <div className="font-medium">
                        {isSameDay
                          ? format(startDate, 'EEEE, d MMMM yyyy')
                          : `${format(startDate, 'd MMM')} - ${format(endDate, 'd MMM yyyy')}`}
                      </div>
                      {timeOff.reason && (
                        <div className="text-sm text-muted-foreground">{timeOff.reason}</div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTimeOffId(timeOff.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Availability Dialog */}
      <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Availability</DialogTitle>
            <DialogDescription>
              Set your available teaching hours for a day
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select
                value={availabilityForm.day_of_week}
                onValueChange={(v) => setAvailabilityForm(f => ({ ...f, day_of_week: v as DayOfWeek }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map(day => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Select
                  value={availabilityForm.start_time_local}
                  onValueChange={(v) => setAvailabilityForm(f => ({ ...f, start_time_local: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {TIME_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>End Time</Label>
                <Select
                  value={availabilityForm.end_time_local}
                  onValueChange={(v) => setAvailabilityForm(f => ({ ...f, end_time_local: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {TIME_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAvailabilityDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateAvailability}
              disabled={
                createAvailability.isPending ||
                availabilityForm.start_time_local >= availabilityForm.end_time_local
              }
            >
              {createAvailability.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Availability
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Time Off Dialog */}
      <Dialog open={timeOffDialogOpen} onOpenChange={setTimeOffDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Time Off</DialogTitle>
            <DialogDescription>
              Block dates when you're not available for lessons
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={timeOffForm.start_date}
                  onChange={(e) => setTimeOffForm(f => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={timeOffForm.end_date}
                  min={timeOffForm.start_date}
                  onChange={(e) => setTimeOffForm(f => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="e.g. Holiday, Medical appointment..."
                value={timeOffForm.reason}
                onChange={(e) => setTimeOffForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTimeOffDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTimeOff}
              disabled={
                createTimeOff.isPending ||
                timeOffForm.start_date > timeOffForm.end_date
              }
            >
              {createTimeOff.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Time Off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Availability Confirmation */}
      <AlertDialog open={!!deleteAvailabilityId} onOpenChange={(open) => !open && setDeleteAvailabilityId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Availability?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this time slot from your weekly availability.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAvailability}>
              {deleteAvailability.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Time Off Confirmation */}
      <AlertDialog open={!!deleteTimeOffId} onOpenChange={(open) => !open && setDeleteTimeOffId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Time Off?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this time off period and allow lessons to be scheduled during these dates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTimeOff}>
              {deleteTimeOff.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
