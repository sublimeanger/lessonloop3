import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Send } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTeachers } from '@/hooks/useTeachers';
import { useOfferSlot, type EnrolmentWaitlistEntry } from '@/hooks/useEnrolmentWaitlist';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OfferSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: EnrolmentWaitlistEntry;
}

const DAYS = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OfferSlotDialog({ open, onOpenChange, entry }: OfferSlotDialogProps) {
  const isMobile = useIsMobile();
  const offerMutation = useOfferSlot();
  const { data: teachers } = useTeachers();

  const [day, setDay] = useState(entry.preferred_days?.[0] || '');
  const [time, setTime] = useState(entry.preferred_time_earliest || '');
  const [teacherId, setTeacherId] = useState(entry.preferred_teacher_id || '');
  const [locationId, setLocationId] = useState(entry.preferred_location_id || '');
  const [rateMinor, setRateMinor] = useState('');

  const handleSubmit = async () => {
    if (!day || !time || !teacherId || !locationId) return;

    await offerMutation.mutateAsync({
      waitlist_id: entry.id,
      day,
      time,
      teacher_id: teacherId,
      location_id: locationId,
      rate_minor: rateMinor ? parseInt(rateMinor, 10) : 0,
    });

    onOpenChange(false);
  };

  const isValid = day && time && teacherId && locationId;

  const formContent = (
    <div className="space-y-4">
      {/* Read-only header */}
      <div className="rounded-lg bg-muted/50 p-3">
        <p className="text-sm font-medium">
          {entry.child_first_name} {entry.child_last_name || ''}
        </p>
        <p className="text-sm text-muted-foreground">
          {entry.instrument_name} · {entry.lesson_duration_mins} mins
        </p>
        {entry.preferred_days?.length ? (
          <p className="text-xs text-muted-foreground mt-1">
            Prefers: {entry.preferred_days.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
            {entry.preferred_time_earliest && entry.preferred_time_latest
              ? ` · ${entry.preferred_time_earliest}–${entry.preferred_time_latest}`
              : ''}
          </p>
        ) : null}
      </div>

      {/* Slot details */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="offer-day">Day *</Label>
          <Select value={day} onValueChange={setDay}>
            <SelectTrigger id="offer-day">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="offer-time">Time *</Label>
          <Input
            id="offer-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="offer-teacher">Teacher *</Label>
        <Select value={teacherId} onValueChange={setTeacherId}>
          <SelectTrigger id="offer-teacher">
            <SelectValue placeholder="Select teacher" />
          </SelectTrigger>
          <SelectContent>
            {teachers?.filter((t) => t.status === 'active').map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="offer-location">Location *</Label>
        <Input
          id="offer-location"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          placeholder="Location ID (v1: enter manually)"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="offer-rate">Lesson Rate (pence)</Label>
        <Input
          id="offer-rate"
          type="number"
          min={0}
          value={rateMinor}
          onChange={(e) => setRateMinor(e.target.value)}
          placeholder="e.g. 3000 for £30.00"
        />
      </div>
    </div>
  );

  const footer = (
    <>
      <Button
        variant="outline"
        onClick={() => onOpenChange(false)}
        className="min-h-11 sm:min-h-9"
      >
        Cancel
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={!isValid || offerMutation.isPending}
        className="min-h-11 sm:min-h-9 gap-2"
      >
        {offerMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Send Offer
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader>
            <DrawerTitle>Offer Slot</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-2">{formContent}</div>
          <DrawerFooter className="flex-row gap-2">
            {footer}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Offer Slot</DialogTitle>
          <DialogDescription>
            Offer an available lesson slot to this family
          </DialogDescription>
        </DialogHeader>
        {formContent}
        <DialogFooter className="flex-row gap-2 sm:justify-end">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
