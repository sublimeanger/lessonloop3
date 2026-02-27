import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInstruments } from '@/hooks/useInstruments';
import { useTeachers } from '@/hooks/useTeachers';
import { useAddToEnrolmentWaitlist, type AddToWaitlistInput, type WaitlistPriority, type WaitlistSource } from '@/hooks/useEnrolmentWaitlist';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AddToWaitlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill from lead data */
  leadData?: {
    lead_id: string;
    contact_name: string;
    contact_email?: string;
    contact_phone?: string;
    children?: { first_name: string; last_name?: string; age?: number; instrument?: string }[];
  };
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
};

const EXPERIENCE_LEVELS = [
  'Beginner',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Diploma',
];

const DURATIONS = [15, 20, 30, 45, 60];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddToWaitlistDialog({ open, onOpenChange, leadData }: AddToWaitlistDialogProps) {
  const isMobile = useIsMobile();
  const addMutation = useAddToEnrolmentWaitlist();
  const { data: instruments } = useInstruments();
  const { data: teachers } = useTeachers();

  // Form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [childFirstName, setChildFirstName] = useState('');
  const [childLastName, setChildLastName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [instrumentId, setInstrumentId] = useState('');
  const [instrumentName, setInstrumentName] = useState('');
  const [preferredTeacherId, setPreferredTeacherId] = useState('');
  const [preferredLocationId, setPreferredLocationId] = useState('');
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [preferredTimeEarliest, setPreferredTimeEarliest] = useState('');
  const [preferredTimeLatest, setPreferredTimeLatest] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [durationMins, setDurationMins] = useState('30');
  const [priority, setPriority] = useState<WaitlistPriority>('normal');
  const [notes, setNotes] = useState('');

  // Pre-fill from lead data
  useEffect(() => {
    if (leadData && open) {
      setContactName(leadData.contact_name || '');
      setContactEmail(leadData.contact_email || '');
      setContactPhone(leadData.contact_phone || '');
      if (leadData.children?.[0]) {
        const child = leadData.children[0];
        setChildFirstName(child.first_name || '');
        setChildLastName(child.last_name || '');
        if (child.age) setChildAge(String(child.age));
        if (child.instrument) {
          const match = instruments?.find(
            (i) => i.name.toLowerCase() === child.instrument?.toLowerCase()
          );
          if (match) {
            setInstrumentId(match.id);
            setInstrumentName(match.name);
          }
        }
      }
    }
  }, [leadData, open, instruments]);

  const resetForm = () => {
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setChildFirstName('');
    setChildLastName('');
    setChildAge('');
    setInstrumentId('');
    setInstrumentName('');
    setPreferredTeacherId('');
    setPreferredLocationId('');
    setPreferredDays([]);
    setPreferredTimeEarliest('');
    setPreferredTimeLatest('');
    setExperienceLevel('');
    setDurationMins('30');
    setPriority('normal');
    setNotes('');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    const input: AddToWaitlistInput = {
      contact_name: contactName,
      contact_email: contactEmail || undefined,
      contact_phone: contactPhone || undefined,
      child_first_name: childFirstName,
      child_last_name: childLastName || undefined,
      child_age: childAge ? parseInt(childAge, 10) : null,
      instrument_id: instrumentId || undefined,
      instrument_name: instrumentName,
      preferred_teacher_id: preferredTeacherId || undefined,
      preferred_location_id: preferredLocationId || undefined,
      preferred_days: preferredDays.length > 0 ? preferredDays : undefined,
      preferred_time_earliest: preferredTimeEarliest || undefined,
      preferred_time_latest: preferredTimeLatest || undefined,
      experience_level: experienceLevel || undefined,
      lesson_duration_mins: parseInt(durationMins, 10),
      notes: notes || undefined,
      priority,
      source: (leadData ? 'lead_pipeline' : 'manual') as WaitlistSource,
      lead_id: leadData?.lead_id,
    };

    await addMutation.mutateAsync(input);
    handleClose();
  };

  const toggleDay = (day: string) => {
    setPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleInstrumentChange = (id: string) => {
    setInstrumentId(id);
    const inst = instruments?.find((i) => i.id === id);
    if (inst) setInstrumentName(inst.name);
  };

  const isValid = contactName.trim() && childFirstName.trim() && instrumentName.trim();

  // ---------------------------------------------------------------------------
  // Form content
  // ---------------------------------------------------------------------------

  const formContent = (
    <div className="space-y-4 overflow-y-auto max-h-[60vh] px-1">
      {/* Contact info */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Contact Details</h4>
        <div className="space-y-2">
          <Label htmlFor="wl-contact-name">Contact Name *</Label>
          <Input
            id="wl-contact-name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Parent/guardian name"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="wl-email">Email</Label>
            <Input
              id="wl-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wl-phone">Phone</Label>
            <Input
              id="wl-phone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Child info */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Child Details</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="wl-child-first">First Name *</Label>
            <Input
              id="wl-child-first"
              value={childFirstName}
              onChange={(e) => setChildFirstName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wl-child-last">Last Name</Label>
            <Input
              id="wl-child-last"
              value={childLastName}
              onChange={(e) => setChildLastName(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="wl-age">Age</Label>
            <Input
              id="wl-age"
              type="number"
              min={3}
              max={99}
              value={childAge}
              onChange={(e) => setChildAge(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wl-experience">Experience</Label>
            <Select value={experienceLevel} onValueChange={setExperienceLevel}>
              <SelectTrigger id="wl-experience">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Instrument & duration */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Lesson Preferences</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="wl-instrument">Instrument *</Label>
            <Select value={instrumentId} onValueChange={handleInstrumentChange}>
              <SelectTrigger id="wl-instrument">
                <SelectValue placeholder="Select instrument" />
              </SelectTrigger>
              <SelectContent>
                {instruments?.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wl-duration">Duration</Label>
            <Select value={durationMins} onValueChange={setDurationMins}>
              <SelectTrigger id="wl-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>{d} mins</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wl-teacher">Preferred Teacher</Label>
          <Select value={preferredTeacherId} onValueChange={setPreferredTeacherId}>
            <SelectTrigger id="wl-teacher">
              <SelectValue placeholder="Any teacher" />
            </SelectTrigger>
            <SelectContent>
              {teachers?.filter((t) => t.status === 'active').map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Preferred days */}
        <div className="space-y-2">
          <Label>Preferred Days</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => (
              <label key={day} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={preferredDays.includes(day)}
                  onCheckedChange={() => toggleDay(day)}
                />
                <span className="text-sm">{DAY_LABELS[day]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Time range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="wl-time-earliest">Earliest Time</Label>
            <Input
              id="wl-time-earliest"
              type="time"
              value={preferredTimeEarliest}
              onChange={(e) => setPreferredTimeEarliest(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wl-time-latest">Latest Time</Label>
            <Input
              id="wl-time-latest"
              type="time"
              value={preferredTimeLatest}
              onChange={(e) => setPreferredTimeLatest(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Priority & notes */}
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="wl-priority">Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as WaitlistPriority)}>
            <SelectTrigger id="wl-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="wl-notes">Notes</Label>
          <Textarea
            id="wl-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );

  const footer = (
    <>
      <Button variant="outline" onClick={handleClose} className="min-h-11 sm:min-h-9">
        Cancel
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={!isValid || addMutation.isPending}
        className="min-h-11 sm:min-h-9"
      >
        {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Add to Waiting List
      </Button>
    </>
  );

  // ---------------------------------------------------------------------------
  // Responsive rendering
  // ---------------------------------------------------------------------------

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader>
            <DrawerTitle>Add to Waiting List</DrawerTitle>
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
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add to Waiting List</DialogTitle>
        </DialogHeader>
        {formContent}
        <DialogFooter className="flex-row gap-2 sm:justify-end">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
